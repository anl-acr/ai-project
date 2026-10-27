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
  isActiveInstance = true,
  onClose = null
}) {
  const { bg, hover, text, border, lightBg, borderLight } = useTheme();

  const [customerLang, setCustomerLang] = useState("en");
  const [agentLang] = useState("tr");

  // Modes
  const [isListeningCustomer, setIsListeningCustomer] = useState(false);
  const [autoSpeakCustomerInTurkish, setAutoSpeakCustomerInTurkish] = useState(Boolean(canVoiceInterpret));
  const [autoHandsFreeAgentMic, setAutoHandsFreeAgentMic] = useState(Boolean(canVoiceInterpret));
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

  // Refs for Hands-Free Agent Mic recorder
  const agentHandsFreeIntervalRef = useRef(null);
  const agentHandsFreeRecorderRef = useRef(null);
  const hasAttachedLocalStreamRef = useRef(false);
  const inFlightAgentReqRef = useRef(false);

  // Refs for Agent manual push-to-talk recorder + SpeechRecognition fallback
  const agentMediaRecorderRef = useRef(null);
  const agentMicStreamRef = useRef(null);
  const agentChunksRef = useRef([]);
  const agentSpeechRecRef = useRef(null);
  const agentSttTranscriptRef = useRef("");
  const feedEndRef = useRef(null);

  // Echo guard while TTS is playing into headset or into call line
  const isPlayingTtsRef = useRef(false);
  const lastCustomerTextRef = useRef("");
  const lastAgentTextRef = useRef("");
  const isListeningCustomerRef = useRef(true);
  const isRecordingAgentRef = useRef(false);
  const autoHandsFreeAgentRef = useRef(Boolean(canVoiceInterpret));
  const customerLangRef = useRef(customerLang);
  const ambientCustomerSpeechRecRef = useRef(null);

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
    isRecordingAgentRef.current = isRecordingAgentSpeech;
  }, [isRecordingAgentSpeech]);

  useEffect(() => {
    autoHandsFreeAgentRef.current = autoHandsFreeAgentMic;
  }, [autoHandsFreeAgentMic]);

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
      stopAgentPushToTalk(true);
      webphoneManager.setRemoteAudioDucking(false);
      webphoneManager.setRawMicSuppressed(false);
    };
  }, []);

  // Automatically start/attach listeners when call is active on the visible instance, and stop when Idle
  useEffect(() => {
    if (callStatus === "Idle" || !isActiveInstance) {
      stopCustomerListener();
      stopAgentPushToTalk(true);
    } else if (canLiveTranslate || canVoiceInterpret) {
      startCustomerListener(true);
    }
  }, [callStatus, canLiveTranslate, canVoiceInterpret, isActiveInstance]);

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

  // Helper: Encode Float32 PCM chunks into a peak-normalized 16kHz 16-bit Mono RIFF WAV Blob
  const encodeWavFromFloat32Chunks = (chunks, inputSampleRate = 48000, targetRate = 16000) => {
    let totalLen = 0;
    for (const c of chunks) totalLen += c.length;
    if (totalLen === 0) return null;

    const merged = new Float32Array(totalLen);
    let offset = 0;
    let peak = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      for (let i = 0; i < c.length; i++) {
        const abs = Math.abs(c[i]);
        if (abs > peak) peak = abs;
      }
      offset += c.length;
    }

    const gain = peak > 0.002 && peak < 0.5 ? Math.min(6.0, 0.8 / peak) : 1.0;
    const ratio = inputSampleRate / targetRate;
    const outLength = Math.max(1, Math.floor(merged.length / ratio));
    const buffer = new ArrayBuffer(44 + outLength * 2);
    const view = new DataView(buffer);

    const writeStr = (pos, str) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(pos + i, str.charCodeAt(i));
      }
    };

    writeStr(0, "RIFF");
    view.setUint32(4, 36 + outLength * 2, true);
    writeStr(8, "WAVE");
    writeStr(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, targetRate, true);
    view.setUint32(28, targetRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, "data");
    view.setUint32(40, outLength * 2, true);

    let byteOffset = 44;
    for (let i = 0; i < outLength; i++) {
      const srcIdx = Math.min(merged.length - 1, Math.floor(i * ratio));
      const s = Math.max(-1, Math.min(1, merged[srcIdx] * gain));
      view.setInt16(byteOffset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      byteOffset += 2;
    }

    return new Blob([buffer], { type: "audio/wav" });
  };

  // Convert a MediaRecorder WebM/Opus blob into a 16kHz 16-bit WAV blob (with RMS silence check), or fallback to original blob
  const convertRecordedBlobToWavOrFallback = async (recordedBlob, minRms = 0.0018) => {
    if (!recordedBlob || recordedBlob.size < 600) return null;
    try {
      const ctx =
        webphoneManager.getUnlockedAudioContext() ||
        customerAudioCtxRef.current ||
        new (window.AudioContext || window.webkitAudioContext)();
      customerAudioCtxRef.current = ctx;
      const arrBuf = await recordedBlob.arrayBuffer();
      const audioBuf = await ctx.decodeAudioData(arrBuf.slice(0));
      const ch0 = audioBuf.getChannelData(0);
      if (!ch0 || ch0.length === 0) return { blob: recordedBlob, mimeType: recordedBlob.type || "audio/webm" };

      let sumSq = 0;
      let peak = 0;
      for (let i = 0; i < ch0.length; i++) {
        const v = ch0[i];
        sumSq += v * v;
        const a = Math.abs(v);
        if (a > peak) peak = a;
      }
      const rms = Math.sqrt(sumSq / ch0.length);
      if (rms < minRms || peak < minRms * 2.5) {
        return null; // True silence
      }
      const wavBlob = encodeWavFromFloat32Chunks([ch0], audioBuf.sampleRate || 48000, 16000);
      if (wavBlob && wavBlob.size > 1000) {
        return { blob: wavBlob, mimeType: "audio/wav" };
      }
    } catch (e) {
      // If decodeAudioData fails on this browser, send the raw MediaRecorder blob so backend ffmpeg decodes it
    }
    return { blob: recordedBlob, mimeType: recordedBlob.type || "audio/webm" };
  };

  // Play Turkish TTS audio into the agent's headset while ducking customer's raw audio
  const playTurkishAudioToAgentHeadset = async (audioBase64, mimeType = "audio/mpeg", fallbackText = "") => {
    if (!canVoiceInterpret) return;
    isPlayingTtsRef.current = true;
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
      setTimeout(() => {
        isPlayingTtsRef.current = false;
      }, 450);
    }
  };

  const emitLiveTurn = (newItem) => {
    setItems((prev) => (prev.some((x) => x.id === newItem.id) ? prev : [...prev, newItem]));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("LIVE_TRANSLATOR_SYNC_ITEM", { detail: newItem }));
      const speaker = newItem.direction === "customer_to_agent" ? "customer" : "human";
      const src = String(newItem.sourceLang || customerLang || "EN").toUpperCase();
      const tgt = String(newItem.targetLang || agentLang || "TR").toUpperCase();
      window.dispatchEvent(
        new CustomEvent("LIVE_TRANSLATION_TURN", {
          detail: {
            speaker,
            text: `[${src} -> ${tgt}] ${newItem.translatedText} (${newItem.originalText})`
          }
        })
      );
    }
  };

  // Attach slice-based MediaRecorder to incoming customer WebRTC stream (Direct WebM streaming, never blocked by AudioContext)
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
            if (chunks.length === 0 || isPlayingTtsRef.current || inFlightCustomerReqRef.current) return;
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
          }, 3100);
        } catch (err) {
          console.error("[LiveTranslator] Customer recorder window error:", err);
        }
      };

      hasAttachedStreamRef.current = true;
      console.log("[LiveTranslator] Attached MediaRecorder (direct WebM) to customer WebRTC remote stream");
      recordWindow();
      customerCaptureIntervalRef.current = setInterval(recordWindow, 3300);

      setStatusBanner(
        "Çift yönlü canlı tercüman aktif: Müşteri konuşması Türkçeye, sizin Türkçe konuşmanız müşterinin diline anlık çevriliyor..."
      );
    } catch (err) {
      console.error("[LiveTranslator] attachRecorderToRemoteStream error:", err);
    }
  };

  // Attach hands-free slice-based MediaRecorder to agent's local WebRTC microphone stream
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
        if (!isListeningCustomerRef.current || !autoHandsFreeAgentRef.current || isRecordingAgentRef.current) return;
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
            if (
              chunks.length === 0 ||
              !autoHandsFreeAgentRef.current ||
              isRecordingAgentRef.current ||
              isPlayingTtsRef.current ||
              inFlightAgentReqRef.current
            ) {
              return;
            }
            const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
            if (blob.size < 400) return;
            inFlightAgentReqRef.current = true;
            try {
              await translateAndSpeakAgentAudioToCustomer(blob, recorder.mimeType || "audio/webm", "", true);
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
          }, 3200);
        } catch (err) {
          console.warn("[LiveTranslator] Agent hands-free slice warning:", err);
        }
      };

      hasAttachedLocalStreamRef.current = true;
      console.log("[LiveTranslator] Attached hands-free MediaRecorder to agent WebRTC microphone stream");
      recordAgentWindow();
      agentHandsFreeIntervalRef.current = setInterval(recordAgentWindow, 3400);
    } catch (err) {
      console.warn("[LiveTranslator] attachHandsFreeRecorderToLocalStream error:", err);
    }
  };

  // Start capturing customer's incoming WebRTC audio stream + agent hands-free mic stream
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
    if (localStream && canVoiceInterpret) {
      attachHandsFreeRecorderToLocalStream(localStream);
    }

    if (remoteStream && (localStream || !canVoiceInterpret)) {
      if (customerStreamWaitIntervalRef.current) {
        clearInterval(customerStreamWaitIntervalRef.current);
        customerStreamWaitIntervalRef.current = null;
      }
      return;
    }

    setStatusBanner(
      "Canlı çeviri aktif ve dinlemede... Görüşme bağlandığında hem müşterinin konuşması hem de sizin konuşmanız otomatik çevrilir."
    );

    if (!customerStreamWaitIntervalRef.current) {
      customerStreamWaitIntervalRef.current = setInterval(() => {
        const rStream = webphoneManager.getActiveRemoteStream();
        const lStream = webphoneManager.getActiveLocalStream();
        if (rStream && !hasAttachedStreamRef.current) {
          attachRecorderToRemoteStream(rStream);
        }
        if (lStream && canVoiceInterpret && !hasAttachedLocalStreamRef.current) {
          attachHandsFreeRecorderToLocalStream(lStream);
        }
        if (hasAttachedStreamRef.current && (hasAttachedLocalStreamRef.current || !canVoiceInterpret)) {
          clearInterval(customerStreamWaitIntervalRef.current);
          customerStreamWaitIntervalRef.current = null;
        }
      }, 800);
    }
  };

  const stopCustomerListener = () => {
    isListeningCustomerRef.current = false;
    if (ambientCustomerSpeechRecRef.current) {
      try {
        ambientCustomerSpeechRecRef.current.onend = null;
        ambientCustomerSpeechRecRef.current.stop();
      } catch (e) {}
      ambientCustomerSpeechRecRef.current = null;
    }
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
    if (inFlightCustomerReqRef.current || isPlayingTtsRef.current) return;
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
          mime_type: (mimeType || "audio/webm").split(";")[0],
          direction: "customer_to_agent",
          source_lang: customerLangRef.current || customerLang,
          target_lang: agentLang,
          generate_tts: shouldTts,
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

      const resolvedDir = data.direction || "customer_to_agent";
      const resolvedSrc = data.source_lang || data.detected_lang || customerLangRef.current || customerLang;
      const resolvedTgt = data.target_lang || (resolvedDir === "agent_to_customer" ? (customerLangRef.current || customerLang) : agentLang);

      const newItem = {
        id: `tr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        direction: resolvedDir,
        sourceLang: resolvedSrc,
        targetLang: resolvedTgt,
        originalText: data.original_text || "",
        translatedText: data.translated_text || "",
        suggestedReplyTr: data.suggested_reply_tr || "",
        suggestedReplyTarget: data.suggested_reply_target || "",
        ttsAudioBase64: data.tts_audio_base64 || "",
        ttsMimeType: data.tts_mime_type || "audio/mpeg",
        timestamp: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      };

      emitLiveTurn(newItem);

      if (shouldTts && newItem.translatedText) {
        if (resolvedDir === "agent_to_customer" && newItem.ttsAudioBase64) {
          isPlayingTtsRef.current = true;
          setPlayingItemId(newItem.id);
          try {
            await webphoneManager.playAudioIntoActiveCallLine(newItem.ttsAudioBase64, newItem.ttsMimeType, true);
          } finally {
            setPlayingItemId(null);
            setTimeout(() => {
              isPlayingTtsRef.current = false;
            }, 450);
          }
        } else {
          await playTurkishAudioToAgentHeadset(newItem.ttsAudioBase64, newItem.ttsMimeType, newItem.translatedText);
        }
      }
    } catch (e) {
      console.error("[LiveTranslator] Customer chunk translate error:", e);
    } finally {
      inFlightCustomerReqRef.current = false;
      setProcessingCustomerChunk(false);
    }
  };

  // Simulate customer speaking foreign language (also used by demo buttons)
  const simulateCustomerForeignPhrase = async (sampleText) => {
    setProcessingCustomerChunk(true);
    try {
      const activeSrcLang = customerLangRef.current || customerLang;
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
          source_lang: activeSrcLang,
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
        sourceLang: activeSrcLang,
        targetLang: agentLang,
        originalText: data.original_text || sampleText,
        translatedText: data.translated_text || "",
        suggestedReplyTr: data.suggested_reply_tr || "",
        suggestedReplyTarget: data.suggested_reply_target || "",
        ttsAudioBase64: data.tts_audio_base64 || "",
        ttsMimeType: data.tts_mime_type || "audio/mpeg",
        timestamp: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      };
      emitLiveTurn(newItem);

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
      isRecordingAgentRef.current = true;
      webphoneManager.setRawMicSuppressed(true);
      agentSttTranscriptRef.current = "";

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

      // Prefer active call's local stream first so we never trigger unnecessary mic permission errors
      const existingCallMic = webphoneManager.getActiveLocalStream();
      const baseStream = existingCallMic || (await webphoneManager.acquireAudioStreamWithFallback());
      const tracks = baseStream.getAudioTracks ? baseStream.getAudioTracks() : [];
      const stream = tracks.length > 0 ? new MediaStream([tracks[0].clone()]) : baseStream;
      agentMicStreamRef.current = stream;
      agentChunksRef.current = [];

      const preferredMime =
        typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";

      const recorder = preferredMime ? new MediaRecorder(stream, { mimeType: preferredMime }) : new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          agentChunksRef.current.push(e.data);
        }
      };
      recorder.start(250);
      agentMediaRecorderRef.current = recorder;

      setIsRecordingAgentSpeech(true);
      setStatusBanner(
        `Türkçe konuşun... Bitirdiğinizde '${selectedCustomerLangObj.label}' sesli çeviri doğrudan müşterinin telefon hattına iletilecek.`
      );
    } catch (err) {
      console.error("[LiveTranslator] Agent mic error:", err);
      isRecordingAgentRef.current = false;
      webphoneManager.setRawMicSuppressed(false);
      setStatusBanner("Mikrofon erişimi sağlanamadı.");
    }
  };

  const stopAgentPushToTalk = async (cancelOnly = false) => {
    isRecordingAgentRef.current = false;
    if (agentSpeechRecRef.current) {
      try {
        agentSpeechRecRef.current.stop();
      } catch (e) {}
      agentSpeechRecRef.current = null;
    }

    const recorder = agentMediaRecorderRef.current;
    agentMediaRecorderRef.current = null;
    if (recorder && recorder.state === "recording") {
      await new Promise((resolve) => {
        recorder.onstop = resolve;
        try {
          recorder.stop();
        } catch (e) {
          resolve();
        }
      });
    }

    if (agentMicStreamRef.current) {
      try {
        agentMicStreamRef.current.getTracks().forEach((t) => t.stop());
      } catch (e) {}
      agentMicStreamRef.current = null;
    }

    setIsRecordingAgentSpeech(false);

    if (cancelOnly) {
      agentChunksRef.current = [];
      agentSttTranscriptRef.current = "";
      webphoneManager.setRawMicSuppressed(false);
      return;
    }

    await new Promise((r) => setTimeout(r, 200));

    const recordedChunks = [...agentChunksRef.current];
    const fallbackStt = agentSttTranscriptRef.current;
    agentChunksRef.current = [];
    agentSttTranscriptRef.current = "";

    const rawBlob = recordedChunks.length > 0 ? new Blob(recordedChunks, { type: "audio/webm" }) : null;
    if (!rawBlob && !fallbackStt) {
      webphoneManager.setRawMicSuppressed(false);
      return;
    }

    await translateAndSpeakAgentAudioToCustomer(rawBlob, "audio/webm", fallbackStt, false);
  };

  const translateAndSpeakAgentAudioToCustomer = async (blob, mimeType, fallbackStt = "", isHandsFree = false) => {
    if (isPlayingTtsRef.current) return;
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
          generate_tts: true,
          call_id: callId,
          fallback_stt_text: fallbackStt || ""
        })
      });

      if (!res.ok) return;
      const data = await res.json();
      if (!data.translated_text && !data.original_text) return;

      if (
        isHandsFree &&
        data.original_text &&
        lastAgentTextRef.current &&
        data.original_text.trim().toLowerCase() === lastAgentTextRef.current.trim().toLowerCase()
      ) {
        return;
      }
      if (data.original_text) {
        lastAgentTextRef.current = data.original_text.trim();
      }

      const resolvedDir = data.direction || "agent_to_customer";
      const resolvedSrc = data.source_lang || "tr";
      const resolvedTgt = data.target_lang || activeTargetLang;

      const newItem = {
        id: `tr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        direction: resolvedDir,
        sourceLang: resolvedSrc,
        targetLang: resolvedTgt,
        originalText: data.original_text || fallbackStt || "",
        translatedText: data.translated_text || "",
        ttsAudioBase64: data.tts_audio_base64 || "",
        ttsMimeType: data.tts_mime_type || "audio/mpeg",
        timestamp: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      };

      emitLiveTurn(newItem);

      if (newItem.ttsAudioBase64) {
        isPlayingTtsRef.current = true;
        setPlayingItemId(newItem.id);
        setStatusBanner(
          `Müşterinin hattına ${selectedCustomerLangObj.flag} sesli çeviri iletiliyor: "${newItem.translatedText}"`
        );
        try {
          if (resolvedDir === "customer_to_agent") {
            await playTurkishAudioToAgentHeadset(newItem.ttsAudioBase64, newItem.ttsMimeType, newItem.translatedText);
          } else {
            await webphoneManager.playAudioIntoActiveCallLine(newItem.ttsAudioBase64, newItem.ttsMimeType, true);
          }
        } finally {
          setPlayingItemId(null);
          setTimeout(() => {
            isPlayingTtsRef.current = false;
          }, 450);
        }
        setStatusBanner("Sesli çeviri müşteriye iletildi.");
      }
    } catch (e) {
      console.error("[LiveTranslator] Agent speech translate error:", e);
    } finally {
      if (!isHandsFree) {
        webphoneManager.setRawMicSuppressed(false);
      }
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

      emitLiveTurn(newItem);

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

          {/* Toggle Hands-Free Automatic Agent Microphone Translation (TR -> Foreign Voice) */}
          {canVoiceInterpret && (
            <button
              type="button"
              onClick={() => setAutoHandsFreeAgentMic((p) => !p)}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 border transition-all ${
                autoHandsFreeAgentMic
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
              }`}
              title="Görüşme sırasında butona basmadan konuştuğunuz Türkçe cümleleri otomatik olarak müşterinin diline çevirip hatta seslendir"
            >
              {autoHandsFreeAgentMic ? <Mic size={13} /> : <MicOff size={13} />}
              <span>{autoHandsFreeAgentMic ? "Otomatik Mikrofon Çevirisi: Açık" : "Otomatik Mikrofon Çevirisi: Kapalı"}</span>
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
