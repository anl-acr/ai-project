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
  Keyboard,
  Sparkles,
  Headphones,
  PhoneOutgoing
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

const TTS_OUTPUT_MODES = [
  {
    id: "customer_only",
    label: "Sadece Müşteri",
    icon: PhoneOutgoing,
    desc: "Çevrilen sesi sadece hattaki müşteri duysun (sizin kulaklığınıza gelmez)"
  },
  {
    id: "both",
    label: "Müşteri + Ben",
    icon: Volume2,
    desc: "Çevrilen sesi hem hattaki müşteri hem siz duyun"
  },
  {
    id: "agent_only",
    label: "Sadece Ben",
    icon: Headphones,
    desc: "Çevrilen sesi sadece siz duyun (müşteriye gitmez - ön dinleme)"
  }
];

function downsampleFloat32ToInt16(float32Buf, srcRate, targetRate = 16000) {
  if (!float32Buf || float32Buf.length === 0) return new Int16Array(0);
  if (srcRate === targetRate) {
    const out = new Int16Array(float32Buf.length);
    for (let i = 0; i < float32Buf.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Buf[i] || 0));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
  }
  const ratio = srcRate / targetRate;
  const newLength = Math.max(1, Math.round(float32Buf.length / ratio));
  const out = new Int16Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const srcIdx = Math.min(float32Buf.length - 1, Math.floor(i * ratio));
    const s = Math.max(-1, Math.min(1, float32Buf[srcIdx] || 0));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

function computeInt16Stats(samples) {
  const len = samples.length;
  if (!len) return { rms: 0, peak: 0 };
  let sumSq = 0;
  let peak = 0;
  for (let i = 0; i < len; i++) {
    const v = samples[i];
    const absV = v < 0 ? -v : v;
    if (absV > peak) peak = absV;
    sumSq += v * v;
  }
  return {
    rms: Math.sqrt(sumSq / len),
    peak
  };
}

