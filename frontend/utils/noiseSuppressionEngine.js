// AI Noise Suppression & Call-Center Crystal Voice DSP Engine
// Uses RNNoise Neural Network (WASM + SIMD) + Hysteresis Noise Gate + 85Hz Rumble Filter via AudioWorklet

const STORAGE_KEY = "webphone_noise_mode";
export const VALID_NOISE_MODES = ["ai", "standard", "off"];

let cachedRnnoiseModulePromise = null;
let cachedRnnoiseWasmPromise = null;

// Track active processed streams/tracks so we can always release hardware mic & WASM memory cleanly
const activePipelinesByTrackId = new Map();

export function getSavedNoiseSuppressionMode() {
  if (typeof window === "undefined") return "ai";
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    if (val && VALID_NOISE_MODES.includes(val)) {
      return val;
    }
  } catch (e) {}
  return "ai";
}

export function saveNoiseSuppressionMode(mode) {
  const safeMode = VALID_NOISE_MODES.includes(mode) ? mode : "ai";
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, safeMode);
    } catch (e) {}
  }
  return safeMode;
}

export function getNoiseModeLabel(mode) {
  if (mode === "ai") return "Yapay Zeka (AI Kristal Ses)";
  if (mode === "standard") return "Standart (Tarayıcı Filtresi)";
  return "Kapalı (Ham Mikrofon)";
}

async function ensureRnnoiseAssetsLoaded() {
  if (typeof window === "undefined") {
    throw new Error("Tarayıcı ortamı gerekli.");
  }
  if (!cachedRnnoiseModulePromise) {
    cachedRnnoiseModulePromise = import("@sapphi-red/web-noise-suppressor");
  }
  const mod = await cachedRnnoiseModulePromise;
  if (!cachedRnnoiseWasmPromise) {
    cachedRnnoiseWasmPromise = mod
      .loadRnnoise({
        url: "/worklets/rnnoise.wasm",
        simdUrl: "/worklets/rnnoise_simd.wasm"
      })
      .catch((err) => {
        cachedRnnoiseWasmPromise = null;
        throw err;
      });
  }
  const wasmBinary = await cachedRnnoiseWasmPromise;
  return {
    RnnoiseWorkletNode: mod.RnnoiseWorkletNode,
    NoiseGateWorkletNode: mod.NoiseGateWorkletNode,
    wasmBinary
  };
}

/**
 * Builds getUserMedia audio constraints tailored to the selected noise suppression mode.
 * When mode === "ai", browser-native noiseSuppression is disabled to avoid double-filtering
 * metallic artifacts before the 48kHz RNNoise neural network processes the audio.
 */
export function buildMicConstraintsForMode(mode = "ai", deviceIdSpec = null) {
  const safeMode = VALID_NOISE_MODES.includes(mode) ? mode : "ai";
  const baseAudio =
    safeMode === "ai"
      ? {
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: true,
          sampleRate: { ideal: 48000 },
          channelCount: { ideal: 1 }
        }
      : safeMode === "standard"
      ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      : {
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: false
        };

  if (deviceIdSpec) {
    return {
      audio: {
        ...baseAudio,
        deviceId: deviceIdSpec
      },
      video: false
    };
  }

  return {
    audio: baseAudio,
    video: false
  };
}

/**
 * Wraps a raw microphone MediaStream in the 48kHz RNNoise + NoiseGate AudioWorklet DSP graph
 * when mode === "ai". Automatically hooks processedTrack.stop() so releasing the WebRTC sender
 * track immediately releases the underlying physical microphone and WASM memory.
 */
