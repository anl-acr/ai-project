import React, { useState, useEffect, useRef } from "react";
import {
  Languages,
  Radio,
  Loader2,
  X,
  Trash2
} from "lucide-react";
import { useTheme } from "../../utils/theme";
import { webphoneManager } from "../../utils/webphoneManager";

const SUPPORTED_LANGUAGES = [
  { code: "en", label: "İngilizce (EN)", flag: "🇬🇧", speechLang: "en-US" },
  { code: "de", label: "Almanca (DE)", flag: "🇩🇪", speechLang: "de-DE" },
  { code: "ru", label: "Rusça (RU)", flag: "🇷🇺", speechLang: "ru-RU" },
  { code: "ar", label: "Arapça (AR)", flag: "🇸🇦", speechLang: "ar-SA" },
  { code: "fr", label: "Fransızca (FR)", flag: "🇫🇷", speechLang: "fr-FR" },
  { code: "es", label: "İspanyolca (ES)", flag: "🇪🇸", speechLang: "es-ES" }
];

export default function LiveTranslatorPanel({
  backendHost = "localhost:8000",
  callId = null,
  callStatus = "Idle",
  canLiveTranslate = true,
  canVoiceInterpret = true,
  isActiveInstance = true,
  onClose = null
}) {
  const { bg, text, border, lightBg, borderLight } = useTheme();

  const [customerLang, setCustomerLang] = useState("en");
  const [agentLang] = useState("tr");

  const [isListeningCustomer, setIsListeningCustomer] = useState(false);
  const [items, setItems] = useState([]);
  const [processingCustomerChunk, setProcessingCustomerChunk] = useState(false);
  const [processingAgentSpeech, setProcessingAgentSpeech] = useState(false);

  // Refs for WebRTC remote stream (Customer) recorder
  const customerCaptureIntervalRef = useRef(null);
  const customerStreamWaitIntervalRef = useRef(null);
  const customerMediaRecorderRef = useRef(null);
  const customerAudioCtxRef = useRef(null);
  const hasAttachedStreamRef = useRef(false);
  const inFlightCustomerReqRef = useRef(false);

  // Refs for WebRTC local stream (Agent) recorder
  const agentHandsFreeIntervalRef = useRef(null);
  const agentHandsFreeRecorderRef = useRef(null);
  const hasAttachedLocalStreamRef = useRef(false);
  const inFlightAgentReqRef = useRef(false);

  const feedEndRef = useRef(null);
  const lastCustomerTextRef = useRef("");
  const lastAgentTextRef = useRef("");
  const isListeningCustomerRef = useRef(true);
  const customerLangRef = useRef(customerLang);

  const API_BASE =
    typeof window !== "undefined" ? `${window.location.protocol}//${backendHost}` : `http://${backendHost}`;

  const selectedCustomerLangObj =
    SUPPORTED_LANGUAGES.find((l) => l.code === customerLang) || SUPPORTED_LANGUAGES[0];

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items.length]);

  useEffect(() => {
    isListeningCustomerRef.current = isListeningCustomer;
  }, [isListeningCustomer]);

  useEffect(() => {
    customerLangRef.current = customerLang;
  }, [customerLang]);

  // Sync translation items across multiple mounted panels (e.g. AgentWebphoneTab and CallChatWidget)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleSyncItem = (e) => {
      const item = e?.detail;
      if (!item || !item.id) return;
      setItems((prev) => (prev.some((x) => x.id === item.id) ? prev : [...prev, item]));
    };
    window.addEventListener("LIVE_TRANSLATOR_SYNC_ITEM", handleSyncItem);
    return () => window.removeEventListener("LIVE_TRANSLATOR_SYNC_ITEM", handleSyncItem);
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopCustomerListener();
      webphoneManager.setRemoteAudioDucking(false);
      webphoneManager.setRawMicSuppressed(false);
    };
  }, []);

  // Automatically start/attach listeners when call is active on the visible instance, and stop when Idle
  useEffect(() => {
    if (callStatus === "Idle" || !isActiveInstance) {
      stopCustomerListener();
    } else if (canLiveTranslate || canVoiceInterpret) {
      startCustomerListener(true);
    }
  }, [callStatus, canLiveTranslate, canVoiceInterpret, isActiveInstance]);

  const blobToBase64 = (blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const res = String(reader.result || "");
        const b64 = res.includes(";base64,")
          ? res.split(";base64,")[1]
          : res.includes(",")
          ? res.split(",").pop()
          : res;
        resolve(b64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const emitLiveTurn = (newItem) => {
    setItems((prev) => (prev.some((x) => x.id === newItem.id) ? prev : [...prev, newItem]));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("LIVE_TRANSLATOR_SYNC_ITEM", { detail: newItem }));
      const speaker = newItem.direction === "customer_to_agent" ? "customer" : "human";
      const displayLine =
        speaker === "customer"
          ? newItem.translatedText || newItem.originalText
          : newItem.originalText || newItem.translatedText;
      window.dispatchEvent(
        new CustomEvent("LIVE_TRANSLATION_TURN", {
          detail: {
            speaker,
            text: displayLine
          }
        })
      );
    }
  };

  // Attach slice-based MediaRecorder to incoming customer WebRTC stream
  const attachRecorderToRemoteStream = (remoteStream) => {
    try {
      if (customerCaptureIntervalRef.current) {
        clearInterval(customerCaptureIntervalRef.current);
        customerCaptureIntervalRef.current = null;
      }
      if (customerMediaRecorderRef.current && customerMediaRecorderRef.current.state === "recording") {
        try {
          customerMediaRecorderRef.current.stop();
        } catch (e) {}
      }

      // Passive WebAudio keepalive consumer so Chromium pulls RTP frames continuously
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          const ctx = customerAudioCtxRef.current || new AudioCtx();
          if (ctx.state === "suspended") {
            ctx.resume().catch(() => {});
          }
          customerAudioCtxRef.current = ctx;
          const source = ctx.createMediaStreamSource(remoteStream);
          const keepAliveGain = ctx.createGain();
          keepAliveGain.gain.value = 0.0001;
          source.connect(keepAliveGain);
          keepAliveGain.connect(ctx.destination);
        }
      } catch (audioGraphErr) {}

      const mimeType =
        typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";

      const recordWindow = () => {
        if (!isListeningCustomerRef.current) return;
        const liveRemote = webphoneManager.getActiveRemoteStream() || remoteStream;
        if (!liveRemote) return;
        const audioTracks = liveRemote.getAudioTracks ? liveRemote.getAudioTracks() : [];
        if (audioTracks.length === 0) return;

        try {
          const streamForRecorder = new MediaStream([audioTracks[0].clone()]);
          const chunks = [];
          const recorder = mimeType
            ? new MediaRecorder(streamForRecorder, { mimeType })
            : new MediaRecorder(streamForRecorder);
          customerMediaRecorderRef.current = recorder;

          recorder.ondataavailable = (ev) => {
            if (ev.data && ev.data.size > 0) chunks.push(ev.data);
          };

          recorder.onstop = async () => {
            try {
              streamForRecorder.getTracks().forEach((t) => t.stop());
            } catch (e) {}
            if (chunks.length === 0 || inFlightCustomerReqRef.current) return;
            const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
            if (blob.size < 200) return;
            await processCustomerAudioBlob(blob, recorder.mimeType || "audio/webm");
          };

          recorder.start(500);
          setTimeout(() => {
            if (recorder.state === "recording") {
              try {
                recorder.stop();
              } catch (e) {}
            }
          }, 2900);
        } catch (err) {
          console.error("[LiveTranslator] Customer recorder window error:", err);
        }
      };

      hasAttachedStreamRef.current = true;
      recordWindow();
      customerCaptureIntervalRef.current = setInterval(recordWindow, 3000);
    } catch (err) {
      console.error("[LiveTranslator] attachRecorderToRemoteStream error:", err);
    }
  };

  // Attach slice-based MediaRecorder to agent's local WebRTC microphone stream
  const attachHandsFreeRecorderToLocalStream = (localStream) => {
    try {
      if (agentHandsFreeIntervalRef.current) {
        clearInterval(agentHandsFreeIntervalRef.current);
        agentHandsFreeIntervalRef.current = null;
      }
      if (agentHandsFreeRecorderRef.current && agentHandsFreeRecorderRef.current.state === "recording") {
        try {
          agentHandsFreeRecorderRef.current.stop();
        } catch (e) {}
      }

      const mimeType =
        typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";

      const recordAgentWindow = () => {
        if (!isListeningCustomerRef.current) return;
        const currentLocal = webphoneManager.getActiveLocalStream() || localStream;
        if (!currentLocal) return;
        const tracks = currentLocal.getAudioTracks ? currentLocal.getAudioTracks() : [];
        if (!tracks.length || !tracks[0].enabled) return;

        try {
          const streamForRecorder = new MediaStream([tracks[0].clone()]);
          const chunks = [];
          const recorder = mimeType
            ? new MediaRecorder(streamForRecorder, { mimeType })
            : new MediaRecorder(streamForRecorder);
          agentHandsFreeRecorderRef.current = recorder;

          recorder.ondataavailable = (ev) => {
            if (ev.data && ev.data.size > 0) chunks.push(ev.data);
          };

          recorder.onstop = async () => {
            try {
              streamForRecorder.getTracks().forEach((t) => t.stop());
            } catch (e) {}
            if (chunks.length === 0 || inFlightAgentReqRef.current) return;
            const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
            if (blob.size < 400) return;
            inFlightAgentReqRef.current = true;
            try {
              await processAgentAudioBlob(blob, recorder.mimeType || "audio/webm");
            } finally {
              inFlightAgentReqRef.current = false;
            }
          };

          recorder.start(500);
          setTimeout(() => {
            if (recorder.state === "recording") {
              try {
                recorder.stop();
              } catch (e) {}
            }
          }, 2900);
        } catch (err) {
          console.warn("[LiveTranslator] Agent slice warning:", err);
        }
      };

      hasAttachedLocalStreamRef.current = true;
      recordAgentWindow();
      agentHandsFreeIntervalRef.current = setInterval(recordAgentWindow, 3000);
    } catch (err) {
      console.warn("[LiveTranslator] attachHandsFreeRecorderToLocalStream error:", err);
    }
  };

  const startCustomerListener = async (forceReattach = false) => {
    if (!isActiveInstance) return;
    if (isListeningCustomer && hasAttachedStreamRef.current && !forceReattach) return;
    setIsListeningCustomer(true);
    isListeningCustomerRef.current = true;

    const remoteStream = webphoneManager.getActiveRemoteStream();
    const localStream = webphoneManager.getActiveLocalStream();

    if (remoteStream) {
      attachRecorderToRemoteStream(remoteStream);
    }
    if (localStream) {
      attachHandsFreeRecorderToLocalStream(localStream);
    }

    if (remoteStream && localStream) {
      if (customerStreamWaitIntervalRef.current) {
        clearInterval(customerStreamWaitIntervalRef.current);
        customerStreamWaitIntervalRef.current = null;
      }
      return;
    }

    if (!customerStreamWaitIntervalRef.current) {
      customerStreamWaitIntervalRef.current = setInterval(() => {
        const rStream = webphoneManager.getActiveRemoteStream();
        const lStream = webphoneManager.getActiveLocalStream();
        if (rStream && !hasAttachedStreamRef.current) {
          attachRecorderToRemoteStream(rStream);
        }
        if (lStream && !hasAttachedLocalStreamRef.current) {
          attachHandsFreeRecorderToLocalStream(lStream);
        }
        if (hasAttachedStreamRef.current && hasAttachedLocalStreamRef.current) {
          clearInterval(customerStreamWaitIntervalRef.current);
          customerStreamWaitIntervalRef.current = null;
        }
      }, 700);
    }
  };

  const stopCustomerListener = () => {
    isListeningCustomerRef.current = false;
    if (customerStreamWaitIntervalRef.current) {
      clearInterval(customerStreamWaitIntervalRef.current);
      customerStreamWaitIntervalRef.current = null;
    }
    if (customerCaptureIntervalRef.current) {
      clearInterval(customerCaptureIntervalRef.current);
      customerCaptureIntervalRef.current = null;
    }
    if (agentHandsFreeIntervalRef.current) {
      clearInterval(agentHandsFreeIntervalRef.current);
      agentHandsFreeIntervalRef.current = null;
    }
    if (customerMediaRecorderRef.current && customerMediaRecorderRef.current.state === "recording") {
      try {
        customerMediaRecorderRef.current.stop();
      } catch (e) {}
    }
    if (agentHandsFreeRecorderRef.current && agentHandsFreeRecorderRef.current.state === "recording") {
      try {
        agentHandsFreeRecorderRef.current.stop();
      } catch (e) {}
    }
    customerMediaRecorderRef.current = null;
    agentHandsFreeRecorderRef.current = null;
    hasAttachedStreamRef.current = false;
    hasAttachedLocalStreamRef.current = false;
    setIsListeningCustomer(false);
    webphoneManager.setRemoteAudioDucking(false);
  };

  const processCustomerAudioBlob = async (blob, mimeType) => {
    if (inFlightCustomerReqRef.current) return;
    inFlightCustomerReqRef.current = true;
    setProcessingCustomerChunk(true);
    try {
      const b64 = await blobToBase64(blob);
      const res = await fetch(`${API_BASE}/api/live-translator/translate-audio`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-ID": localStorage.getItem("current_user_id") || "admin"
        },
        body: JSON.stringify({
          audio_base64: b64,
          mime_type: (mimeType || "audio/webm").split(";")[0],
          direction: "customer_to_agent",
          source_lang: customerLangRef.current || customerLang,
          target_lang: agentLang,
          generate_tts: false,
          call_id: callId
        })
      });

      if (!res.ok) return;
      const data = await res.json();
      if (!data.original_text && !data.translated_text) return;

      if (
        data.original_text &&
        lastCustomerTextRef.current &&
        data.original_text.trim().toLowerCase() === lastCustomerTextRef.current.trim().toLowerCase()
      ) {
        return;
      }
      if (data.original_text) {
        lastCustomerTextRef.current = data.original_text.trim();
      }

      const newItem = {
        id: `tr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        direction: "customer_to_agent",
        sourceLang: data.detected_lang || data.source_lang || customerLangRef.current || customerLang,
        targetLang: "tr",
        originalText: data.original_text || "",
        translatedText: data.translated_text || data.original_text || "",
        timestamp: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      };

      emitLiveTurn(newItem);
    } catch (e) {
      console.error("[LiveTranslator] Customer chunk translate error:", e);
    } finally {
      inFlightCustomerReqRef.current = false;
      setProcessingCustomerChunk(false);
    }
  };

  const processAgentAudioBlob = async (blob, mimeType) => {
    setProcessingAgentSpeech(true);
    try {
      const b64 = blob && blob.size > 0 ? await blobToBase64(blob) : "";
      const activeTargetLang = customerLangRef.current || customerLang;
      const res = await fetch(`${API_BASE}/api/live-translator/translate-audio`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-ID": localStorage.getItem("current_user_id") || "admin"
        },
        body: JSON.stringify({
          audio_base64: b64,
          mime_type: (mimeType || "audio/webm").split(";")[0],
          direction: "agent_to_customer",
          source_lang: "tr",
          target_lang: activeTargetLang,
          generate_tts: false,
          call_id: callId
        })
      });

      if (!res.ok) return;
      const data = await res.json();
      if (!data.translated_text && !data.original_text) return;

      if (
        data.original_text &&
        lastAgentTextRef.current &&
        data.original_text.trim().toLowerCase() === lastAgentTextRef.current.trim().toLowerCase()
      ) {
        return;
      }
      if (data.original_text) {
        lastAgentTextRef.current = data.original_text.trim();
      }

      const newItem = {
        id: `tr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        direction: "agent_to_customer",
        sourceLang: "tr",
        targetLang: activeTargetLang,
        originalText: data.original_text || "",
        translatedText: data.translated_text || "",
        timestamp: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      };

      emitLiveTurn(newItem);
    } catch (e) {
      console.error("[LiveTranslator] Agent speech translate error:", e);
    } finally {
      setProcessingAgentSpeech(false);
    }
  };

  if (!canLiveTranslate && !canVoiceInterpret) {
    return null;
  }

  return (
    <div
      className={`p-3.5 bg-white dark:bg-slate-900 border ${borderLight} rounded-2xl shadow-sm flex flex-col gap-2.5`}
    >
      {/* Clean Header Bar */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-xl ${lightBg} ${text}`}>
            <Languages size={16} />
          </div>
          <span className="text-xs font-extrabold text-slate-800 dark:text-white">
            Canlı Konuşma &amp; Çeviri
          </span>
          {isListeningCustomer && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
              <Radio size={10} className="animate-pulse" />
              Dinleniyor
            </span>
          )}
          {(processingCustomerChunk || processingAgentSpeech) && (
            <Loader2 size={13} className={`animate-spin ${text}`} />
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Customer Foreign Language Selector */}
          <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/80 px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] font-bold text-slate-400">Dil:</span>
            <select
              value={customerLang}
              onChange={(e) => setCustomerLang(e.target.value)}
              className="bg-transparent text-[11px] font-bold text-slate-800 dark:text-white focus:outline-none cursor-pointer"
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-white">
                  {l.flag} {l.label}
                </option>
              ))}
            </select>
          </div>

          {items.length > 0 && (
            <button
              type="button"
              onClick={() => setItems([])}
              className="p-1.5 rounded-xl text-slate-400 hover:text-rose-500 border border-slate-200 dark:border-slate-800 transition-colors"
              title="Konuşma Akışını Temizle"
            >
              <Trash2 size={13} />
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              title="Kapat"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Chat-Style Stream: Left = Customer (Turkish text), Right = Agent */}
      <div className="max-h-72 min-h-[160px] overflow-y-auto flex flex-col gap-2.5 px-1 py-1">
        {items.length === 0 ? (
          <div className="my-auto py-8 text-center text-xs text-slate-400 dark:text-slate-500">
            Görüşme sırasındaki konuşmalar burada sohbet akışı olarak görünür.
          </div>
        ) : (
          items.map((item) => {
            const isCust = item.direction === "customer_to_agent";
            const origClean = (item.originalText || "").trim();
            const transClean = (item.translatedText || "").trim();
            const hasDifferentTranslation =
              origClean && transClean && origClean.toLowerCase() !== transClean.toLowerCase();

            if (isCust) {
              // LEFT SIDE: Customer's speech (Turkish translation shown as main text)
              const mainTurkishText = transClean || origClean;
              return (
                <div key={item.id} className="flex flex-col items-start max-w-[82%] self-start">
                  <div className="flex items-center gap-1.5 mb-0.5 px-1">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                      Müşteri
                    </span>
                    <span className="text-[9px] font-mono text-slate-400">{item.timestamp}</span>
                  </div>
                  <div className="px-3.5 py-2 rounded-2xl rounded-tl-sm bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200/70 dark:border-slate-700/70 shadow-sm">
                    <p className="text-xs sm:text-sm font-semibold leading-snug break-words">
                      {mainTurkishText}
                    </p>
                    {hasDifferentTranslation && (
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 italic mt-0.5 break-words">
                        {origClean}
                      </p>
                    )}
                  </div>
                </div>
              );
            }

            // RIGHT SIDE: Agent's speech
            const mainAgentText = origClean || transClean;
            return (
              <div key={item.id} className="flex flex-col items-end max-w-[82%] self-end">
                <div className="flex items-center gap-1.5 mb-0.5 px-1">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                    Temsilci
                  </span>
                  <span className="text-[9px] font-mono text-slate-400">{item.timestamp}</span>
                </div>
                <div className={`px-3.5 py-2 rounded-2xl rounded-tr-sm ${bg} text-white shadow-sm`}>
                  <p className="text-xs sm:text-sm font-semibold leading-snug break-words">
                    {mainAgentText}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={feedEndRef} />
      </div>
    </div>
  );
}
