import React, { useState, useRef, useEffect, useMemo } from "react";
import { Play, Square, Volume2 } from "lucide-react";
import { useTheme } from "../../utils/theme";

const DEFAULT_WAVEFORM_BARS = [
  3, 5, 8, 4, 6, 9, 7, 3, 5, 8, 6, 4, 7, 9, 5, 3, 6, 8, 4, 7, 5, 9, 6, 3, 7, 8,
  4, 6, 5, 9, 7, 4, 8, 6, 3, 5, 9, 7, 4, 6,
];

function parseInitialDurationSeconds(val) {
  if (typeof val === "number" && Number.isFinite(val) && val > 0) {
    return val;
  }
  if (typeof val === "string" && val.trim()) {
    const parts = val.trim().split(":").map((n) => Number(n));
    if (parts.length === 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
      return parts[0] * 60 + parts[1];
    }
    if (parts.length === 3 && Number.isFinite(parts[0]) && Number.isFinite(parts[1]) && Number.isFinite(parts[2])) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    const asNum = Number(val);
    if (Number.isFinite(asNum) && asNum > 0) return asNum;
  }
  return 0;
}

export function formatWaveformDuration(sec) {
  const n = Number(sec || 0);
  if (!Number.isFinite(n) || n <= 0) return "00:00";
  const total = Math.max(0, Math.round(n));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function WaveformAudioPlayer({
  src,
  initialDuration = 0,
  autoPlay = false,
  onPlay,
  size = "md",
  barCount = 36,
  className = "",
  title = "Ses Kaydı",
}) {
  const { bg, text, lightBg, borderLight } = useTheme();
  const audioRef = useRef(null);
  const instanceIdRef = useRef(`wf_${Math.random().toString(36).slice(2, 10)}`);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(() => parseInitialDurationSeconds(initialDuration));

  useEffect(() => {
    const parsed = parseInitialDurationSeconds(initialDuration);
    if (parsed > 0 && duration <= 0) {
      setDuration(parsed);
    }
  }, [initialDuration]);

  const bars = useMemo(() => {
    const count = Math.max(12, Math.min(54, Number(barCount) || 36));
    const seedStr = String(src || title || "aida");
    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) {
      hash = (hash * 31 + seedStr.charCodeAt(i)) >>> 0;
    }
    const result = [];
    for (let i = 0; i < count; i++) {
      const base = DEFAULT_WAVEFORM_BARS[(i + (hash % 11)) % DEFAULT_WAVEFORM_BARS.length];
      result.push(base);
    }
    return result;
  }, [src, title, barCount]);

  useEffect(() => {
    const handleGlobalPlay = (e) => {
      if (e?.detail?.id && e.detail.id !== instanceIdRef.current) {
        if (audioRef.current && !audioRef.current.paused) {
          audioRef.current.pause();
        }
        setIsPlaying(false);
      }
    };
    window.addEventListener("aida-waveform-play", handleGlobalPlay);
    return () => {
      window.removeEventListener("aida-waveform-play", handleGlobalPlay);
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    const parsed = parseInitialDurationSeconds(initialDuration);
    setDuration(parsed > 0 ? parsed : 0);
    if (autoPlay && src && audioRef.current) {
      const timer = setTimeout(() => {
        if (!audioRef.current) return;
        window.dispatchEvent(
          new CustomEvent("aida-waveform-play", { detail: { id: instanceIdRef.current } })
        );
        audioRef.current
          .play()
          .then(() => {
            setIsPlaying(true);
            if (typeof onPlay === "function") onPlay();
          })
          .catch(() => setIsPlaying(false));
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [src, autoPlay]);

  const togglePlay = (e) => {
    if (e) e.stopPropagation();
    const audio = audioRef.current;
    if (!audio || !src) return;

    if (isPlaying) {
      audio.pause();
      audio.currentTime = 0;
      setIsPlaying(false);
      setCurrentTime(0);
      return;
    }

    window.dispatchEvent(
      new CustomEvent("aida-waveform-play", { detail: { id: instanceIdRef.current } })
    );
    audio
      .play()
      .then(() => {
        setIsPlaying(true);
        if (typeof onPlay === "function") onPlay();
      })
      .catch(() => {
        setIsPlaying(false);
      });
  };

  const handleSeek = (e) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width) return;
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const totalDur = duration > 0 ? duration : audio.duration || 0;
    if (totalDur > 0 && Number.isFinite(totalDur)) {
      audio.currentTime = ratio * totalDur;
      setCurrentTime(audio.currentTime);
    }
    if (!isPlaying) {
      togglePlay();
    }
  };

  const totalDur = duration > 0 ? duration : 0;
  const progressRatio = totalDur > 0 ? Math.min(1, currentTime / totalDur) : 0;

  const isSmall = size === "sm";
  const btnSizeClass = isSmall ? "w-[34px] h-[34px]" : "w-[40px] h-[40px]";
  const waveHeightClass = isSmall ? "h-6" : "h-8";

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`flex items-center gap-3 min-w-0 px-3 py-1.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 ${className}`}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        className="hidden"
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) {
            setDuration(d);
          }
        }}
        onTimeUpdate={(e) => {
          setCurrentTime(e.currentTarget.currentTime || 0);
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0 && d !== duration) {
            setDuration(d);
          }
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
      />

      <button
        type="button"
        onClick={togglePlay}
        aria-label={isPlaying ? `${title} durdur` : `${title} dinle`}
        title={isPlaying ? "Durdur" : "Dinle"}
        className={`${btnSizeClass} rounded-full flex items-center justify-center shrink-0 shadow-md transition-transform active:scale-95 cursor-pointer ${bg} text-white`}
      >
        {isPlaying ? (
          <Square size={isSmall ? 13 : 15} fill="currentColor" />
        ) : (
          <Play size={isSmall ? 15 : 17} fill="currentColor" className="ml-0.5" />
        )}
      </button>

      <div
        onClick={handleSeek}
        title="Konuma gitmek için tıklayın"
        className={`flex items-center justify-between ${waveHeightClass} flex-1 min-w-[90px] mx-1 cursor-pointer select-none`}
      >
        {bars.map((h, i) => {
          const barRatio = i / bars.length;
          const isActiveBar = isPlaying && (totalDur <= 0 || barRatio <= progressRatio);
          return (
            <div
              key={i}
              className={`w-1 mx-[1px] rounded-full ${bg} transition-all duration-150`}
              style={{
                height: `${Math.max(18, h * 10)}%`,
                opacity: isActiveBar ? 0.92 : 0.25,
              }}
            />
          );
        })}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-[11px] font-bold ${text} font-mono tracking-wider opacity-90`}>
          {isPlaying
            ? `${formatWaveformDuration(currentTime)} / ${formatWaveformDuration(totalDur)}`
            : `${formatWaveformDuration(currentTime)} / ${formatWaveformDuration(totalDur)}`}
        </span>
        <Volume2 size={isSmall ? 14 : 16} className={`${text} opacity-80`} aria-hidden="true" />
      </div>
    </div>
  );
}