export async function processMicrophoneStream(rawStream, mode = "ai", options = {}) {
  const safeMode = VALID_NOISE_MODES.includes(mode) ? mode : "ai";
  if (!rawStream) return rawStream;

  const rawAudioTracks = rawStream.getAudioTracks();
  if (rawAudioTracks.length === 0 || safeMode !== "ai") {
    return rawStream;
  }

  // Fallback gracefully if AudioWorklet is unavailable
  const AudioCtx = typeof window !== "undefined" ? window.AudioContext || window.webkitAudioContext : null;
  if (!AudioCtx || !AudioCtx.prototype || !("audioWorklet" in AudioCtx.prototype)) {
    console.warn("[NoiseSuppression] AudioWorklet desteklenmiyor, standart mikrofon akışı kullanılıyor.");
    return rawStream;
  }

  let audioCtx = null;
  let rnnoiseNode = null;
  let noiseGateNode = null;
  let highpassNode = null;
  let sourceNode = null;
  let destNode = null;
  let inputAnalyser = null;
  let outputAnalyser = null;

  try {
    const { RnnoiseWorkletNode, NoiseGateWorkletNode, wasmBinary } = await ensureRnnoiseAssetsLoaded();

    // RNNoise requires strictly 48,000 Hz sample rate
    audioCtx = new AudioCtx({
      sampleRate: 48000,
      latencyHint: "interactive"
    });

    if (audioCtx.state === "suspended") {
      await audioCtx.resume().catch(() => {});
    }

    await Promise.all([
      audioCtx.audioWorklet.addModule("/worklets/rnnoiseWorklet.js"),
      audioCtx.audioWorklet.addModule("/worklets/noiseGateWorklet.js")
    ]);

    sourceNode = audioCtx.createMediaStreamSource(rawStream);

    // 1. Sub-vocal rumble & desk bump filter (85 Hz highpass)
    highpassNode = audioCtx.createBiquadFilter();
    highpassNode.type = "highpass";
    highpassNode.frequency.value = 85;
    highpassNode.Q.value = 0.707;

    // 2. RNNoise Deep Learning Neural Network suppressor
    rnnoiseNode = new RnnoiseWorkletNode(audioCtx, {
      maxChannels: 1,
      wasmBinary
    });

    // 3. Call-Center Side-Chatter Hysteresis Noise Gate
    noiseGateNode = new NoiseGateWorkletNode(audioCtx, {
      openThreshold: -50,
      closeThreshold: -56,
      holdMs: 160,
      maxChannels: 1
    });

    destNode = audioCtx.createMediaStreamDestination();

    if (options.enableMeters) {
      inputAnalyser = audioCtx.createAnalyser();
      inputAnalyser.fftSize = 256;
      outputAnalyser = audioCtx.createAnalyser();
      outputAnalyser.fftSize = 256;

      sourceNode.connect(inputAnalyser);
      sourceNode.connect(highpassNode);
      highpassNode.connect(rnnoiseNode);
      rnnoiseNode.connect(noiseGateNode);
      noiseGateNode.connect(outputAnalyser);
      noiseGateNode.connect(destNode);
    } else {
      sourceNode.connect(highpassNode);
      highpassNode.connect(rnnoiseNode);
      rnnoiseNode.connect(noiseGateNode);
      noiseGateNode.connect(destNode);
    }

    const processedStream = destNode.stream;
    const processedTrack = processedStream.getAudioTracks()[0];
    const rawPrimaryTrack = rawAudioTracks[0];

    if (!processedTrack) {
      throw new Error("İşlenmiş ses kanalı oluşturulamadı.");
    }

    let cleanedUp = false;
    const origStop = processedTrack.stop.bind(processedTrack);

    const cleanupPipeline = (stopRawHardware = true) => {
      if (cleanedUp) return;
      cleanedUp = true;
      activePipelinesByTrackId.delete(processedTrack.id);

      try {
        origStop();
      } catch (e) {}

      try {
        if (sourceNode) sourceNode.disconnect();
      } catch (e) {}
      try {
        if (highpassNode) highpassNode.disconnect();
      } catch (e) {}
      try {
        if (rnnoiseNode) {
          rnnoiseNode.disconnect();
          if (typeof rnnoiseNode.destroy === "function") {
            rnnoiseNode.destroy();
          }
        }
      } catch (e) {}
      try {
        if (noiseGateNode) noiseGateNode.disconnect();
      } catch (e) {}
      try {
        if (inputAnalyser) inputAnalyser.disconnect();
        if (outputAnalyser) outputAnalyser.disconnect();
      } catch (e) {}

      if (audioCtx && audioCtx.state !== "closed") {
        audioCtx.close().catch(() => {});
      }

      if (stopRawHardware) {
        rawAudioTracks.forEach((t) => {
          try {
            t.stop();
          } catch (e) {}
        });
      }
    };

    // Ensure SIP.js or WebphoneManager calling track.stop() tears down the entire DSP & hardware mic
    processedTrack.stop = () => {
      cleanupPipeline(true);
    };

    // If physical USB/Bluetooth headset disconnects, clean up AudioWorklet nodes automatically
    if (rawPrimaryTrack && typeof rawPrimaryTrack.addEventListener === "function") {
      rawPrimaryTrack.addEventListener(
        "ended",
        () => {
          cleanupPipeline(false);
        },
        { once: true }
      );
    }

    // Preserve getSettings() deviceId forwarding so device hot-swap detection knows which mic is active
    const origGetSettings =
      typeof processedTrack.getSettings === "function" ? processedTrack.getSettings.bind(processedTrack) : () => ({});
    processedTrack.getSettings = () => {
      const base = origGetSettings() || {};
      const rawSettings =
        rawPrimaryTrack && typeof rawPrimaryTrack.getSettings === "function" ? rawPrimaryTrack.getSettings() : {};
      return {
        ...base,
        deviceId: rawSettings.deviceId || base.deviceId,
        groupId: rawSettings.groupId || base.groupId,
        noiseSuppressionMode: "ai"
      };
    };

    const meta = {
      processedTrack,
      processedStream,
      rawStream,
      audioCtx,
      inputAnalyser,
      outputAnalyser,
      mode: "ai",
      cleanup: cleanupPipeline
    };

    processedStream.__noisePipeline = meta;
    processedTrack.__noisePipeline = meta;
    activePipelinesByTrackId.set(processedTrack.id, meta);

    return processedStream;
  } catch (err) {
    console.warn("[NoiseSuppression] RNNoise başlatılamadı, standart tarayıcı filtresine geçiliyor:", err);
    try {
      if (rnnoiseNode && typeof rnnoiseNode.destroy === "function") rnnoiseNode.destroy();
    } catch (e) {}
    try {
      if (audioCtx && audioCtx.state !== "closed") audioCtx.close().catch(() => {});
    } catch (e) {}
    // Enable browser native noiseSuppression on the existing raw track as fallback
    rawAudioTracks.forEach((t) => {
      if (typeof t.applyConstraints === "function") {
        t.applyConstraints({ noiseSuppression: true, echoCancellation: true }).catch(() => {});
      }
    });
    return rawStream;
  }
}

