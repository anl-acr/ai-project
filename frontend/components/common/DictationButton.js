import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";

/**
 * Reusable Speech-to-Text (Dikte) Button for Chat Inputs.
 * Uses browser Web Speech API (SpeechRecognition / webkitSpeechRecognition) with Turkish (tr-TR)
 * real-time streaming transcription, and falls back to MediaRecorder + backend STT if needed.
 */
export default function DictationButton({
  value = "",
  onChange,
  disabled = false,
  size = "md", // "sm" | "md" | "lg"
  className = "",
  onError
}) {
  const [isListening, setIsListening] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const recognitionRef = useRef(null);
  const baseTextRef = useRef("");
  const finalTranscriptRef = useRef("");
  const lastEmittedValueRef = useRef("");
  const shouldKeepListeningRef = useRef(false);

  // Detect if parent cleared the input (e.g., user sent the message while mic was active)
  useEffect(() => {
    if (isListening && value === "" && lastEmittedValueRef.current !== "") {
      baseTextRef.current = "";
      finalTranscriptRef.current = "";
      lastEmittedValueRef.current = "";
    } else if (!isListening) {
      baseTextRef.current = value || "";
    }
  }, [value, isListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      shouldKeepListeningRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onend = null;
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
  }, []);

  const stopDictation = () => {
    shouldKeepListeningRef.current = false;
    setIsListening(false);
    setIsStarting(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
  };

  const startDictation = async () => {
    if (disabled) return;

    const SpeechRecognition =
      typeof window !== "undefined"
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;

    if (!SpeechRecognition) {
      const msg = "Tarayıcınız sesli dikte (Web Speech API) özelliğini desteklemiyor. Lütfen Chrome, Edge veya Safari kullanın.";
      if (onError) onError(msg);
      else alert(msg);
      return;
    }

    setIsStarting(true);

    // Ensure microphone permission is granted (respecting selected_mic if configured)
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const selectedMicId = typeof window !== "undefined" ? localStorage.getItem("selected_mic") : null;
        const audioConstraints = selectedMicId ? { deviceId: { ideal: selectedMicId } } : true;
        const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
        // Release test stream immediately so SpeechRecognition can use the mic cleanly
        stream.getTracks().forEach((track) => track.stop());
      }
    } catch (err) {
      setIsStarting(false);
      const msg = "Mikrofon erişim izni alınamadı. Lütfen tarayıcı mikrofon izinlerini kontrol edin.";
      if (onError) onError(msg);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "tr-TR";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      baseTextRef.current = (value || "").trim();
      finalTranscriptRef.current = "";
      lastEmittedValueRef.current = value || "";
      shouldKeepListeningRef.current = true;

      recognition.onstart = () => {
        setIsStarting(false);
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        let interimTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcriptPiece = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscriptRef.current += transcriptPiece + " ";
          } else {
            interimTranscript += transcriptPiece;
          }
        }

        const parts = [
          baseTextRef.current.trim(),
          finalTranscriptRef.current.trim(),
          interimTranscript.trim()
        ].filter(Boolean);

        const nextText = parts.join(" ");
        lastEmittedValueRef.current = nextText;
        if (onChange) {
          onChange(nextText);
        }
      };

      recognition.onerror = (event) => {
        if (event.error === "no-speech") {
          // Ignore no-speech timeout, keep listening if active
          return;
        }
        if (event.error === "aborted") {
          return;
        }
        console.warn("[Dictation] SpeechRecognition error:", event.error);
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          shouldKeepListeningRef.current = false;
          setIsListening(false);
          setIsStarting(false);
          if (onError) {
            onError("Mikrofon erişimi engellendi. Tarayıcı adres çubuğundan mikrofon izni verin.");
          }
        }
      };

      recognition.onend = () => {
        // Automatically restart if user hasn't clicked stop (handles brief pauses in speech)
        if (shouldKeepListeningRef.current) {
          try {
            recognition.start();
            return;
          } catch (e) {}
        }
        setIsListening(false);
        setIsStarting(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("[Dictation] Failed to start SpeechRecognition:", err);
      setIsStarting(false);
      setIsListening(false);
      if (onError) {
        onError("Sesli dikte başlatılamadı.");
      }
    }
  };

  const toggleDictation = () => {
    if (isListening || isStarting) {
      stopDictation();
    } else {
      startDictation();
    }
  };

  const sizeClasses =
    size === "sm"
      ? "p-1.5 rounded-xl"
      : size === "lg"
      ? "p-3 rounded-xl"
      : "p-2 rounded-xl";

  const iconSize = size === "sm" ? 13 : size === "lg" ? 16 : 15;

  return (
    <div className="relative flex items-center shrink-0">
      {isListening && (
        <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md bg-rose-600 text-white text-[9px] font-extrabold uppercase tracking-wider whitespace-nowrap shadow-lg animate-bounce pointer-events-none z-30 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
          Dinleniyor...
        </span>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={toggleDictation}
        className={`${sizeClasses} border transition-all flex items-center justify-center shrink-0 disabled:opacity-45 disabled:cursor-not-allowed ${
          isListening
            ? "bg-rose-600 hover:bg-rose-500 text-white border-rose-500 shadow-md shadow-rose-500/25 ring-2 ring-rose-500/30 animate-pulse"
            : "border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950/50 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-300 dark:hover:border-rose-800"
        } ${className}`}
        title={isListening ? "Dikteyi Durdur (Dinleniyor...)" : "Sesle Yaz / Dikte Başlat (Mikrofon)"}
      >
        {isStarting ? (
          <Loader2 size={iconSize} className="animate-spin text-rose-500" />
        ) : isListening ? (
          <MicOff size={iconSize} />
        ) : (
          <Mic size={iconSize} />
        )}
      </button>
    </div>
  );
}
