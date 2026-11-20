// Sound, all synthesised with WebAudio: no audio files, no network. An engine hum
// that follows the car's speed, a two-tone siren when police are near, gunshots,
// pickups, a mission jingle and a quiet bass-and-pad loop for the drive. Everything
// waits for the first user gesture (the start button), as browsers require.

export function createAudio() {
  let context = null;
  let master = null;
  let musicGain = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.55;
      master.connect(context.destination);
      musicGain = context.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      engineGain.connect(master);
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineOsc2 = context.createOscillator();
      engineOsc2.type = 'square';
      engineOsc2.frequency.value = 28;
      engineOsc.connect(engineGain);
      engineOsc2.connect(engineGain);
      engineOsc.start();
      engineOsc2.start();
      sirenGain = context.createGain();
      sirenGain.gain.value = 0;
      sirenGain.connect(master);
      sirenOsc = context.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 700;
      sirenOsc.connect(sirenGain);
      sirenOsc.start();
      started = true;
      startMusic();
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, when = 0, slideTo = 0) {
    if (!context || muted) return;
    const t = context.currentTime + when;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  function noise(dur, vol, filterFreq) {
    if (!context || muted) return;
    const t = context.currentTime;
    const length = Math.max(1, Math.floor(context.sampleRate * dur));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = context.createGain();
    gain.gain.value = vol;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(t);
  }

  // A slow, sunny bass-and-pad loop: Am – F – C – G, one bar a second, quiet under play.
  const CHORDS = [
    [110.0, 220.0, 261.6, 329.6],
    [87.3, 174.6, 261.6, 349.2],
    [130.8, 196.0, 261.6, 329.6],
    [98.0, 196.0, 246.9, 293.7],
  ];
  function startMusic() {
    if (musicTimer !== null || !context) return;
    let bar = 0;
    const playBar = () => {
      if (!context || muted) return;
      const chord = CHORDS[bar % CHORDS.length];
      bar += 1;
      const t = context.currentTime;
      chord.forEach((freq, index) => {
        const osc = context.createOscillator();
        const gain = context.createGain();
        osc.type = index === 0 ? 'triangle' : 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(index === 0 ? 0.5 : 0.12, t + 0.15);
        gain.gain.setValueAtTime(index === 0 ? 0.5 : 0.12, t + 0.85);
        gain.gain.linearRampToValueAtTime(0, t + 1.05);
        osc.connect(gain);
        gain.connect(musicGain);
        osc.start(t);
        osc.stop(t + 1.1);
      });
    };
    playBar();
    musicTimer = window.setInterval(playBar, 1000);
  }

  return {
    get muted() {
      return muted;
    },
    /** Call from the start button's click: browsers need a gesture before sound. */
    unlock() {
      if (ensure() && context.state === 'suspended') context.resume();
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.55;
      return muted;
    },
    /** 0 = silent, 1 = full speed: the engine follows the driven car. */
    engine(level) {
      if (!context || !started) return;
      const target = muted ? 0 : level * 0.11;
      engineGain.gain.setTargetAtTime(target, context.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(52 + level * 130, context.currentTime, 0.08);
      engineOsc2.frequency.setTargetAtTime(26 + level * 64, context.currentTime, 0.08);
    },
    /** 0 = off, 1 = close: the siren wails when police are chasing. */
    siren(level) {
      if (!context || !started) return;
      sirenGain.gain.setTargetAtTime(muted ? 0 : level * 0.05, context.currentTime, 0.2);
      const now = context.currentTime;
      sirenOsc.frequency.setTargetAtTime(now % 1 < 0.5 ? 720 : 540, now, 0.05);
    },
    gunshot() {
      noise(0.14, 0.5, 2400);
      tone(160, 0.1, 'square', 0.22, 0, 60);
    },
    punch() {
      noise(0.09, 0.3, 700);
    },
    pickup() {
      tone(660, 0.09, 'sine', 0.25);
      tone(990, 0.14, 'sine', 0.25, 0.08);
    },
    cash() {
      tone(880, 0.08, 'triangle', 0.25);
      tone(1174, 0.08, 'triangle', 0.25, 0.07);
      tone(1568, 0.16, 'triangle', 0.25, 0.14);
    },
    crash() {
      noise(0.25, 0.45, 900);
      tone(90, 0.22, 'sawtooth', 0.25, 0, 40);
    },
    missionDone() {
      [523, 659, 784, 1046].forEach((freq, i) => tone(freq, 0.22, 'triangle', 0.28, i * 0.11));
    },
    phone() {
      tone(1180, 0.12, 'sine', 0.22);
      tone(1180, 0.12, 'sine', 0.22, 0.22);
    },
    busted() {
      [392, 330, 262].forEach((freq, i) => tone(freq, 0.3, 'sawtooth', 0.2, i * 0.18));
    },
  };
}