function encodeInt16ChunksToWavBase64(chunks, totalSamples, sampleRate = 16000) {
  const byteLen = 44 + totalSamples * 2;
  const buffer = new ArrayBuffer(byteLen);
  const view = new DataView(buffer);
  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + totalSamples * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, totalSamples * 2, true);

  const pcmView = new Int16Array(buffer, 44, totalSamples);
  let offset = 0;
  for (let i = 0; i < chunks.length; i++) {
    pcmView.set(chunks[i], offset);
    offset += chunks[i].length;
  }

  const bytes = new Uint8Array(buffer);
  const step = 0x8000;
  const parts = [];
  for (let i = 0; i < bytes.length; i += step) {
    parts.push(String.fromCharCode.apply(null, bytes.subarray(i, i + step)));
  }
  return typeof window !== "undefined" ? window.btoa(parts.join("")) : "";
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
  const { bg, hover, text, lightBg, borderLight } = useTheme();

  const [customerLang, setCustomerLang] = useState("en");
  const [agentLang] = useState("tr");

  const [isListeningCustomer, setIsListeningCustomer] = useState(false);
  const [isCustomerSpeaking, setIsCustomerSpeaking] = useState(false);
  const [items, setItems] = useState([]);
  const [processingCustomerChunk, setProcessingCustomerChunk] = useState(false);
  const [processingAgentSpeech, setProcessingAgentSpeech] = useState(false);

  // Voice Interpreter (Auto TTS), TTS Audio Routing Target & Type-to-Speak modes
  const [autoVoiceTts, setAutoVoiceTts] = useState(false);
  const [ttsOutputMode, setTtsOutputMode] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("aida_translator_tts_target");
      if (saved === "customer_only" || saved === "both" || saved === "agent_only") {
        return saved;
      }
    }
    return "customer_only";
  });
  const [showTextInput, setShowTextInput] = useState(true);
  const [manualTrText, setManualTrText] = useState("");
  const [sendingManualText, setSendingManualText] = useState(false);
  const [playingTtsId, setPlayingTtsId] = useState(null);

  // Continuous WebAudio VAD Streamer refs
  const customerVadRef = useRef(null);
  const agentVadRef = useRef(null);
  const streamPollIntervalRef = useRef(null);
  const agentFallbackMicStreamRef = useRef(null);

  // Non-dropping parallel request & ordered UI commit refs
  const activeCustomerReqsRef = useRef(0);
  const activeAgentReqsRef = useRef(0);
  const customerOrderChainRef = useRef(Promise.resolve());
  const agentOrderChainRef = useRef(Promise.resolve());
  const ttsPlayChainRef = useRef(Promise.resolve());

  const feedEndRef = useRef(null);
  const lastCustomerTextRef = useRef("");
  const lastAgentTextRef = useRef("");
  const isListeningCustomerRef = useRef(false);
  const customerLangRef = useRef(customerLang);
  const autoVoiceTtsRef = useRef(autoVoiceTts);
  const ttsOutputModeRef = useRef(ttsOutputMode);
  const isPlayingTtsRef = useRef(false);
  const callIdRef = useRef(callId);

  const API_BASE =
    typeof window !== "undefined" ? `${window.location.protocol}//${backendHost}` : `http://${backendHost}`;

  const selectedCustomerLangObj =
    SUPPORTED_LANGUAGES.find((l) => l.code === customerLang) || SUPPORTED_LANGUAGES[0];

  useEffect(() => {
    callIdRef.current = callId;
  }, [callId]);

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
    ttsOutputModeRef.current = ttsOutputMode;
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem("aida_translator_tts_target", ttsOutputMode);
      } catch (e) {}
    }
  }, [ttsOutputMode]);

  useEffect(() => {
    autoVoiceTtsRef.current = autoVoiceTts;
    if (callStatus === "InCall" && isActiveInstance) {
      webphoneManager.setRawMicSuppressed(autoVoiceTts && ttsOutputMode !== "agent_only");
    } else {
      webphoneManager.setRawMicSuppressed(false);
    }
  }, [autoVoiceTts, ttsOutputMode, callStatus, isActiveInstance]);

  // Sync translation items & settings across multiple mounted panels (e.g. AgentWebphoneTab and CallChatWidget)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleSyncItem = (e) => {
      const item = e?.detail;
      if (!item || !item.id) return;
      setItems((prev) => (prev.some((x) => x.id === item.id) ? prev : [...prev, item]));
    };
    const handleSyncSettings = (e) => {
      const d = e?.detail;
      if (!d) return;
      if (d.customerLang) setCustomerLang(d.customerLang);
      if (typeof d.autoVoiceTts === "boolean") setAutoVoiceTts(d.autoVoiceTts);
      if (d.ttsOutputMode) setTtsOutputMode(d.ttsOutputMode);
    };
    window.addEventListener("LIVE_TRANSLATOR_SYNC_ITEM", handleSyncItem);
    window.addEventListener("LIVE_TRANSLATOR_SYNC_SETTINGS", handleSyncSettings);
    return () => {
      window.removeEventListener("LIVE_TRANSLATOR_SYNC_ITEM", handleSyncItem);
      window.removeEventListener("LIVE_TRANSLATOR_SYNC_SETTINGS", handleSyncSettings);
    };
  }, []);

  const broadcastSettingPatch = (patch) => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("LIVE_TRANSLATOR_SYNC_SETTINGS", { detail: patch }));
    }
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopAllVadListeners();
      webphoneManager.setRemoteAudioDucking(false);
      webphoneManager.setRawMicSuppressed(false);
    };
  }, []);

  // Start continuous VAD capture strictly when call is established ("InCall") on the active instance
  useEffect(() => {
    if (callStatus !== "InCall" || !isActiveInstance) {
      stopAllVadListeners();
      webphoneManager.setRawMicSuppressed(false);
    } else if (canLiveTranslate || canVoiceInterpret) {
      startAllVadListeners();
      webphoneManager.setRawMicSuppressed(autoVoiceTtsRef.current && ttsOutputModeRef.current !== "agent_only");
    }
  }, [callStatus, canLiveTranslate, canVoiceInterpret, isActiveInstance]);

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

  /**
   * Builds a continuous zero-gap WebAudio 16kHz PCM Voice Activity Detector (VAD) on a MediaStream.
   * Flushes natural phrases within ~380ms of pause (or ~1.9s micro-pause during continuous speech),
   * completely eliminating 3-second blind window delays and silent API calls.
   */
  const createVadStreamNode = (stream, role = "customer") => {
    if (typeof window === "undefined" || !stream) return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;

    const tracks = stream.getAudioTracks ? stream.getAudioTracks() : [];
    const activeTrack = tracks.find((t) => t.readyState === "live") || tracks[0];
    if (!activeTrack) return null;

    const ctx = new AudioCtx();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const singleTrackStream = new MediaStream([activeTrack]);
    const source = ctx.createMediaStreamSource(singleTrackStream);
    const processor = ctx.createScriptProcessor(2048, 1, 1);
    const silentGain = ctx.createGain();
    // Tiny non-zero gain keeps Chromium pulling RTP frames continuously without audible bleed
    silentGain.gain.value = 0.00001;

    source.connect(processor);
    processor.connect(silentGain);
    silentGain.connect(ctx.destination);

    const preRollMaxFrames = 8; // ~340ms pre-roll so initial consonants are never clipped
    let preRoll = [];
    let activeChunks = [];
    let activeSamples = 0;
    let isSpeaking = false;
    let consecutiveVoiceFrames = 0;
    let voicedMs = 0;
    let silenceMs = 0;
    let utteranceMs = 0;
    let noiseFloor = role === "customer" ? 110 : 75;
    let speakingUiState = false;

    const updateCustomerSpeakingBadge = (val) => {
      if (role === "customer" && speakingUiState !== val) {
        speakingUiState = val;
        setIsCustomerSpeaking(val);
      }
    };

    const flushUtterance = (keepTailFrames = 2) => {
      if (activeChunks.length === 0 || activeSamples < 3200 || voicedMs < 200) {
        activeChunks = [];
        activeSamples = 0;
        isSpeaking = false;
        voicedMs = 0;
        silenceMs = 0;
        utteranceMs = 0;
        consecutiveVoiceFrames = 0;
        updateCustomerSpeakingBadge(false);
        return;
      }

      const chunksToEncode = activeChunks;
      const samplesToEncode = activeSamples;
      const tail = keepTailFrames > 0 ? chunksToEncode.slice(-keepTailFrames) : [];

      preRoll = tail;
      activeChunks = [];
      activeSamples = 0;
      isSpeaking = false;
      voicedMs = 0;
      silenceMs = 0;
      utteranceMs = 0;
      consecutiveVoiceFrames = 0;
      updateCustomerSpeakingBadge(false);

      const wavB64 = encodeInt16ChunksToWavBase64(chunksToEncode, samplesToEncode, 16000);
      if (!wavB64) return;

      if (role === "customer") {
        dispatchCustomerWavBase64(wavB64);
      } else {
        dispatchAgentWavBase64(wavB64);
      }
    };

    processor.onaudioprocess = (ev) => {
      if (!isListeningCustomerRef.current) return;

      // Prevent agent room microphone from re-transcribing local TTS speaker monitor playback
      if (
        role === "agent" &&
        isPlayingTtsRef.current &&
        ttsOutputModeRef.current !== "customer_only"
      ) {
        return;
      }

      // Skip agent mic if agent muted their phone line
      if (role === "agent" && !activeTrack.enabled) {
        if (isSpeaking) flushUtterance(0);
        return;
      }

      const inputData = ev.inputBuffer.getChannelData(0);
      const srcRate = ev.inputBuffer.sampleRate || ctx.sampleRate || 48000;
      const pcm16 = downsampleFloat32ToInt16(inputData, srcRate, 16000);
      if (!pcm16.length) return;

      const frameMs = (pcm16.length / 16000) * 1000;
      const { rms, peak } = computeInt16Stats(pcm16);

      if (!isSpeaking && rms < noiseFloor * 1.8) {
        noiseFloor = Math.max(45, Math.min(360, noiseFloor * 0.96 + rms * 0.04));
      }

      const minRms = role === "customer" ? 190 : 220;
      const minPeak = role === "customer" ? 580 : 650;
      const hasVoice =
        rms > Math.max(minRms, noiseFloor * 2.25) &&
        peak > Math.max(minPeak, noiseFloor * 3.8);

      if (!isSpeaking) {
        preRoll.push(pcm16);
        if (preRoll.length > preRollMaxFrames) {
          preRoll.shift();
        }
        if (hasVoice) {
          consecutiveVoiceFrames += 1;
          if (consecutiveVoiceFrames >= 2 || rms > Math.max(420, noiseFloor * 3.5)) {
            isSpeaking = true;
            activeChunks = [...preRoll];
            activeSamples = activeChunks.reduce((acc, c) => acc + c.length, 0);
            preRoll = [];
            voicedMs = frameMs * consecutiveVoiceFrames;
            utteranceMs = (activeSamples / 16000) * 1000;
            silenceMs = 0;
            updateCustomerSpeakingBadge(true);
          }
        } else {
          consecutiveVoiceFrames = 0;
        }
        return;
      }

      // Currently inside an active speech segment
      activeChunks.push(pcm16);
      activeSamples += pcm16.length;
      utteranceMs += frameMs;

      if (hasVoice) {
        voicedMs += frameMs;
        silenceMs = 0;
      } else {
        silenceMs += frameMs;
      }

      const isAgentAutoTts = role === "agent" && Boolean(autoVoiceTtsRef.current);
      const pauseFlushMs = role === "customer" ? 380 : isAgentAutoTts ? 620 : 430;
      const softClauseMs = role === "customer" ? 1900 : isAgentAutoTts ? 4000 : 2300;
      const hardMaxMs = role === "customer" ? 2900 : isAgentAutoTts ? 5400 : 3300;

      if (silenceMs >= pauseFlushMs) {
        flushUtterance(1);
      } else if (utteranceMs >= softClauseMs && silenceMs >= 120) {
        // Clean mid-sentence split at natural word boundary so long customer speeches stream every ~2s
        flushUtterance(2);
      } else if (utteranceMs >= hardMaxMs) {
        flushUtterance(2);
      }
    };

    return {
      trackId: activeTrack.id,
      track: activeTrack,
      flushAndClose: () => {
        try {
          if (isSpeaking && voicedMs >= 220) {
            flushUtterance(0);
          }
        } catch (e) {}
        updateCustomerSpeakingBadge(false);
        try {
          processor.onaudioprocess = null;
          source.disconnect();
          processor.disconnect();
          silentGain.disconnect();
        } catch (e) {}
        try {
          ctx.close();
        } catch (e) {}
      }
    };
  };

  const ensureStreamsBound = async () => {
    if (!isListeningCustomerRef.current || !isActiveInstance) return;

    // 1. Customer incoming WebRTC stream
    if (canLiveTranslate) {
      const rStream = webphoneManager.getActiveRemoteStream();
      const rTracks = rStream?.getAudioTracks ? rStream.getAudioTracks() : [];
      const liveRTrack = rTracks.find((t) => t.readyState === "live") || rTracks[0];
      if (liveRTrack && liveRTrack.readyState === "live") {
        const cur = customerVadRef.current;
        if (!cur || cur.trackId !== liveRTrack.id || cur.track?.readyState !== "live") {
          if (cur) cur.flushAndClose();
          customerVadRef.current = createVadStreamNode(rStream, "customer");
        }
      }
    }

    // 2. Agent outgoing WebRTC microphone stream
    let lStream = webphoneManager.getActiveLocalStream() || agentFallbackMicStreamRef.current;
    if (!lStream && typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
      try {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        agentFallbackMicStreamRef.current = micStream;
        lStream = micStream;
      } catch (micErr) {
        console.warn("[LiveTranslator] Fallback mic stream warning:", micErr);
      }
    }
    if (lStream) {
      const lTracks = lStream.getAudioTracks ? lStream.getAudioTracks() : [];
      const liveLTrack = lTracks.find((t) => t.readyState === "live") || lTracks[0];
      if (liveLTrack && liveLTrack.readyState === "live") {
        const curA = agentVadRef.current;
        if (!curA || curA.trackId !== liveLTrack.id || curA.track?.readyState !== "live") {
          if (curA) curA.flushAndClose();
          agentVadRef.current = createVadStreamNode(lStream, "agent");
        }
      }
    }
  };

  const startAllVadListeners = () => {
    if (!isActiveInstance) return;
    setIsListeningCustomer(true);
    isListeningCustomerRef.current = true;
    ensureStreamsBound();

    if (streamPollIntervalRef.current) {
      clearInterval(streamPollIntervalRef.current);
    }
    // Fast 250ms stream/track health watcher so re-INVITE / RTP bridge tracks bind immediately
    streamPollIntervalRef.current = setInterval(() => {
      ensureStreamsBound();
    }, 250);
  };

  const stopAllVadListeners = () => {
    isListeningCustomerRef.current = false;
    setIsListeningCustomer(false);
    setIsCustomerSpeaking(false);

    if (streamPollIntervalRef.current) {
      clearInterval(streamPollIntervalRef.current);
      streamPollIntervalRef.current = null;
    }
    if (customerVadRef.current) {
      customerVadRef.current.flushAndClose();
      customerVadRef.current = null;
    }
    if (agentVadRef.current) {
      agentVadRef.current.flushAndClose();
      agentVadRef.current = null;
    }
    if (agentFallbackMicStreamRef.current) {
      try {
        agentFallbackMicStreamRef.current.getTracks().forEach((t) => t.stop());
      } catch (e) {}
      agentFallbackMicStreamRef.current = null;
    }
    webphoneManager.setRemoteAudioDucking(false);
  };

  const dispatchCustomerWavBase64 = (wavB64) => {
    if (!wavB64 || activeCustomerReqsRef.current >= 4) return;
    activeCustomerReqsRef.current += 1;
    setProcessingCustomerChunk(true);

    const reqSrcLang = customerLangRef.current || customerLang;
    const fetchPromise = fetch(`${API_BASE}/api/live-translator/translate-audio`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-ID": localStorage.getItem("current_user_id") || "admin"
      },
      body: JSON.stringify({
        audio_base64: wavB64,
        mime_type: "audio/wav",
        direction: "customer_to_agent",
        source_lang: reqSrcLang,
        target_lang: agentLang,
        generate_tts: false,
        call_id: callIdRef.current
      })
    })
      .then((res) => (res.ok ? res.json() : null))
      .catch((err) => {
        console.error("[LiveTranslator] Customer chunk translate error:", err);
        return null;
      });

    const prevChain = customerOrderChainRef.current;
    customerOrderChainRef.current = (async () => {
      await prevChain.catch(() => {});
      try {
        const data = await fetchPromise;
        if (!data || (!data.original_text && !data.translated_text)) return;

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

        emitLiveTurn({
          id: `tr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          direction: "customer_to_agent",
          sourceLang: data.detected_lang || data.source_lang || reqSrcLang,
          targetLang: "tr",
          originalText: data.original_text || "",
          translatedText: data.translated_text || data.original_text || "",
          suggestedReplyTr: data.suggested_reply_tr || "",
          timestamp: new Date().toLocaleTimeString("tr-TR", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
          })
        });
      } finally {
        activeCustomerReqsRef.current = Math.max(0, activeCustomerReqsRef.current - 1);
        if (activeCustomerReqsRef.current === 0) {
          setProcessingCustomerChunk(false);
        }
      }
    })();
  };

  const playTtsIntoCall = (ttsB64, ttsMime = "audio/mpeg", itemId = null, overrideMode = null) => {
    if (!ttsB64) return Promise.resolve();
    const targetMode = overrideMode || ttsOutputModeRef.current || "customer_only";
    const alsoPlayLocalMonitor = targetMode === "both" || targetMode === "agent_only";
    const sendToCustomer = targetMode === "customer_only" || targetMode === "both";

    const prevPlay = ttsPlayChainRef.current;
    const nextPlay = (async () => {
      await prevPlay.catch(() => {});
      isPlayingTtsRef.current = true;
      if (itemId) setPlayingTtsId(itemId);
      try {
        await webphoneManager.playAudioIntoActiveCallLine(
          ttsB64,
          ttsMime || "audio/mpeg",
          alsoPlayLocalMonitor,
          sendToCustomer
        );
      } catch (err) {
        console.error("[LiveTranslator] playTtsIntoCall error:", err);
      } finally {
        setTimeout(() => {
          isPlayingTtsRef.current = false;
          setPlayingTtsId((cur) => (cur === itemId ? null : cur));
        }, 200);
      }
    })();

    ttsPlayChainRef.current = nextPlay;
    return nextPlay;
  };

  const dispatchAgentWavBase64 = (wavB64) => {
    if (!wavB64 || activeAgentReqsRef.current >= 3) return;
    activeAgentReqsRef.current += 1;
    setProcessingAgentSpeech(true);

    const activeTargetLang = customerLangRef.current || customerLang;
    const shouldAutoSpeakTts = Boolean(autoVoiceTtsRef.current);

    const fetchPromise = fetch(`${API_BASE}/api/live-translator/translate-audio`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-ID": localStorage.getItem("current_user_id") || "admin"
      },
      body: JSON.stringify({
        audio_base64: wavB64,
        mime_type: "audio/wav",
        direction: "agent_to_customer",
        source_lang: "tr",
        target_lang: activeTargetLang,
        generate_tts: shouldAutoSpeakTts,
        call_id: callIdRef.current
      })
    })
      .then((res) => (res.ok ? res.json() : null))
      .catch((err) => {
        console.error("[LiveTranslator] Agent speech translate error:", err);
        return null;
      });

    const prevChain = agentOrderChainRef.current;
    agentOrderChainRef.current = (async () => {
      await prevChain.catch(() => {});
      try {
        const data = await fetchPromise;
        if (!data || (!data.translated_text && !data.original_text)) return;

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
          timestamp: new Date().toLocaleTimeString("tr-TR", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
          })
        };

        emitLiveTurn(newItem);

        if (shouldAutoSpeakTts && data.tts_audio_base64) {
          playTtsIntoCall(data.tts_audio_base64, data.tts_mime_type || "audio/mpeg", newItem.id);
        }
      } finally {
        activeAgentReqsRef.current = Math.max(0, activeAgentReqsRef.current - 1);
        if (activeAgentReqsRef.current === 0) {
          setProcessingAgentSpeech(false);
        }
      }
    })();
  };

  const handleSpeakBubbleToCustomer = async (item, customTargetText = null) => {
    const activeTargetLang =
      item?.targetLang && item.targetLang !== "tr"
        ? item.targetLang
        : customerLangRef.current || customerLang;
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
          call_id: callIdRef.current
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
        timestamp: new Date().toLocaleTimeString("tr-TR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit"
        })
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

  if (!canLiveTranslate && !canVoiceInterpret) {
    return null;
  }

  return (
    <div
      className={`p-3.5 bg-white dark:bg-slate-900 border ${borderLight} rounded-2xl shadow-sm flex flex-col gap-2.5`}
    >
      {/* Clean Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2 flex-wrap">
          <div className={`p-1.5 rounded-xl ${lightBg} ${text}`}>
            <Languages size={16} aria-hidden="true" />
          </div>
          <span className="text-xs font-extrabold text-slate-800 dark:text-white">
            Canlı Konuşma &amp; Çeviri
          </span>
          {isListeningCustomer && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
              <Radio size={10} className="animate-pulse" aria-hidden="true" />
              {isCustomerSpeaking ? "Müşteri konuşuyor..." : "Canlı Dinleniyor"}
            </span>
          )}
          {(processingCustomerChunk || processingAgentSpeech || sendingManualText) && (
            <Loader2 size={13} className={`animate-spin ${text}`} aria-hidden="true" />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* Toggle 1: Auto Voice TTS Interpreter Mode */}
          {canVoiceInterpret && (
            <button
              type="button"
              aria-pressed={autoVoiceTts}
              onClick={() => {
                const next = !autoVoiceTts;
                setAutoVoiceTts(next);
                broadcastSettingPatch({ autoVoiceTts: next });
              }}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-xl text-[10px] font-extrabold border transition-all ${
                autoVoiceTts
                  ? `${bg} text-white border-transparent shadow-sm`
                  : "bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
              title={
                autoVoiceTts
                  ? "Otomatik Sesli Tercüman AÇIK: Türkçe konuşmanız seçili ses hedefine göre çevrilip okunur"
                  : "Otomatik Sesli Tercüman KAPALI: Açmak için tıklayın"
              }
            >
              {autoVoiceTts ? <Volume2 size={12} aria-hidden="true" /> : <VolumeX size={12} aria-hidden="true" />}
              <span>Oto. Sesli Çeviri: {autoVoiceTts ? "Açık" : "Kapalı"}</span>
            </button>
          )}

          {/* Separate Control: Who hears the translated TTS audio? (Sadece Müşteri / Müşteri + Ben / Sadece Ben) */}
          {canVoiceInterpret && (
            <div
              role="group"
              aria-label="Çeviri sesi çıkış hedefi"
              className="inline-flex items-center p-0.5 rounded-xl bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700"
            >
              {TTS_OUTPUT_MODES.map((mode) => {
                const ModeIcon = mode.icon;
                const isSelected = ttsOutputMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => {
                      setTtsOutputMode(mode.id);
                      broadcastSettingPatch({ ttsOutputMode: mode.id });
                    }}
                    title={mode.desc}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-extrabold transition-all ${
                      isSelected
                        ? `${bg} text-white shadow-sm`
                        : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <ModeIcon size={11} aria-hidden="true" />
                    <span>{mode.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Toggle 2: Type-to-Speak Input Bar Toggle */}
          {canVoiceInterpret && (
            <button
              type="button"
              aria-pressed={showTextInput}
              onClick={() => setShowTextInput((prev) => !prev)}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-xl text-[10px] font-extrabold border transition-all ${
                showTextInput
                  ? `${lightBg} ${text} ${borderLight}`
                  : "bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700"
              }`}
              title="Yazarak Çevir & Seslendir alanını aç/kapat"
            >
              <Keyboard size={12} aria-hidden="true" />
              <span>Yazarak Seslendir</span>
            </button>
          )}

          {/* Customer Foreign Language Selector */}
          <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/80 px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <label htmlFor="live-translator-lang-select" className="text-[10px] font-bold text-slate-400">
              Dil:
            </label>
            <select
              id="live-translator-lang-select"
              value={customerLang}
              onChange={(e) => {
                const nextLang = e.target.value;
                setCustomerLang(nextLang);
                broadcastSettingPatch({ customerLang: nextLang });
              }}
              className="bg-transparent text-[11px] font-bold text-slate-800 dark:text-white focus:outline-none cursor-pointer"
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option
                  key={l.code}
                  value={l.code}
                  className="bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                >
                  {l.flag} {l.label}
                </option>
              ))}
            </select>
          </div>

          {items.length > 0 && (
            <button
              type="button"
              aria-label="Konuşma akışını temizle"
              onClick={() => setItems([])}
              className="p-1.5 rounded-xl text-slate-400 hover:text-rose-500 border border-slate-200 dark:border-slate-800 transition-colors"
              title="Konuşma Akışını Temizle"
            >
              <Trash2 size={13} aria-hidden="true" />
            </button>
          )}

          {onClose && (
            <button
              type="button"
              aria-label="Canlı çeviri panelini kapat"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              title="Kapat"
            >
              <X size={14} aria-hidden="true" />
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
            const srcIso = String(item.sourceLang || customerLang || "en")
              .split("-")[0]
              .toLowerCase();
            const tgtIso = String(item.targetLang || customerLang || "en")
              .split("-")[0]
              .toLowerCase();
            const srcBadgeCode = srcIso.toUpperCase();
            const tgtBadgeCode = tgtIso.toUpperCase();
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
                        <User size={11} aria-hidden="true" />
                        Müşteri
                      </span>
                      <div className="flex items-center gap-1.5">
                        {hasDifferentTranslation && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                            <Languages size={10} aria-hidden="true" />
                            {langBadge}
                          </span>
                        )}
                        <span className="text-[9px] text-slate-400 font-mono">{item.timestamp}</span>
                      </div>
                    </div>
                    <p
                      lang="tr"
                      className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-snug whitespace-pre-line break-words"
                    >
                      {mainTurkishText}
                    </p>
                    {hasDifferentTranslation && (
                      <p
                        lang={srcIso}
                        className="text-[11px] text-slate-500 dark:text-slate-400 italic mt-1 pt-1 border-t border-slate-100 dark:border-slate-800/70 leading-snug break-words"
                      >
                        &ldquo;{origClean}&rdquo;
                      </p>
                    )}

                    {/* Quick 1-Click Suggested Reply TTS Button if AI suggested a response */}
                    {canVoiceInterpret && item.suggestedReplyTr && (
                      <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 truncate">
                          <Sparkles size={10} className="text-amber-500 shrink-0" aria-hidden="true" />
                          <span className="truncate" title={item.suggestedReplyTr}>
                            Öneri: {item.suggestedReplyTr}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleSendManualTrText(null, item.suggestedReplyTr)}
                          disabled={sendingManualText}
                          className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold ${lightBg} ${text} border ${borderLight} hover:opacity-90 transition-opacity`}
                          title="Bu Türkçe yanıtı çevirip seçili ses hedefine sesli okut"
                        >
                          <Volume2 size={10} aria-hidden="true" />
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
                <div
                  className={`max-w-[85%] rounded-2xl rounded-tr-sm px-3.5 py-2.5 border shadow-sm ${lightBg} ${borderLight}`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className={`text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1 ${text}`}>
                      <User size={11} aria-hidden="true" />
                      Müşteri Temsilcisi
                    </span>
                    <div className="flex items-center gap-1.5">
                      {hasDifferentTranslation && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                          <Languages size={10} aria-hidden="true" />
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
                              ? `${bg} text-white border-transparent animate-pulse`
                              : `bg-white/80 dark:bg-slate-800 ${text} ${borderLight} hover:opacity-90`
                          }`}
                          title={`Seçili ses hedefine (${
                            TTS_OUTPUT_MODES.find((m) => m.id === ttsOutputMode)?.label || "Sadece Müşteri"
                          }) ${selectedCustomerLangObj.label} sesli okut`}
                        >
                          <Volume2 size={10} aria-hidden="true" />
                          <span>{isSpeakingThis ? "Okunuyor..." : "Dinlet"}</span>
                        </button>
                      )}
                      <span className="text-[9px] text-slate-400 font-mono">{item.timestamp}</span>
                    </div>
                  </div>
                  <p
                    lang="tr"
                    className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-snug whitespace-pre-line break-words"
                  >
                    {mainAgentText}
                  </p>
                  {hasDifferentTranslation && (
                    <p
                      lang={tgtIso}
                      className="text-[11px] text-slate-500 dark:text-slate-400 italic mt-1 pt-1 border-t border-slate-200/70 dark:border-slate-700/60 leading-snug break-words"
                    >
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

      {/* Mode 2: Type Turkish -> Translate & Speak Foreign TTS Directly */}
      {canVoiceInterpret && showTextInput && (
        <form
          onSubmit={(e) => handleSendManualTrText(e, null)}
          className="flex items-center gap-2 pt-1.5 border-t border-slate-100 dark:border-slate-800"
        >
          <input
            type="text"
            aria-label={`Türkçe yanıt yazın, ${selectedCustomerLangObj.label} diline çevrilip seslendirilir`}
            value={manualTrText}
            onChange={(e) => setManualTrText(e.target.value)}
            placeholder={`Türkçe yanıt yazın (${selectedCustomerLangObj.flag} ${selectedCustomerLangObj.code.toUpperCase()} sesli okunur)...`}
            className="flex-1 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={!manualTrText.trim() || sendingManualText}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold text-white ${bg} ${hover} disabled:opacity-50 transition-all shrink-0`}
            title={`Türkçe metni ${selectedCustomerLangObj.label} diline çevirip seçili ses hedefine okut`}
          >
            {sendingManualText ? (
              <Loader2 size={13} className="animate-spin" aria-hidden="true" />
            ) : (
              <Volume2 size={13} aria-hidden="true" />
            )}
            <span>Çevir &amp; Seslendir</span>
          </button>
        </form>
      )}
    </div>
  );
}
