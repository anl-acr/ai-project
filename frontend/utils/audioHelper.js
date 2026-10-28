// Shared Audio Device Resolver & Ringtone / Ringback Synthesizer
let audioCtx = null;
let ringtoneInterval = null;
let ringtoneAudioEl = null;
let ringtonePlayToken = 0;
const wavUrlCache = new Map();

let ringbackCtx = null;
let ringbackInterval = null;
let ringbackAudioEl = null;
let ringbackPlayToken = 0;
let ringbackWavUrl = null;

/**
 * Strips OS/Browser prefix from a device label such as:
 * "Varsayılan - AirPods (Bluetooth)" -> "AirPods (Bluetooth)"
 * "Default - MacBook Air Speakers" -> "MacBook Air Speakers"
 */
export const stripDefaultDevicePrefix = (label = "") => {
  return String(label || "")
    .replace(/^(Varsayılan|Default|İletişim|Communications)\s*[-–—:]\s*/i, "")
    .trim();
};

/**
 * Resolves the current live browser deviceId for an audioinput or audiooutput device
 * using both the saved deviceId and the saved human-readable device label.
 * This ensures that:
 * 1. If a user selected "Varsayılan - AirPods (Bluetooth)" (deviceId="default"), it resolves to the
 *    actual "AirPods (Bluetooth)" hardware deviceId when connected, instead of following OS default changes.
 * 2. If Bluetooth reconnects or browser restarts and assigns a new deviceId hash, it matches by label.
 */
export const resolveAudioDeviceId = async (kind = "audiooutput", preferredId = "", preferredLabel = "") => {
  if (typeof window === "undefined" || !navigator.mediaDevices || typeof navigator.mediaDevices.enumerateDevices !== "function") {
    return preferredId || "default";
  }

  try {
    const allDevices = await navigator.mediaDevices.enumerateDevices();
    const list = allDevices.filter((d) => d.kind === kind);
    if (list.length === 0) {
      return preferredId || "default";
    }

    const rawId = String(preferredId || "").trim();
    let rawLabel = String(preferredLabel || "").trim();

    // If no label was passed, check if preferredId matches a device in the list and grab its label
    if (!rawLabel && rawId) {
      const foundById = list.find((d) => d.deviceId === rawId);
      if (foundById && foundById.label) {
        rawLabel = foundById.label;
      }
    }

    const cleanTargetLabel = stripDefaultDevicePrefix(rawLabel);

    // 1. If user chose a specific non-default deviceId and it is currently present in the system, use it directly
    if (rawId && rawId !== "default" && rawId !== "communications") {
      const exactIdMatch = list.find((d) => d.deviceId === rawId);
      if (exactIdMatch) {
        return exactIdMatch.deviceId;
      }
    }

    // 2. Match by stripped hardware label against specific (non-default) hardware devices first!
    // This also upgrades "Varsayılan - AirPods (Bluetooth)" (id="default") to the explicit "AirPods (Bluetooth)" deviceId
    if (cleanTargetLabel) {
      const targetLower = cleanTargetLabel.toLowerCase();
      const nonDefaultExact = list.find(
        (d) =>
          d.deviceId !== "default" &&
          d.deviceId !== "communications" &&
          d.label &&
          stripDefaultDevicePrefix(d.label).toLowerCase() === targetLower
      );
      if (nonDefaultExact) {
        return nonDefaultExact.deviceId;
      }

      const nonDefaultPartial = list.find(
        (d) =>
          d.deviceId !== "default" &&
          d.deviceId !== "communications" &&
          d.label &&
          (stripDefaultDevicePrefix(d.label).toLowerCase().includes(targetLower) ||
            targetLower.includes(stripDefaultDevicePrefix(d.label).toLowerCase()))
      );
      if (nonDefaultPartial) {
        return nonDefaultPartial.deviceId;
      }

      const anyLabelMatch = list.find((d) => d.label && d.label.toLowerCase() === rawLabel.toLowerCase());
      if (anyLabelMatch) {
        return anyLabelMatch.deviceId;
      }
    }

    // 3. Fallback to rawId if present in list, otherwise "default"
    if (rawId && list.some((d) => d.deviceId === rawId)) {
      return rawId;
    }
    return "default";
  } catch (err) {
    console.warn("[AudioHelper] resolveAudioDeviceId error:", err);
    return preferredId || "default";
  }
};