export function disposeAudioTrackAndPipeline(trackOrStream) {
  if (!trackOrStream) return;
  try {
    if (trackOrStream.__noisePipeline && typeof trackOrStream.__noisePipeline.cleanup === "function") {
      trackOrStream.__noisePipeline.cleanup(true);
      return;
    }
    if (typeof trackOrStream.getTracks === "function") {
      trackOrStream.getTracks().forEach((t) => {
        if (t.__noisePipeline && typeof t.__noisePipeline.cleanup === "function") {
          t.__noisePipeline.cleanup(true);
        } else if (activePipelinesByTrackId.has(t.id)) {
          activePipelinesByTrackId.get(t.id).cleanup(true);
        } else {
          try {
            t.stop();
          } catch (e) {}
        }
      });
      return;
    }
    if (trackOrStream.id && activePipelinesByTrackId.has(trackOrStream.id)) {
      activePipelinesByTrackId.get(trackOrStream.id).cleanup(true);
      return;
    }
    if (typeof trackOrStream.stop === "function") {
      trackOrStream.stop();
    }
  } catch (e) {}
}

/**
 * Interactive Microphone Test Session ("Kendini Dinle") for Audio Settings Modal.
 * Routes mic -> (Selected Noise Suppression Mode) -> Short 320ms Monitor Delay -> Speaker Output,
 * and emits real-time input/output audio level percentages for visual verification.
 */
