import React, { useState, useEffect, useRef } from "react";
import {
  Languages,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Send,
  Sparkles,
  Play,
  Radio,
  ArrowRightLeft,
  Check,
  Loader2,
  X,
  Trash2,
  Headphones
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
  onClose = null
}) {
  const { bg, hover, text, border, lightBg, borderLight } = useTheme();

  const [customerLang, setCustomerLang] = useState("en");
  const [agentLang] = useState("tr");

  // Modes
  const [isListeningCustomer, setIsListeningCustomer] = useState(false);
  const [autoSpeakCustomerInTurkish, setAutoSpeakCustomerInTurkish] = useState(Boolean(canVoiceInterpret));
  const [isRecordingAgentSpeech, setIsRecordingAgentSpeech] = useState(false);

  // Translation feed items
  const [items, setItems] = useState([]);
  const [manualTurkishInput, setManualTurkishInput] = useState("");
  const [processingCustomerChunk, setProcessingCustomerChunk] = useState(false);
  const [processingAgentSpeech, setProcessingAgentSpeech] = useState(false);
  const [playingItemId, setPlayingItemId] = useState(null);
  const [statusBanner, setStatusBanner] = useState("");

  // Refs for WebRTC remote stream recorder
  const customerCaptureIntervalRef = useRef(null);
  const customerStreamWaitIntervalRef = useRef(null);
  const customerMediaRecorderRef = useRef(null);
  const customerAudioCtxRef = useRef(null);
  const hasAttachedStreamRef = useRef(false);
  const inFlightCustomerReqRef = useRef(false);

  // Refs for Agent push-to-talk recorder + SpeechRecognition fallback
  const agentMediaRecorderRef = useRef(null);
  const agentMicStreamRef = useRef(null);
  const agentChunksRef = useRef([]);
  const agentSpeechRecRef = useRef(null);
  const agentSttTranscriptRef = useRef("");
  const feedEndRef = useRef(null);

  const API_BASE =
    typeof window !== "undefined" ? `${window.location.protocol}//${backendHost}` : `http://${backendHost}`;

  const selectedCustomerLangObj =
    SUPPORTED_LANGUAGES.find((l) => l.code === customerLang) || SUPPORTED_LANGUAGES[0];

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items.length]);

  // Clean up on unmount or when call ends
  useEffect(() => {
    return () => {
      stopCustomerListener();
      stopAgentPushToTalk(true);
      webphoneManager.setRemoteAudioDucking(false);
      webphoneManager.setRawMicSuppressed(false);
    };
  }, []);

  // Automatically start/attach customer listener when call enters InCall, and stop when Idle
  useEffect(() => {
    if (callStatus === "Idle") {
      stopCustomerListener();
      stopAgentPushToTalk(true);
    } else if (callStatus === "InCall" && canLiveTranslate) {
      if (!isListeningCustomer || !hasAttachedStreamRef.current) {
        startCustomerListener(true);
      }
    }
  }, [callStatus, canLiveTranslate]);

  const blobToBase64 = (blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const res = String(reader.result || "");
        const b64 = res.includes(",") ? res.split(",")[1] : res;
        resolve(b64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  // Play Turkish TTS audio into the agent's headset while ducking customer's raw audio
  const playTurkishAudioToAgentHeadset = async (audioBase64, mimeType = "audio/mpeg", fallbackText = "") => {
    if (!canVoiceInterpret) return;
    try {
      webphoneManager.setRemoteAudioDucking(true, 0.18);
      if (audioBase64) {
        const cleanB64 = audioBase64.includes(",") ? audioBase64.split(",")[1] : audioBase64;
        const audio = new Audio(`data:${mimeType};base64,${cleanB64}`);
        await new Promise((resolve) => {
          audio.onended = resolve;
          audio.onerror = resolve;
          audio.play().catch(resolve);
        });
      } else if (fallbackText && typeof window !== "undefined" && window.speechSynthesis) {
        await new Promise((resolve) => {
          const utter = new SpeechSynthesisUtterance(fallbackText);
          utter.lang = "tr-TR";
          utter.rate = 1.05;
          utter.onend = resolve;
          utter.onerror = resolve;
          window.speechSynthesis.speak(utter);
        });
      }
    } catch (e) {
      console.error("[LiveTranslator] Headset TTS playback error:", e);
    } finally {
      webphoneManager.setRemoteAudioDucking(false);
    }
  };

  const attachRecorderToRemoteStream = (remoteStream) => {
    try {
      if (customerCaptureIntervalRef.current) {
        clearInterval(customerCaptureIntervalRef.current);
        customerCaptureIntervalRef.current = null;
      }
      if (customerAudioCtxRef.current) {
        try {
          customerAudioCtxRef.current.close();
        } catch (e) {}
        customerAudioCtxRef.current = null;
      }

      // Route WebRTC remote track through WebAudio MediaStreamDestination + keepalive gain
      // to prevent Chromium crbug.com/933677 silent remote stream recording
      let recordableStream = remoteStream;
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioCtx();
        if (ctx.state === "suspended") {
          ctx.resume().catch(() => {});
        }
        customerAudioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(remoteStream);
        const dest = ctx.createMediaStreamDestination();
        source.connect(dest);

        // Silent keepalive sink so Chromium continuously pulls RTP frames into WebAudio
        const keepAliveGain = ctx.createGain();
        keepAliveGain.gain.value = 0.0001;
        source.connect(keepAliveGain);
        keepAliveGain.connect(ctx.destination);

        if (dest.stream && dest.stream.getAudioTracks().length > 0) {
          recordableStream = dest.stream;
        }
      } catch (audioGraphErr) {
        console.warn("[LiveTranslator] Using direct remoteStream fallback:", audioGraphErr);
      }

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";

      const recordWindow = () => {
        const liveRemote = webphoneManager.getActiveRemoteStream();
        if (!liveRemote) return;
        try {
          const chunks = [];
          const recorder = mimeType
            ? new MediaRecorder(recordableStream, { mimeType })
            : new MediaRecorder(recordableStream);
          customerMediaRecorderRef.current = recorder;

          recorder.ondataavailable = (ev) => {
            if (ev.data && ev.data.size > 0) chunks.push(ev.data);
          };

          recorder.onstop = async () => {
            if (chunks.length === 0 || inFlightCustomerReqRef.current) return;
            const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
            if (blob.size < 600) return;
            await processCustomerAudioBlob(blob, recorder.mimeType || "audio/webm");
          };

          recorder.start();
          setTimeout(() => {
            if (recorder.state === "recording") {
              try {
                recorder.stop();
              } catch (e) {}
            }
          }, 3200);
        } catch (err) {
          console.error("[LiveTranslator] Recorder window error:", err);
        }
      };

      hasAttachedStreamRef.current = true;
      recordWindow();
      customerCaptureIntervalRef.current = setInterval(recordWindow, 3400);
      setStatusBanner("Müşteri ses kanalı canlı dinleniyor ve anlık Türkçeye çevriliyor...");
    } catch (err) {
      console.error("[LiveTranslator] attachRecorderToRemoteStream error:", err);
      setStatusBanner("Müşteri ses akışı yakalanırken bir hata oluştu.");
    }
  };

  // Start capturing customer's incoming WebRTC audio stream in 3.2-second speech windows
  const startCustomerListener = async (forceReattach = false) => {
    if (isListeningCustomer && hasAttachedStreamRef.current && !forceReattach) return;
    setIsListeningCustomer(true);

    const remoteStream = webphoneManager.getActiveRemoteStream();
    if (remoteStream) {
      if (customerStreamWaitIntervalRef.current) {
        clearInterval(customerStreamWaitIntervalRef.current);
        customerStreamWaitIntervalRef.current = null;
      }
      attachRecorderToRemoteStream(remoteStream);
      return;
    }

    setStatusBanner(
      "Çağrı ses kanalı bekleniyor... Karşı taraf bağlandığında otomatik dinleme başlayacak (veya 'Örnek Müşteri Cümlesi Simüle Et' ile test edebilirsiniz)."
    );

    if (!customerStreamWaitIntervalRef.current) {
      customerStreamWaitIntervalRef.current = setInterval(() => {
        const s = webphoneManager.getActiveRemoteStream();
        if (s) {
          clearInterval(customerStreamWaitIntervalRef.current);
          customerStreamWaitIntervalRef.current = null;
          attachRecorderToRemoteStream(s);
        }
      }, 1000);
    }
  };

  const stopCustomerListener = () => {
    if (customerStreamWaitIntervalRef.current) {
      clearInterval(customerStreamWaitIntervalRef.current);
      customerStreamWaitIntervalRef.current = null;
    }
    if (customerCaptureIntervalRef.current) {
      clearInterval(customerCaptureIntervalRef.current);
      customerCaptureIntervalRef.current = null;
    }
    if (customerMediaRecorderRef.current && customerMediaRecorderRef.current.state === "recording") {
      try {
        customerMediaRecorderRef.current.stop();
      } catch (e) {}
    }
    customerMediaRecorderRef.current = null;
    if (customerAudioCtxRef.current) {
      try {
        customerAudioCtxRef.current.close();
      } catch (e) {}
      customerAudioCtxRef.current = null;
    }
    hasAttachedStreamRef.current = false;
    setIsListeningCustomer(false);
    webphoneManager.setRemoteAudioDucking(false);
  };

  const processCustomerAudioBlob = async (blob, mimeType) => {
    if (inFlightCustomerReqRef.current) return;
    inFlightCustomerReqRef.current = true;
    setProcessingCustomerChunk(true);
    try {
      const b64 = await blobToBase64(blob);
      const shouldTts = Boolean(canVoiceInterpret && autoSpeakCustomerInTurkish);
      const res = await fetch(`${API_BASE}/api/live-translator/translate-audio`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-ID": localStorage.getItem("current_user_id") || "admin"
        },
        body: JSON.stringify({
          audio_base64: b64,
          mime_type: mimeType.split(";")[0] || "audio/webm",
          direction: "customer_to_agent",
          source_lang: customerLang,
          target_lang: agentLang,
          generate_tts: shouldTts,
          call_id: callId
        })
      });

      if (!res.ok) return;
      const data = await res.json();
      if (!data.original_text && !data.translated_text) return;

      const newItem = {
        id: `tr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        direction: "customer_to_agent",
        sourceLang: data.detected_lang || customerLang,
        targetLang: agentLang,
        originalText: data.original_text || "",
        translatedText: data.translated_text || "",
        suggestedReplyTr: data.suggested_reply_tr || "",
        suggestedReplyTarget: data.suggested_reply_target || "",
        ttsAudioBase64: data.tts_audio_base64 || "",
        ttsMimeType: data.tts_mime_type || "audio/mpeg",
        timestamp: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      };

      setItems((prev) => [...prev, newItem]);

      if (shouldTts && newItem.translatedText) {
        await playTurkishAudioToAgentHeadset(newItem.ttsAudioBase64, newItem.ttsMimeType, newItem.translatedText);
      }
    } catch (e) {
      console.error("[LiveTranslator] Customer chunk translate error:", e);
    } finally {
      inFlightCustomerReqRef.current = false;
      setProcessingCustomerChunk(false);
    }
  };

  // Simulate customer speaking foreign language (also useful for testing/demo or manual customer phrase)
  const simulateCustomerForeignPhrase = async (sampleText) => {
    setProcessingCustomerChunk(true);
    try {
      const shouldTts = Boolean(canVoiceInterpret && autoSpeakCustomerInTurkish);
      const res = await fetch(`${API_BASE}/api/live-translator/translate-text`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-ID": localStorage.getItem("current_user_id") || "admin"
        },
        body: JSON.stringify({
          text: sampleText,
          direction: "customer_to_agent",
          source_lang: customerLang,
          target_lang: agentLang,
          generate_tts: shouldTts,
          call_id: callId
        })
      });
      if (!res.ok) return;
      const data = await res.json();
      const newItem = {
        id: `tr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        direction: "customer_to_agent",
        sourceLang: customerLang,
        targetLang: agentLang,
        originalText: data.original_text || sampleText,
        translatedText: data.translated_text || "",
        suggestedReplyTr: data.suggested_reply_tr || "",
        suggestedReplyTarget: data.suggested_reply_target || "",
        ttsAudioBase64: data.tts_audio_base64 || "",
        ttsMimeType: data.tts_mime_type || "audio/mpeg",
        timestamp: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      };
      setItems((prev) => [...prev, newItem]);

      if (shouldTts && newItem.translatedText) {
        await playTurkishAudioToAgentHeadset(newItem.ttsAudioBase64, newItem.ttsMimeType, newItem.translatedText);
      }
    } catch (e) {
      console.error("[LiveTranslator] Simulate customer phrase error:", e);
    } finally {
      setProcessingCustomerChunk(false);
    }
  };

  // Agent Push-to-Talk: Agent speaks Turkish -> Translated to Customer's Language -> Played into Customer's Call Line!
  const startAgentPushToTalk = async () => {
    if (!canVoiceInterpret || isRecordingAgentSpeech) return;
    try {
      // Suppress raw Turkish mic on the WebRTC call so customer only hears the translated foreign voice
      webphoneManager.setRawMicSuppressed(true);
      agentSttTranscriptRef.current = "";

      // Start browser Turkish SpeechRecognition in parallel as an instant fallback
      try {
        const SpeechRec =
          typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
        if (SpeechRec) {
          const rec = new SpeechRec();
          rec.lang = "tr-TR";
          rec.continuous = true;
          rec.interimResults = true;
          rec.onresult = (event) => {
            let transcript = "";
            for (let i = 0; i < event.results.length; i++) {
              transcript += event.results[i][0].transcript + " ";
            }
            agentSttTranscriptRef.current = transcript.trim();
          };
          rec.start();
          agentSpeechRecRef.current = rec;
        }
      } catch (sttErr) {}

      const selectedMic = typeof window !== "undefined" ? localStorage.getItem("selected_mic") : null;
      const stream = await webphoneManager.requestSafeMicrophoneStream(selectedMic);
      agentMicStreamRef.current = stream;
      agentChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      agentMediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) agentChunksRef.current.push(ev.data);
      };

      recorder.onstop = async () => {
        const chunks = [...agentChunksRef.current];
        const fallbackStt = agentSttTranscriptRef.current;
        agentChunksRef.current = [];
        agentSttTranscriptRef.current = "";

        if (agentMicStreamRef.current) {
          agentMicStreamRef.current.getTracks().forEach((t) => t.stop());
          agentMicStreamRef.current = null;
        }
        if (chunks.length === 0 && !fallbackStt) {
          webphoneManager.setRawMicSuppressed(false);
          return;
        }
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        await translateAndSpeakAgentAudioToCustomer(blob, recorder.mimeType || "audio/webm", fallbackStt);
      };

      recorder.start();
      setIsRecordingAgentSpeech(true);
      setStatusBanner(
        `Türkçe konuşun... Bitirdiğinizde '${selectedCustomerLangObj.label}' sesli çeviri doğrudan müşterinin telefon hattına iletilecek.`
      );
    } catch (err) {
      console.error("[LiveTranslator] Agent mic error:", err);
      webphoneManager.setRawMicSuppressed(false);
      setStatusBanner("Mikrofon erişimi sağlanamadı.");
    }
  };

  const stopAgentPushToTalk = (cancelOnly = false) => {
    if (agentSpeechRecRef.current) {
      try {
        agentSpeechRecRef.current.stop();
      } catch (e) {}
      agentSpeechRecRef.current = null;
    }
    if (cancelOnly) {
      agentChunksRef.current = [];
      agentSttTranscriptRef.current = "";
    }
    if (agentMediaRecorderRef.current && agentMediaRecorderRef.current.state === "recording") {
      try {
        agentMediaRecorderRef.current.stop();
      } catch (e) {}
    }
    agentMediaRecorderRef.current = null;
    if (agentMicStreamRef.current && cancelOnly) {
      try {
        agentMicStreamRef.current.getTracks().forEach((t) => t.stop());
      } catch (e) {}
      agentMicStreamRef.current = null;
    }
    setIsRecordingAgentSpeech(false);
    if (cancelOnly) {
      webphoneManager.setRawMicSuppressed(false);
    }
  };

  const translateAndSpeakAgentAudioToCustomer = async (blob, mimeType, fallbackStt = "") => {
    setProcessingAgentSpeech(true);
    try {
      const b64 = blob && blob.size > 0 ? await blobToBase64(blob) : "";
      const res = await fetch(`${API_BASE}/api/live-translator/translate-audio`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-ID": localStorage.getItem("current_user_id") || "admin"
        },
        body: JSON.stringify({
          audio_base64: b64,
          mime_type: mimeType.split(";")[0] || "audio/webm",
          direction: "agent_to_customer",
          source_lang: "tr",
          target_lang: customerLang,
          generate_tts: true,
          call_id: callId,
          fallback_stt_text: fallbackStt || ""
        })
      });

      if (!res.ok) return;
      const data = await res.json();
      if (!data.translated_text && !data.original_text) return;

      const newItem = {
        id: `tr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        direction: "agent_to_customer",
        sourceLang: "tr",
        targetLang: customerLang,
        originalText: data.original_text || fallbackStt || "",
        translatedText: data.translated_text || "",
        ttsAudioBase64: data.tts_audio_base64 || "",
        ttsMimeType: data.tts_mime_type || "audio/mpeg",
        timestamp: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      };

      setItems((prev) => [...prev, newItem]);

      if (newItem.ttsAudioBase64) {
        setPlayingItemId(newItem.id);
        setStatusBanner(
          `Müşterinin hattına ${selectedCustomerLangObj.flag} sesli çeviri iletiliyor: "${newItem.translatedText}"`
        );
        await webphoneManager.playAudioIntoActiveCallLine(newItem.ttsAudioBase64, newItem.ttsMimeType, true);
        setPlayingItemId(null);
        setStatusBanner("Sesli çeviri müşteriye iletildi.");
      }
    } catch (e) {
      console.error("[LiveTranslator] Agent speech translate error:", e);
    } finally {
      webphoneManager.setRawMicSuppressed(false);
      setProcessingAgentSpeech(false);
    }
  };

  // Translate Turkish text and optionally speak it directly into the customer's call line
  const handleSendAgentTextToCustomer = async (textToTranslate, speakIntoCall = true) => {
    const clean = String(textToTranslate || manualTurkishInput || "").trim();
    if (!clean) return;
    setProcessingAgentSpeech(true);
    if (textToTranslate === undefined) setManualTurkishInput("");

    try {
      const shouldSpeak = Boolean(canVoiceInterpret && speakIntoCall);
      const res = await fetch(`${API_BASE}/api/live-translator/translate-text`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-ID": localStorage.getItem("current_user_id") || "admin"
        },
        body: JSON.stringify({
          text: clean,
          direction: "agent_to_customer",
          source_lang: "tr",
          target_lang: customerLang,
          generate_tts: shouldSpeak,
          call_id: callId
        })
      });

      if (!res.ok) return;
      const data = await res.json();
      const newItem = {
        id: `tr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        direction: "agent_to_customer",
        sourceLang: "tr",
        targetLang: customerLang,
        originalText: clean,
        translatedText: data.translated_text || "",
        ttsAudioBase64: data.tts_audio_base64 || "",
        ttsMimeType: data.tts_mime_type || "audio/mpeg",
        timestamp: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      };

      setItems((prev) => [...prev, newItem]);

      if (shouldSpeak && newItem.ttsAudioBase64) {
        setPlayingItemId(newItem.id);
        setStatusBanner(
          `Müşterinin hattına ${selectedCustomerLangObj.flag} sesli çeviri iletiliyor: "${newItem.translatedText}"`
        );
        await webphoneManager.playAudioIntoActiveCallLine(newItem.ttsAudioBase64, newItem.ttsMimeType, true);
        setPlayingItemId(null);
        setStatusBanner("Sesli çeviri müşteriye iletildi.");
      }
    } catch (e) {
      console.error("[LiveTranslator] Text translate error:", e);
    } finally {
      setProcessingAgentSpeech(false);
    }
  };

  const replayItemIntoCallOrHeadset = async (item) => {
    if (!canVoiceInterpret) return;
    setPlayingItemId(item.id);
    try {
      if (item.direction === "customer_to_agent") {
        await playTurkishAudioToAgentHeadset(item.ttsAudioBase64, item.ttsMimeType, item.translatedText);
      } else {
        if (item.ttsAudioBase64) {
          await webphoneManager.playAudioIntoActiveCallLine(item.ttsAudioBase64, item.ttsMimeType, true);
        } else if (item.translatedText) {
          await handleSendAgentTextToCustomer(item.originalText, true);
        }
      }
    } finally {
      setPlayingItemId(null);
    }
  };

  if (!canLiveTranslate && !canVoiceInterpret) {
    return null;
  }

  return (
    <div
      className={`p-4 bg-white dark:bg-slate-900 border ${borderLight} rounded-3xl shadow-lg flex flex-col gap-3.5 animate-in fade-in duration-200`}
    >
      {/* Top Bar: Title, Language Selector & Mode Switches */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-xl ${lightBg} ${text}`}>
            <Languages size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-white">
                Canlı Konuşma Çevirisi & Simultane Tercüman
              </h4>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${lightBg} ${text} border ${border}`}>
                {selectedCustomerLangObj.flag} {selectedCustomerLangObj.code.toUpperCase()} ↔ 🇹🇷 TR
              </span>
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
              Müşterinin yabancı dil konuşmasını Türkçe metne/sese çevirir; Türkçe cevabınızı müşteriye kendi dilinde seslendirir.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Customer Foreign Language Selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Müşteri Dili:</span>
            <select
              value={customerLang}
              onChange={(e) => setCustomerLang(e.target.value)}
              className="bg-transparent text-xs font-extrabold text-slate-800 dark:text-white focus:outline-none cursor-pointer"
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-white">
                  {l.flag} {l.label}
                </option>
              ))}
            </select>
          </div>

          {/* Toggle Live Customer Speech Listening */}
          {canLiveTranslate && (
            <button
              type="button"
              onClick={() => (isListeningCustomer ? stopCustomerListener() : startCustomerListener())}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 border transition-all ${
                isListeningCustomer
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-200"
              }`}
              title="Müşterinin sesini anlık dinle ve Türkçe altyazıya dönüştür"
            >
              <Radio size={13} className={isListeningCustomer ? "animate-pulse" : ""} />
              <span>{isListeningCustomer ? "Müşteri Dinleniyor (Aktif)" : "Müşteriyi Dinle & Çevir"}</span>
            </button>
          )}

          {/* Toggle Simultaneous Turkish Voice Output to Agent Headset */}
          {canVoiceInterpret && (
            <button
              type="button"
              onClick={() => setAutoSpeakCustomerInTurkish((p) => !p)}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 border transition-all ${
                autoSpeakCustomerInTurkish
                  ? `${bg} text-white border-transparent shadow-sm`
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
              }`}
              title="Müşterinin yabancı dil konuşmasını kulaklığınıza Türkçe sesli olarak oku"
            >
              {autoSpeakCustomerInTurkish ? <Volume2 size={13} /> : <VolumeX size={13} />}
              <span>{autoSpeakCustomerInTurkish ? "Türkçe Sesli Tercüman: Açık" : "Türkçe Sesli Tercüman: Kapalı"}</span>
            </button>
          )}

          {items.length > 0 && (
            <button
              type="button"
              onClick={() => setItems([])}
              className="p-1.5 rounded-xl text-slate-400 hover:text-rose-500 border border-slate-200 dark:border-slate-800"
              title="Çeviri Geçmişini Temizle"
            >
              <Trash2 size={13} />
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              title="Paneli Gizle"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Status / Test Quick Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800/80 text-[11px]">
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 font-semibold">
          {(processingCustomerChunk || processingAgentSpeech) && (
            <Loader2 size={13} className={`animate-spin ${text}`} />
          )}
          <span>
            {statusBanner ||
              "Müşteri konuştuğunda Türkçe çevirisi aşağıda anlık görünür. Türkçe konuşup/yazıp müşteriye kendi dilinde ses gönderebilirsiniz."}
          </span>
        </div>

        {/* Quick simulation buttons for testing even without a foreign caller on the line */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-slate-400">Hızlı Test:</span>
          <button
            type="button"
            disabled={processingCustomerChunk}
            onClick={() =>
              simulateCustomerForeignPhrase(
                customerLang === "de"
                  ? "Guten Tag, ich möchte meine Reservierung für morgen ändern."
                  : customerLang === "ru"
                  ? "Здравствуйте, я хотел бы проверить статус моего заказа."
                  : customerLang === "ar"
                  ? "مرحباً، أود الاستفسار عن حالة طلبي وتغيير الموعد."
                  : "Hello, I would like to change my reservation date and check my invoice details."
              )
            }
            className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-all"
          >
            {selectedCustomerLangObj.flag} Örnek Müşteri Cümlesi Simüle Et
          </button>
        </div>
      </div>

      {/* Live Bilingual Translation Stream */}
      <div className="max-h-60 min-h-[150px] overflow-y-auto space-y-2.5 pr-1">
        {items.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
            Henüz çevrilen konuşma yok. <strong>&ldquo;Müşteriyi Dinle &amp; Çevir&rdquo;</strong> butonunu açın veya örnek cümle simüle edin.
          </div>
        ) : (
          items.map((item) => {
            const isCust = item.direction === "customer_to_agent";
            return (
              <div
                key={item.id}
                className={`p-3 rounded-2xl border transition-all ${
                  isCust
                    ? "bg-slate-50/90 dark:bg-slate-950/70 border-slate-200/80 dark:border-slate-800"
                    : `${lightBg} ${border}`
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                          isCust
                            ? "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300"
                            : `${bg} text-white`
                        }`}
                      >
                        {isCust
                          ? `${selectedCustomerLangObj.flag} Müşteri (${String(item.sourceLang).toUpperCase()} → TR)`
                          : `🇹🇷 Temsilci (TR → ${selectedCustomerLangObj.flag} ${String(item.targetLang).toUpperCase()})`}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">{item.timestamp}</span>
                    </div>

                    {/* Original Speech */}
                    <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                      &ldquo;{item.originalText}&rdquo;
                    </p>

                    {/* Translated Text (Prominent) */}
                    <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                      {isCust ? `🇹🇷 ${item.translatedText}` : `${selectedCustomerLangObj.flag} ${item.translatedText}`}
                    </p>
                  </div>

                  {/* Replay Audio Button */}
                  {canVoiceInterpret && (
                    <button
                      type="button"
                      onClick={() => replayItemIntoCallOrHeadset(item)}
                      disabled={playingItemId === item.id}
                      className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold flex items-center gap-1 shrink-0 border transition-all ${
                        playingItemId === item.id
                          ? `${bg} text-white border-transparent animate-pulse`
                          : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                      }`}
                      title={
                        isCust
                          ? "Türkçe sesli çeviriyi kulaklığımda tekrar dinle"
                          : "Bu çeviriyi müşterinin telefon hattına tekrar sesli dinlet"
                      }
                    >
                      <Volume2 size={12} />
                      <span>{isCust ? "Türkçe Dinle" : "Hatta Seslendir"}</span>
                    </button>
                  )}
                </div>

                {/* Smart Suggested Reply for Customer Turn */}
                {isCust && item.suggestedReplyTr && (
                  <div className="mt-2.5 pt-2 border-t border-slate-200/70 dark:border-slate-800/70 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[11px] text-slate-600 dark:text-slate-300">
                      <span className="font-extrabold text-emerald-600 dark:text-emerald-400 mr-1">
                        Önerilen Cevap (TR):
                      </span>
                      <span>{item.suggestedReplyTr}</span>
                      {item.suggestedReplyTarget && (
                        <span className="block text-[10px] text-slate-400 italic">
                          ({selectedCustomerLangObj.flag} {item.suggestedReplyTarget})
                        </span>
                      )}
                    </div>
                    {canVoiceInterpret && (
                      <button
                        type="button"
                        disabled={processingAgentSpeech}
                        onClick={() => handleSendAgentTextToCustomer(item.suggestedReplyTr, true)}
                        className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-extrabold flex items-center gap-1 shrink-0 shadow-sm transition-all"
                      >
                        <Play size={11} />
                        <span>Öneriyi Müşteriye Seslendir ({selectedCustomerLangObj.code.toUpperCase()})</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={feedEndRef} />
      </div>

      {/* Bottom Bar: Two-Way Voice & Text Interpreter (Agent Turkish -> Customer Foreign Audio/Text) */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        {canVoiceInterpret && (
          <button
            type="button"
            onClick={() => (isRecordingAgentSpeech ? stopAgentPushToTalk(false) : startAgentPushToTalk())}
            disabled={processingAgentSpeech}
            className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all shrink-0 shadow-sm ${
              isRecordingAgentSpeech
                ? "bg-rose-600 hover:bg-rose-500 text-white animate-pulse"
                : `${bg} ${hover} text-white`
            }`}
            title="Türkçe konuşun, sistem otomatik olarak müşterinin diline çevirip telefon hattına sesli okusun"
          >
            {isRecordingAgentSpeech ? <MicOff size={15} /> : <Mic size={15} />}
            <span>
              {isRecordingAgentSpeech
                ? `Kaydı Bitir & Müşteriye (${selectedCustomerLangObj.code.toUpperCase()}) Seslendir`
                : `TR Konuş → Müşteriye (${selectedCustomerLangObj.code.toUpperCase()}) Seslendir`}
            </span>
          </button>
        )}

        <div className="flex-1 flex items-center gap-2">
          <input
            type="text"
            value={manualTurkishInput}
            onChange={(e) => setManualTurkishInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && manualTurkishInput.trim()) {
                handleSendAgentTextToCustomer(manualTurkishInput, Boolean(canVoiceInterpret));
              }
            }}
            placeholder={`Türkçe mesaj yazın (Müşteriye ${selectedCustomerLangObj.label} çevrilip ${
              canVoiceInterpret ? "seslendirilir" : "gösterilir"
            })...`}
            className="flex-1 px-3.5 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white focus:outline-none"
          />
          <button
            type="button"
            disabled={!manualTurkishInput.trim() || processingAgentSpeech}
            onClick={() => handleSendAgentTextToCustomer(manualTurkishInput, Boolean(canVoiceInterpret))}
            className={`px-3.5 py-2 rounded-2xl text-xs font-extrabold flex items-center gap-1.5 text-white ${bg} ${hover} disabled:opacity-50 shrink-0 transition-all`}
          >
            <Send size={13} />
            <span>{canVoiceInterpret ? "Çevir & Hatta Seslendir" : "Çevir"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