/**
 * Encodes a Float32Array mono audio buffer [-1..1] into a 16-bit PCM WAV Blob URL.
 */
function encodeMonoWavUrl(samples, sampleRate = 44100) {
  const numSamples = samples.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format = 1
  view.setUint16(22, 1, true); // Mono = 1 channel
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // Byte rate
  view.setUint16(32, 2, true); // Block align
  view.setUint16(34, 16, true); // 16-bit
  writeString(36, "data");
  view.setUint32(40, numSamples * 2, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  const blob = new Blob([buffer], { type: "audio/wav" });
  return URL.createObjectURL(blob);
}

function triangleWave(phase) {
  const p = phase - Math.floor(phase);
  return p < 0.5 ? 4 * p - 1 : 3 - 4 * p;
}

function sawtoothWave(phase) {
  const p = phase - Math.floor(phase);
  return 2 * p - 1;
}

/**
 * Generates and caches a looped WAV Blob URL for the given ringtone type.
 */
function getOrCreateRingtoneWavUrl(type = "classic") {
  if (wavUrlCache.has(type)) {
    return wavUrlCache.get(type);
  }

  const sampleRate = 44100;
  let totalDurationSec = 1.8;
  if (type === "classic") totalDurationSec = 4.0;
  else if (type === "vintage") totalDurationSec = 3.0;
  else if (type === "organ") totalDurationSec = 2.5;

  const totalSamples = Math.floor(sampleRate * totalDurationSec);
  const samples = new Float32Array(totalSamples);

  const addTone = (startSec, durSec, freqFn, waveType = "sine", maxGain = 0.2, expDecay = false) => {
    const startIdx = Math.max(0, Math.floor(startSec * sampleRate));
    const endIdx = Math.min(totalSamples, Math.floor((startSec + durSec) * sampleRate));
    let phase = 0;

    for (let i = startIdx; i < endIdx; i++) {
      const t = (i - startIdx) / sampleRate;
      const freq = typeof freqFn === "function" ? freqFn(t) : freqFn;
      phase += freq / sampleRate;

      let raw = 0;
      if (waveType === "sine") raw = Math.sin(2 * Math.PI * phase);
      else if (waveType === "triangle") raw = triangleWave(phase);
      else if (waveType === "sawtooth") raw = sawtoothWave(phase);

      let env = maxGain;
      const attack = Math.min(0.03, durSec * 0.15);
      if (t < attack) {
        env = maxGain * (t / attack);
      } else if (expDecay) {
        const decayProgress = (t - attack) / Math.max(0.01, durSec - attack);
        env = maxGain * Math.pow(0.001, decayProgress);
      } else {
        const release = Math.min(0.08, durSec * 0.2);
        if (t > durSec - release) {
          env = maxGain * Math.max(0, (durSec - t) / release);
        }
      }

      samples[i] += raw * env;
    }
  };

  if (type === "classic") {
    // Classic double ring: 440Hz + 480Hz for 2.0s, silence for 2.0s
    addTone(0, 2.0, 440, "sine", 0.22, false);
    addTone(0, 2.0, 480, "sine", 0.22, false);
  } else if (type === "digital") {
    addTone(0.0, 0.12, 880, "triangle", 0.28, false);
    addTone(0.12, 0.12, 1100, "triangle", 0.28, false);
    addTone(0.24, 0.12, 880, "triangle", 0.28, false);
    addTone(0.36, 0.16, 1100, "triangle", 0.28, false);
  } else if (type === "melody") {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      addTone(i * 0.09, 0.85, freq, "sine", 0.2, true);
    });
  } else if (type === "futuristic") {
    addTone(
      0,
      0.42,
      (t) => 400 * Math.pow(1400 / 400, Math.min(1, t / 0.35)),
      "sawtooth",
      0.18,
      true
    );
  } else if (type === "marimba") {
    const marimbaNotes = [440, 554.37, 659.25, 880, 659.25, 880, 1109, 1318.5];
    marimbaNotes.forEach((freq, i) => {
      addTone(i * 0.1, 0.42, freq, "triangle", 0.24, true);
    });
  } else if (type === "vintage") {
    addTone(
      0,
      1.4,
      (t) => 2500 + 500 * Math.sin(2 * Math.PI * 25 * t),
      "sine",
      0.18,
      false
    );
  } else if (type === "echo") {
    addTone(0.0, 0.55, 987.77, "sine", 0.25, true);
    addTone(0.25, 0.55, 987.77, "sine", 0.13, true);
    addTone(0.5, 0.55, 987.77, "sine", 0.07, true);
    addTone(0.75, 0.55, 987.77, "sine", 0.035, true);
  } else if (type === "organ") {
    const chordC = [261.63, 329.63, 392.0, 523.25];
    const chordG = [293.66, 392.0, 493.88, 587.33];
    chordC.forEach((freq) => addTone(0, 0.6, freq, "triangle", 0.1, false));
    chordG.forEach((freq) => addTone(0.65, 0.7, freq, "triangle", 0.1, false));
  } else {
    addTone(0, 2.0, 440, "sine", 0.22, false);
    addTone(0, 2.0, 480, "sine", 0.22, false);
  }

  const url = encodeMonoWavUrl(samples, sampleRate);
  wavUrlCache.set(type, url);
  return url;
}

