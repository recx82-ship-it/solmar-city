// Synthesized sound and music, all WebAudio, no audio files: an engine hum
// that follows the car's speed, a two-tone police siren, gunshots, pickup
// blips and a small looping bass-and-keys groove for the city.

export function createAudio() {
  let context = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let sirenHigh = false;
  let musicTimer = null;
  let musicStep = 0;
  let muted = false;
  let ready = false;

  /** Create the context on the first user gesture; safe to call any time. */
  function init() {
    if (ready) return true;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return false;
      context = new AudioContextClass();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);

      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      const engineFilter = context.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();

      sirenOsc = context.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 720;
      sirenGain = context.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();

      ready = true;
      return true;
    } catch {
      return false;
    }
  }

  function resume() {
    if (context && context.state === 'suspended') context.resume().catch(() => {});
  }

  function setMuted(value) {
    muted = value;
    if (master && context) master.gain.setValueAtTime(muted ? 0 : 0.5, context.currentTime);
  }

  function isMuted() {
    return muted;
  }

  function isReady() {
    return ready;
  }

  /** Called every frame: engine pitch follows speed, siren wails when wanted. */
  function update(dt, speed, wanted) {
    if (!ready || !context) return;
    const target = speed > 12 ? 0.045 + Math.min(0.075, speed / 9000) : 0;
    engineGain.gain.setTargetAtTime(target, context.currentTime, 0.08);
    engineOsc.frequency.setTargetAtTime(52 + Math.min(150, speed * 0.22), context.currentTime, 0.08);
    if (wanted > 0) {
      sirenTimer -= dt;
      if (sirenTimer <= 0) {
        sirenTimer = 0.42;
        sirenHigh = !sirenHigh;
        sirenOsc.frequency.setTargetAtTime(sirenHigh ? 880 : 660, context.currentTime, 0.05);
      }
      sirenGain.gain.setTargetAtTime(0.05, context.currentTime, 0.1);
    } else {
      sirenGain.gain.setTargetAtTime(0, context.currentTime, 0.1);
    }
  }

  function blip(frequency, duration, type, volume, slideTo) {
    if (!ready || !context) return;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(frequency, context.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, context.currentTime + duration);
    gain.gain.setValueAtTime(volume || 0.12, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(context.currentTime + duration + 0.02);
  }

  function noiseBurst(duration, volume, frequency) {
    if (!ready || !context) return;
    const length = Math.floor(context.sampleRate * duration);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = frequency || 1800;
    const gain = context.createGain();
    gain.gain.value = volume || 0.25;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();
  }

  function shoot() {
    noiseBurst(0.12, 0.3, 2400);
    blip(160, 0.08, 'square', 0.1, 60);
  }

  function punch() {
    noiseBurst(0.08, 0.18, 900);
  }

  function steal() {
    blip(320, 0.12, 'square', 0.12, 520);
    setTimeout(() => blip(520, 0.14, 'square', 0.12, 760), 110);
  }

  function pickup() {
    blip(660, 0.1, 'sine', 0.14);
    setTimeout(() => blip(880, 0.16, 'sine', 0.14), 90);
  }

  function missionDone() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((note, index) => setTimeout(() => blip(note, 0.22, 'triangle', 0.16), index * 130));
  }

  function wasted() {
    blip(220, 0.5, 'sawtooth', 0.14, 55);
  }

  // A lazy groove: A-minor bass line and a sparse electric-piano-ish lead,
  // one 8th-note step at a time, scheduled with plain timers.
  const BASS = [55, 0, 55, 0, 65.4, 0, 55, 0, 49, 0, 49, 0, 58.3, 0, 65.4, 0];
  const LEAD = [220, 0, 261.6, 0, 329.6, 0, 261.6, 0, 196, 0, 246.9, 0, 293.7, 0, 329.6, 0];

  function startMusic() {
    if (!ready || musicTimer) return;
    musicTimer = setInterval(() => {
      if (muted) return;
      const bass = BASS[musicStep % BASS.length];
      const lead = LEAD[musicStep % LEAD.length];
      if (bass) blip(bass, 0.22, 'triangle', 0.14);
      if (lead && musicStep % 2 === 0) blip(lead, 0.3, 'sine', 0.05);
      musicStep += 1;
    }, 240);
  }

  function stopMusic() {
    if (musicTimer) {
      clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  return {
    init,
    resume,
    setMuted,
    isMuted,
    isReady,
    update,
    shoot,
    punch,
    steal,
    pickup,
    missionDone,
    wasted,
    startMusic,
    stopMusic,
  };
}