export async function createMicLoopbackTester({
  micDeviceId = "",
  speakerDeviceId = "",
  mode = "ai",
  onLevels = null
}) {
  if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new Error("Mikrofon erişimi için HTTPS bağlantısı gereklidir.");
  }

  const hasMic = Boolean(micDeviceId && micDeviceId !== "default");
  const constraints = buildMicConstraintsForMode(mode, hasMic ? { ideal: micDeviceId } : null);
  const rawStream = await navigator.mediaDevices.getUserMedia(constraints);

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  let processedStream = rawStream;
  let monitorCtx = null;
  let monitorSource = null;
  let delayNode = null;
  let monitorDest = null;
  let rawAnalyser = null;
  let outAnalyser = null;
  let audioEl = null;
  let rafId = null;

  try {
    if (mode === "ai") {
      processedStream = await processMicrophoneStream(rawStream, "ai", { enableMeters: true });
    }

    monitorCtx = new AudioCtx({ latencyHint: "interactive" });
    if (monitorCtx.state === "suspended") {
      await monitorCtx.resume().catch(() => {});
    }

    rawAnalyser = monitorCtx.createAnalyser();
    rawAnalyser.fftSize = 256;
    const rawMonSrc = monitorCtx.createMediaStreamSource(rawStream);
    rawMonSrc.connect(rawAnalyser);

    monitorSource = monitorCtx.createMediaStreamSource(processedStream);
    outAnalyser = monitorCtx.createAnalyser();
    outAnalyser.fftSize = 256;

    // 320ms monitor delay so the agent hears their own phrase clearly without instant acoustic howling
    delayNode = monitorCtx.createDelay(1.0);
    delayNode.delayTime.value = 0.32;

    monitorDest = monitorCtx.createMediaStreamDestination();
    monitorSource.connect(outAnalyser);
    outAnalyser.connect(delayNode);
    delayNode.connect(monitorDest);

    audioEl = document.createElement("audio");
    audioEl.autoplay = true;
    audioEl.playsInline = true;
    audioEl.srcObject = monitorDest.stream;

    if (speakerDeviceId && speakerDeviceId !== "default" && typeof audioEl.setSinkId === "function") {
      try {
        await audioEl.setSinkId(speakerDeviceId);
      } catch (e) {}
    }

    await audioEl.play();

    const rawBuf = new Uint8Array(rawAnalyser.frequencyBinCount);
    const outBuf = new Uint8Array(outAnalyser.frequencyBinCount);

    const calcLevel = (analyser, buf) => {
      analyser.getByteTimeDomainData(buf);
      let sumSq = 0;
      for (let i = 0; i < buf.length; i++) {
        const norm = (buf[i] - 128) / 128;
        sumSq += norm * norm;
      }
      const rms = Math.sqrt(sumSq / buf.length);
      return Math.min(100, Math.round(rms * 320));
    };

    const tick = () => {
      if (typeof onLevels === "function" && rawAnalyser && outAnalyser) {
        const inputLevel = calcLevel(rawAnalyser, rawBuf);
        const outputLevel = calcLevel(outAnalyser, outBuf);
        onLevels({ inputLevel, outputLevel });
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return {
      stop: () => {
        if (rafId) cancelAnimationFrame(rafId);
        try {
          if (audioEl) {
            audioEl.pause();
            audioEl.srcObject = null;
          }
        } catch (e) {}
        disposeAudioTrackAndPipeline(processedStream);
        rawStream.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch (e) {}
        });
        if (monitorCtx && monitorCtx.state !== "closed") {
          monitorCtx.close().catch(() => {});
        }
      }
    };
  } catch (err) {
    disposeAudioTrackAndPipeline(processedStream);
    rawStream.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch (e) {}
    });
    if (monitorCtx && monitorCtx.state !== "closed") {
      monitorCtx.close().catch(() => {});
    }
    throw err;
  }
}