function getOrCreateRingbackWavUrl() {
  if (ringbackWavUrl) return ringbackWavUrl;
  const sampleRate = 44100;
  const totalSamples = sampleRate * 4; // 1.0s ON, 3.0s OFF
  const samples = new Float32Array(totalSamples);
  const onSamples = sampleRate * 1;

  for (let i = 0; i < onSamples; i++) {
    const t = i / sampleRate;
    let env = 0.25;
    if (t < 0.04) env = 0.25 * (t / 0.04);
    else if (t > 0.96) env = 0.25 * ((1.0 - t) / 0.04);
    samples[i] = Math.sin(2 * Math.PI * 425 * t) * env;
  }

  ringbackWavUrl = encodeMonoWavUrl(samples, sampleRate);
  return ringbackWavUrl;
}

function ensureRingtoneAudioElement() {
  if (typeof window === "undefined") return null;
  if (!ringtoneAudioEl) {
    let existing = document.getElementById("aida-ringtone-audio-el");
    if (!existing) {
      existing = document.createElement("audio");
      existing.id = "aida-ringtone-audio-el";
      existing.loop = true;
      existing.preload = "auto";
      existing.playsInline = true;
      existing.style.display = "none";
      document.body.appendChild(existing);
    }
    ringtoneAudioEl = existing;
  }
  return ringtoneAudioEl;
}

function ensureRingbackAudioElement() {
  if (typeof window === "undefined") return null;
  if (!ringbackAudioEl) {
    let existing = document.getElementById("aida-ringback-audio-el");
    if (!existing) {
      existing = document.createElement("audio");
      existing.id = "aida-ringback-audio-el";
      existing.loop = true;
      existing.preload = "auto";
      existing.playsInline = true;
      existing.style.display = "none";
      document.body.appendChild(existing);
    }
    ringbackAudioEl = existing;
  }
  return ringbackAudioEl;
}

