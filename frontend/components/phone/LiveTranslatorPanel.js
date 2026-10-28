import React, { useState, useEffect, useRef } from "react";
import {
  Languages,
  Radio,
  Loader2,
  X,
  Trash2,
  User,
  Volume2,
  VolumeX,
  Send,
  Keyboard,
  Sparkles
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

function encodeAudioBufferToWavBlob(audioBuffer) {
  const targetSampleRate = 16000;
  const numChannels = 1;
  const srcRate = audioBuffer.sampleRate || 48000;
  const rawData = audioBuffer.getChannelData(0);
  const ratio = srcRate / targetSampleRate;
  const newLength = Math.max(1, Math.round(rawData.length / ratio));
  const samples = new Int16Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const srcIdx = Math.min(rawData.length - 1, Math.floor(i * ratio));
    const s = Math.max(-1, Math.min(1, rawData[srcIdx] || 0));
    samples[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, targetSampleRate, true);
  view.setUint32(28, targetSampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    view.setInt16(offset, samples[i], true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}

async function convertRecordedBlobToWavOrFallback(blob, fallbackMime) {
  if (!blob || typeof window === "undefined") {
    return { blob, mimeType: fallbackMime || "audio/webm" };
  }
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return { blob, mimeType: fallbackMime || "audio/webm" };
    const arrayBuf = await blob.arrayBuffer();
    const ctx = new AudioCtx();
    try {
      const decoded = await ctx.decodeAudioData(arrayBuf.slice(0));
      const wavBlob = encodeAudioBufferToWavBlob(decoded);
      return { blob: wavBlob, mimeType: "audio/wav" };
    } finally {
      try {
        await ctx.close();
      } catch (e) {}
    }
  } catch (e) {
    return { blob, mimeType: fallbackMime || "audio/webm" };
  }
}

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

  const [isListeningCustomer, setIsListeningCustomer] = useState(false);
  const [items, setItems] = useState([]);
  const [processingCustomerChunk, setProcessingCustomerChunk] = useState(false);
  const [processingAgentSpeech, setProcessingAgentSpeech] = useState(false);

  // Voice Interpreter (Auto TTS) & Type-to-Speak modes (both can be toggled on/off live during a call)
  const [autoVoiceTts, setAutoVoiceTts] = useState(false);
  const [showTextInput, setShowTextInput] = useState(true);
  const [manualTrText, setManualTrText] = useState("");
  const [sendingManualText, setSendingManualText] = useState(false);
  const [playingTtsId, setPlayingTtsId] = useState(null);

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
  const agentAudioCtxRef = useRef(null);
  const agentFallbackMicStreamRef = useRef(null);
  const hasAttachedLocalStreamRef = useRef(false);
  const inFlightAgentReqRef = useRef(false);

  const feedEndRef = useRef(null);
  const lastCustomerTextRef = useRef("");
  const lastAgentTextRef = useRef("");
  const isListeningCustomerRef = useRef(true);
  const customerLangRef = useRef(customerLang);
  const autoVoiceTtsRef = useRef(autoVoiceTts);
  const isPlayingTtsRef = useRef(false);

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

  useEffect(() => {
    autoVoiceTtsRef.current = autoVoiceTts;
    if (callStatus !== "Idle" && isActiveInstance) {
      webphoneManager.setRawMicSuppressed(autoVoiceTts);
    } else {
      webphoneManager.setRawMicSuppressed(false);
    }
  }, [autoVoiceTts, callStatus, isActiveInstance]);

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
      webphoneManager.setRawMicSuppressed(false);
    } else if (canLiveTranslate || canVoiceInterpret) {
      startCustomerListener(true);
      webphoneManager.setRawMicSuppressed(autoVoiceTtsRef.current);
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
        if (!isListeningCustomerRef.current || isPlayingTtsRef.current) return;
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
            if (chunks.length === 0 || inFlightCustomerReqRef.current || isPlayingTtsRef.current) return;
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

      // Passive WebAudio keepalive consumer so Chromium pulls local mic frames continuously
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx && localStream) {
          const ctx = agentAudioCtxRef.current || new AudioCtx();
          if (ctx.state === "suspended") {
            ctx.resume().catch(() => {});
          }
          agentAudioCtxRef.current = ctx;
          const source = ctx.createMediaStreamSource(localStream);
          const keepAliveGain = ctx.createGain();
          keepAliveGain.gain.value = 0.00001;
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

      const recordAgentWindow = () => {
        if (!isListeningCustomerRef.current || isPlayingTtsRef.current) return;
        const currentLocal =
          webphoneManager.getActiveLocalStream() ||
          localStream ||
          agentFallbackMicStreamRef.current;
        if (!currentLocal) return;
        const tracks = currentLocal.getAudioTracks ? currentLocal.getAudioTracks() : [];
        const liveTrack = tracks.find((t) => t.enabled && t.readyState === "live") || tracks[0];
        if (!liveTrack || !liveTrack.enabled) return;

        try {
          const streamForRecorder = new MediaStream([liveTrack.clone()]);
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
            if (chunks.length === 0 || inFlightAgentReqRef.current || isPlayingTtsRef.current) return;
            const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
            if (blob.size < 300) return;
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
    let localStream = webphoneManager.getActiveLocalStream();

    if (!localStream && typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
      try {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        agentFallbackMicStreamRef.current = micStream;
        localStream = micStream;
      } catch (micErr) {
        console.warn("[LiveTranslator] Fallback mic stream warning:", micErr);
      }
    }

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
        const lStream = webphoneManager.getActiveLocalStream() || agentFallbackMicStreamRef.current;
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
    if (agentFallbackMicStreamRef.current) {
      try {
        agentFallbackMicStreamRef.current.getTracks().forEach((t) => t.stop());
      } catch (e) {}
      agentFallbackMicStreamRef.current = null;
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
      const converted = await convertRecordedBlobToWavOrFallback(blob, mimeType);
      const b64 = await blobToBase64(converted.blob);
      const res = await fetch(`${API_BASE}/api/live-translator/translate-audio`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-ID": localStorage.getItem("current_user_id") || "admin"
        },
        body: JSON.stringify({
          audio_base64: b64,
          mime_type: (converted.mimeType || "audio/wav").split(";")[0],
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
        suggestedReplyTr: data.suggested_reply_tr || "",
        suggestedReplyTarget: data.suggested_reply_target || "",
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

  const playTtsIntoCall = async (ttsB64, ttsMime = "audio/mpeg", itemId = null) => {
    if (!ttsB64) return;
    isPlayingTtsRef.current = true;
    if (itemId) setPlayingTtsId(itemId);
    try {
      await webphoneManager.playAudioIntoActiveCallLine(ttsB64, ttsMime || "audio/mpeg", true);
    } catch (err) {
      console.error("[LiveTranslator] playTtsIntoCall error:", err);
    } finally {
      setTimeout(() => {
        isPlayingTtsRef.current = false;
        setPlayingTtsId(null);
      }, 350);
    }
  };

  const handleSpeakBubbleToCustomer = async (item, customTargetText = null) => {
    const activeTargetLang = item?.targetLang && item.targetLang !== "tr" ? item.targetLang : customerLangRef.current || customerLang;
    const textToSpeak = String(customTargetText || item?.translatedText || item?.originalText || "").trim();
    if (!textToSpeak) return;

    const bubbleId = item?.id || `tts-${Date.now()}`;
    if (item?.ttsAudioBase64 && !customTargetText) {
      await playTtsIntoCall(item.ttsAudioBase64, item.ttsMimeType || "audio/mpeg", bubbleId);
      return;
    }

    setPlayingTtsId(bubbleId);
    try {
      const res = await fetch(`${API_BASE}/api/live-translator/tts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-ID": localStorage.getItem("current_user_id") || "admin"
        },
        body: JSON.stringify({
          text: textToSpeak,
          lang: activeTargetLang
        })
      });
      if (!res.ok) {
        setPlayingTtsId(null);
        return;
      }
      const data = await res.json();
      if (data?.tts_audio_base64) {
        await playTtsIntoCall(data.tts_audio_base64, data.tts_mime_type || "audio/mpeg", bubbleId);
      } else {
        setPlayingTtsId(null);
      }
    } catch (err) {
      console.error("[LiveTranslator] TTS speak error:", err);
      setPlayingTtsId(null);
    }
  };

  const handleSendManualTrText = async (e, overrideTrText = null) => {
    if (e && typeof e.preventDefault === "function") e.preventDefault();
    const cleanTr = String(overrideTrText !== null ? overrideTrText : manualTrText || "").trim();
    if (!cleanTr || sendingManualText) return;

    if (overrideTrText === null) {
      setManualTrText("");
    }
    setSendingManualText(true);
    const activeTargetLang = customerLangRef.current || customerLang;

    try {
      const res = await fetch(`${API_BASE}/api/live-translator/translate-text`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-ID": localStorage.getItem("current_user_id") || "admin"
        },
        body: JSON.stringify({
          text: cleanTr,
          direction: "agent_to_customer",
          source_lang: "tr",
          target_lang: activeTargetLang,
          generate_tts: true,
          call_id: callId
        })
      });

      if (!res.ok) return;
      const data = await res.json();
      const newItem = {
        id: `tr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        direction: "agent_to_customer",
        sourceLang: "tr",
        targetLang: activeTargetLang,
        originalText: cleanTr,
        translatedText: data.translated_text || cleanTr,
        ttsAudioBase64: data.tts_audio_base64 || "",
        ttsMimeType: data.tts_mime_type || "audio/mpeg",
        timestamp: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      };

      emitLiveTurn(newItem);

      if (data.tts_audio_base64) {
        await playTtsIntoCall(data.tts_audio_base64, data.tts_mime_type || "audio/mpeg", newItem.id);
      }
    } catch (err) {
      console.error("[LiveTranslator] Manual text translate & TTS error:", err);
    } finally {
      setSendingManualText(false);
    }
  };

  const processAgentAudioBlob = async (blob, mimeType) => {
    setProcessingAgentSpeech(true);
    try {
      const converted = await convertRecordedBlobToWavOrFallback(blob, mimeType);
      const b64 = converted.blob && converted.blob.size > 0 ? await blobToBase64(converted.blob) : "";
      const activeTargetLang = customerLangRef.current || customerLang;
      const shouldAutoSpeakTts = Boolean(autoVoiceTtsRef.current);
      const res = await fetch(`${API_BASE}/api/live-translator/translate-audio`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-ID": localStorage.getItem("current_user_id") || "admin"
        },
        body: JSON.stringify({
          audio_base64: b64,
          mime_type: (converted.mimeType || "audio/wav").split(";")[0],
          direction: "agent_to_customer",
          source_lang: "tr",
          target_lang: activeTargetLang,
          generate_tts: shouldAutoSpeakTts,
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
        ttsAudioBase64: data.tts_audio_base64 || "",
        ttsMimeType: data.tts_mime_type || "audio/mpeg",
        timestamp: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      };

      emitLiveTurn(newItem);

      if (shouldAutoSpeakTts && data.tts_audio_base64) {
        await playTtsIntoCall(data.tts_audio_base64, data.tts_mime_type || "audio/mpeg", newItem.id);
      }
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
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
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
          {(processingCustomerChunk || processingAgentSpeech || sendingManualText) && (
            <Loader2 size={13} className={`animate-spin ${text}`} />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* Toggle 1: Auto Voice TTS Interpreter Mode (Temsilci Türkçe konuştuğunda otomatik yabancı dilde müşteriye seslendirir) */}
          {canVoiceInterpret && (
            <button
              type="button"
              onClick={() => setAutoVoiceTts((prev) => !prev)}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-xl text-[10px] font-extrabold border transition-all ${
                autoVoiceTts
                  ? `${bg} text-white border-transparent shadow-sm`
                  : "bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
              title={
                autoVoiceTts
                  ? "Otomatik Sesli Tercüman AÇIK: Türkçe konuşmanız müşteriye kendi dilinde sesli (TTS) okunur"
                  : "Otomatik Sesli Tercüman KAPALI: Açmak için tıklayın"
              }
            >
              {autoVoiceTts ? <Volume2 size={12} /> : <VolumeX size={12} />}
              <span>Oto. Sesli Çeviri: {autoVoiceTts ? "Açık" : "Kapalı"}</span>
            </button>
          )}

          {/* Toggle 2: Type-to-Speak Input Bar Toggle (Türkçe yazıp müşteriye yabancı dilde seslendirme kutusunu aç/kapat) */}
          {canVoiceInterpret && (
            <button
              type="button"
              onClick={() => setShowTextInput((prev) => !prev)}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-xl text-[10px] font-extrabold border transition-all ${
                showTextInput
                  ? `${lightBg} ${text} ${borderLight}`
                  : "bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700"
              }`}
              title="Yazarak Çevir & Müşteriye Seslendir alanını aç/kapat"
            >
              <Keyboard size={12} />
              <span>Yazarak Seslendir</span>
            </button>
          )}

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

      {/* Chat-Style Stream: Left = Customer, Right = Agent (Müşteri Temsilcisi) */}
      <div className="max-h-72 min-h-[160px] overflow-y-auto flex flex-col gap-2.5 px-1 py-1 bg-slate-50/40 dark:bg-slate-950/30 rounded-xl">
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
            const srcBadgeCode = String(item.sourceLang || customerLang || "EN")
              .split("-")[0]
              .toUpperCase();
            const tgtBadgeCode = String(item.targetLang || customerLang || "EN")
              .split("-")[0]
              .toUpperCase();
            const isSpeakingThis = playingTtsId === item.id;

            if (isCust) {
              // LEFT SIDE: Customer's speech (Turkish translation shown as main bold text, original foreign in italic below)
              const mainTurkishText = transClean || origClean;
              const langBadge = `${srcBadgeCode} → TR`;
              return (
                <div key={item.id} className="flex flex-col items-start gap-1">
                  <div className="max-w-[85%] rounded-2xl rounded-tl-sm px-3.5 py-2.5 border shadow-sm bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1 text-amber-600 dark:text-amber-400">
                        <User size={11} />
                        Müşteri
                      </span>
                      <div className="flex items-center gap-1.5">
                        {hasDifferentTranslation && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                            <Languages size={10} />
                            {langBadge}
                          </span>
                        )}
                        <span className="text-[9px] text-slate-400 font-mono">{item.timestamp}</span>
                      </div>
                    </div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-snug whitespace-pre-line break-words">
                      {mainTurkishText}
                    </p>
                    {hasDifferentTranslation && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 italic mt-1 pt-1 border-t border-slate-100 dark:border-slate-800/70 leading-snug break-words">
                        &ldquo;{origClean}&rdquo;
                      </p>
                    )}

                    {/* Quick 1-Click Suggested Reply TTS Button if AI suggested a response */}
                    {canVoiceInterpret && item.suggestedReplyTr && (
                      <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 truncate">
                          <Sparkles size={10} className="text-amber-500 shrink-0" />
                          <span className="truncate" title={item.suggestedReplyTr}>
                            Öneri: {item.suggestedReplyTr}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleSendManualTrText(null, item.suggestedReplyTr)}
                          disabled={sendingManualText}
                          className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold ${lightBg} ${text} border ${borderLight} hover:opacity-90 transition-opacity`}
                          title="Bu Türkçe yanıtı çevirip müşteriye kendi dilinde sesli okut"
                        >
                          <Volume2 size={10} />
                          <span>Seslendir</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            // RIGHT SIDE: Agent's speech (Turkish shown as main bold text, translated foreign in italic below)
            const mainAgentText = origClean || transClean;
            const langBadge = `TR → ${tgtBadgeCode}`;
            return (
              <div key={item.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-tr-sm px-3.5 py-2.5 border shadow-sm bg-indigo-50/90 dark:bg-indigo-950/40 border-indigo-200/80 dark:border-indigo-800/60">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
                      <User size={11} />
                      Müşteri Temsilcisi
                    </span>
                    <div className="flex items-center gap-1.5">
                      {hasDifferentTranslation && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                          <Languages size={10} />
                          {langBadge}
                        </span>
                      )}
                      {canVoiceInterpret && (transClean || origClean) && (
                        <button
                          type="button"
                          onClick={() => handleSpeakBubbleToCustomer(item)}
                          disabled={isSpeakingThis}
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-extrabold border transition-all ${
                            isSpeakingThis
                              ? "bg-emerald-500 text-white border-emerald-500 animate-pulse"
                              : "bg-white/80 dark:bg-slate-800 text-indigo-600 dark:text-indigo-300 border-indigo-200 dark:border-indigo-700 hover:bg-indigo-100"
                          }`}
                          title={`Müşteriye ${selectedCustomerLangObj.label} sesli okut (TTS)`}
                        >
                          <Volume2 size={10} />
                          <span>{isSpeakingThis ? "Okunuyor..." : "Dinlet"}</span>
                        </button>
                      )}
                      <span className="text-[9px] text-slate-400 font-mono">{item.timestamp}</span>
                    </div>
                  </div>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-snug whitespace-pre-line break-words">
                    {mainAgentText}
                  </p>
                  {hasDifferentTranslation && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 italic mt-1 pt-1 border-t border-indigo-200/60 dark:border-indigo-800/50 leading-snug break-words">
                      &ldquo;{transClean}&rdquo;
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={feedEndRef} />
      </div>

      {/* Mode 2: Type Turkish -> Translate & Speak Foreign TTS Directly Into Active Call */}
      {canVoiceInterpret && showTextInput && (
        <form
          onSubmit={(e) => handleSendManualTrText(e, null)}
          className="flex items-center gap-2 pt-1.5 border-t border-slate-100 dark:border-slate-800"
        >
          <input
            type="text"
            value={manualTrText}
            onChange={(e) => setManualTrText(e.target.value)}
            placeholder={`Türkçe yanıt yazın (${selectedCustomerLangObj.flag} ${selectedCustomerLangObj.code.toUpperCase()} sesli okunur)...`}
            className="flex-1 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={!manualTrText.trim() || sendingManualText}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold text-white ${bg} ${hover} disabled:opacity-50 transition-all shrink-0`}
            title={`Türkçe metni ${selectedCustomerLangObj.label} diline çevirip telefon hattından müşteriye sesli okut`}
          >
            {sendingManualText ? <Loader2 size={13} className="animate-spin" /> : <Volume2 size={13} />}
            <span>Çevir &amp; Seslendir</span>
          </button>
          {manualTrText.trim() && (
            <button
              type="button"
              onClick={() => handleSendManualTrText(null, manualTrText)}
              disabled={sendingManualText}
              className="hidden"
              aria-hidden="true"
            />
          )}
        </form>
      )}
    </div>
  );
}
