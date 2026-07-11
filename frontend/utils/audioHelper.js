// Shared Web Audio API Ringtone Synthesizer
let audioCtx = null;
let ringtoneInterval = null;

export const playRingtoneSound = (type = "classic", sinkId = null) => {
  // Stop existing
  stopRingtoneSound();
  
  if (typeof window === "undefined") return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  
  audioCtx = new AudioContext();
  if (sinkId && typeof audioCtx.setSinkId === "function") {
    audioCtx.setSinkId(sinkId).catch(err => {
      console.warn("[AudioHelper] AudioContext sinkId setting failed:", err);
    });
  }
  
  const playPulse = () => {
    if (!audioCtx || audioCtx.state === "closed") return;
    
    const now = audioCtx.currentTime;

    if (type === "classic") {
      // Classic USA double ring: 440Hz + 480Hz modulated
      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc1.type = "sine";
      osc2.type = "sine";
      osc1.frequency.value = 440;
      osc2.frequency.value = 480;
      
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.12, now + 0.05);
      gainNode.gain.setValueAtTime(0.12, now + 1.8);
      gainNode.gain.linearRampToValueAtTime(0, now + 2.0);
      
      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      osc1.start();
      osc2.start();
      
      osc1.stop(now + 2.0);
      osc2.stop(now + 2.0);
    } else if (type === "digital") {
      // Modern electronic beep chime
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(1100, now + 0.1);
      osc.frequency.setValueAtTime(880, now + 0.2);
      osc.frequency.setValueAtTime(1100, now + 0.3);
      
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.15, now + 0.02);
      gainNode.gain.setValueAtTime(0.15, now + 0.4);
      gainNode.gain.linearRampToValueAtTime(0, now + 0.5);
      
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      osc.start();
      osc.stop(now + 0.5);
    } else if (type === "melody") {
      // Gentle marimba chord
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + i * 0.08);
        
        gainNode.gain.setValueAtTime(0, now + i * 0.08);
        gainNode.gain.linearRampToValueAtTime(0.08, now + i * 0.08 + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.08 + 0.8);
        
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.8);
      });
    } else if (type === "futuristic") {
      // Sci-fi sweep
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(1400, now + 0.35);
      
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.08, now + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
      
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      osc.start();
      osc.stop(now + 0.4);
    } else if (type === "marimba") {
      // Classic phone marimba scale (8 notes arpeggio)
      const marimbaNotes = [440, 554.37, 659.25, 880, 659.25, 880, 1109, 1318.5]; // A4, C#5, E5, A5 arpeggios
      marimbaNotes.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.type = "triangle";
        osc.frequency.value = freq;
        
        gainNode.gain.setValueAtTime(0, now + i * 0.1);
        gainNode.gain.linearRampToValueAtTime(0.12, now + i * 0.1 + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.1 + 0.4);
        
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.start(now + i * 0.1);
        osc.stop(now + i * 0.1 + 0.45);
      });
    } else if (type === "vintage") {
      // Mechanical ring bell: modulating high frequency 2000Hz
      const osc = audioCtx.createOscillator();
      const modulator = audioCtx.createOscillator();
      const modGain = audioCtx.createGain();
      const gainNode = audioCtx.createGain();
      
      osc.type = "sine";
      osc.frequency.value = 2500;
      
      modulator.type = "sine";
      modulator.frequency.value = 25; // 25Hz vibration
      modGain.gain.value = 500; // Modulate freq by 500Hz
      
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.08, now + 0.05);
      gainNode.gain.setValueAtTime(0.08, now + 1.2);
      gainNode.gain.linearRampToValueAtTime(0, now + 1.4);
      
      modulator.connect(modGain);
      modGain.connect(osc.frequency);
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      modulator.start();
      osc.start();
      
      modulator.stop(now + 1.4);
      osc.stop(now + 1.4);
    } else if (type === "echo") {
      // Ambient echo chime
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      const delay = audioCtx.createDelay();
      const feedback = audioCtx.createGain();
      
      osc.type = "sine";
      osc.frequency.value = 987.77; // B5
      
      delay.delayTime.value = 0.25;
      feedback.gain.value = 0.5; // echo volume multiplier
      
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.12, now + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
      
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      // Delay loop setup
      gainNode.connect(delay);
      delay.connect(feedback);
      feedback.connect(delay);
      feedback.connect(audioCtx.destination);
      
      osc.start();
      osc.stop(now + 0.6);
    } else if (type === "organ") {
      // Classic electric organ chord progression: C -> G
      const chordC = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
      const chordG = [293.66, 392.00, 493.88, 587.33]; // D4, G4, B4, D5
      
      // Part 1: C Chord
      chordC.forEach((freq) => {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.type = "triangle";
        osc.frequency.value = freq;
        
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.04, now + 0.1);
        gainNode.gain.setValueAtTime(0.04, now + 0.5);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.6);
        
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.start();
        osc.stop(now + 0.6);
      });

      // Part 2: G Chord
      chordG.forEach((freq) => {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.type = "triangle";
        osc.frequency.value = freq;
        
        gainNode.gain.setValueAtTime(0, now + 0.65);
        gainNode.gain.linearRampToValueAtTime(0.04, now + 0.75);
        gainNode.gain.setValueAtTime(0.04, now + 1.25);
        gainNode.gain.linearRampToValueAtTime(0, now + 1.35);
        
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.start(now + 0.65);
        osc.stop(now + 1.35);
      });
    }
  };
  
  // Play immediately
  playPulse();
  
  // Setup loop interval
  let intervalTime = 1800;
  if (type === "classic") intervalTime = 4000;
  else if (type === "vintage") intervalTime = 3000;
  else if (type === "organ") intervalTime = 2500;
  
  ringtoneInterval = setInterval(playPulse, intervalTime);
};

export const stopRingtoneSound = () => {
  if (ringtoneInterval) {
    clearInterval(ringtoneInterval);
    ringtoneInterval = null;
  }
  if (audioCtx) {
    try {
      audioCtx.close();
    } catch(e){}
    audioCtx = null;
  }
};