export const playRingtoneSound = async (type = "classic", sinkId = null, sinkLabel = null) => {
  stopRingtoneSound();
  if (typeof window === "undefined") return;

  const currentToken = ++ringtonePlayToken;
  const savedSinkId = sinkId || localStorage.getItem("selected_ringtone_speaker") || "";
  const savedSinkLabel = sinkLabel || localStorage.getItem("selected_ringtone_speaker_label") || "";

  try {
    const resolvedSinkId = await resolveAudioDeviceId("audiooutput", savedSinkId, savedSinkLabel);
    if (currentToken !== ringtonePlayToken) return; // Stopped while resolving

    // Update localStorage if deviceId was refreshed by label match
    if (resolvedSinkId && resolvedSinkId !== "default" && resolvedSinkId !== savedSinkId) {
      try {
        localStorage.setItem("selected_ringtone_speaker", resolvedSinkId);
      } catch (e) {}
    }

    const el = ensureRingtoneAudioElement();
    if (el) {
      el.pause();
      el.src = getOrCreateRingtoneWavUrl(type || "classic");
      el.currentTime = 0;
      el.volume = 1.0;

      if (typeof el.setSinkId === "function") {
        try {
          await el.setSinkId(resolvedSinkId === "default" ? "" : resolvedSinkId);
        } catch (sinkErr) {
          console.warn("[AudioHelper] Ringtone el.setSinkId failed, falling back to default sink:", sinkErr);
          try {
            await el.setSinkId("");
          } catch (e2) {}
        }
      }

      if (currentToken !== ringtonePlayToken) return;
      await el.play();
      return;
    }
  } catch (err) {
    console.warn("[AudioHelper] HTMLAudioElement ringtone play failed, using AudioContext fallback:", err);
  }

  // Fallback to Web Audio API if HTMLAudioElement playback was blocked
  if (currentToken !== ringtonePlayToken) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  try {
    audioCtx = new AudioContext();
    if (audioCtx.state === "suspended") {
      await audioCtx.resume().catch(() => {});
    }
    const resolvedSinkId = await resolveAudioDeviceId("audiooutput", savedSinkId, savedSinkLabel);
    if (currentToken !== ringtonePlayToken) {
      stopRingtoneSound();
      return;
    }
    if (resolvedSinkId && typeof audioCtx.setSinkId === "function") {
      await audioCtx.setSinkId(resolvedSinkId === "default" ? "" : resolvedSinkId).catch(() => {});
    }
    const playFallbackBeep = () => {
      if (!audioCtx || audioCtx.state === "closed") return;
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, now);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.linearRampToValueAtTime(0, now + 1.2);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 1.25);
    };
    playFallbackBeep();
    ringtoneInterval = setInterval(playFallbackBeep, 2500);
  } catch (e) {}
};

export const stopRingtoneSound = () => {
  ringtonePlayToken++;
  if (ringtoneAudioEl) {
    try {
      ringtoneAudioEl.pause();
      ringtoneAudioEl.currentTime = 0;
    } catch (e) {}
  }
  if (ringtoneInterval) {
    clearInterval(ringtoneInterval);
    ringtoneInterval = null;
  }
  if (audioCtx) {
    try {
      audioCtx.close();
    } catch (e) {}
    audioCtx = null;
  }
};

export const playRingbackTone = async (sinkId = null, sinkLabel = null) => {
  stopRingbackTone();
  if (typeof window === "undefined") return;

  const currentToken = ++ringbackPlayToken;
  const savedSinkId = sinkId || localStorage.getItem("selected_speaker") || "";
  const savedSinkLabel = sinkLabel || localStorage.getItem("selected_speaker_label") || "";

  try {
    const resolvedSinkId = await resolveAudioDeviceId("audiooutput", savedSinkId, savedSinkLabel);
    if (currentToken !== ringbackPlayToken) return;

    const el = ensureRingbackAudioElement();
    if (el) {
      el.pause();
      el.src = getOrCreateRingbackWavUrl();
      el.currentTime = 0;
      el.volume = 0.85;

      if (typeof el.setSinkId === "function") {
        try {
          await el.setSinkId(resolvedSinkId === "default" ? "" : resolvedSinkId);
        } catch (sinkErr) {
          try {
            await el.setSinkId("");
          } catch (e2) {}
        }
      }

      if (currentToken !== ringbackPlayToken) return;
      await el.play();
      return;
    }
  } catch (e) {
    console.warn("[AudioHelper] Ringback tone error:", e);
  }
};

export const stopRingbackTone = () => {
  ringbackPlayToken++;
  if (ringbackAudioEl) {
    try {
      ringbackAudioEl.pause();
      ringbackAudioEl.currentTime = 0;
    } catch (e) {}
  }
  if (ringbackInterval) {
    clearInterval(ringbackInterval);
    ringbackInterval = null;
  }
  if (ringbackCtx) {
    try {
      ringbackCtx.close();
    } catch (e) {}
    ringbackCtx = null;
  }
};


