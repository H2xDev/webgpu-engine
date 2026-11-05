/** Procedural drone ambience (WebAudio): detuned low oscillators, slowly breathing filters, faint airy noise. Press M to mute. */
const ROOT = 45; // A1
const VOLUME = 0.25;

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

export const Music = new class Music {
  #ctx = null;
  #out = null;
  #started = false;
  muted = false;

  constructor() {
    const start = () => this.start();
    for (const type of ['keydown', 'pointerdown']) window.addEventListener(type, start);

    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyM') this.toggleMute();
    });
  }

  start() {
    if (!this.#ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.#ctx = new AC();
      this.#out = this.#ctx.createGain();
      this.#out.gain.value = 0.0001;
      this.#out.connect(this.#ctx.destination);
    }

    this.#ctx.resume();
    if (this.#started) return;
    this.#started = true;

    this.#drone();
    this.#air();
    this.#out.gain.setTargetAtTime(this.muted ? 0 : VOLUME, this.#ctx.currentTime, 4);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (!this.#out) return;
    this.#out.gain.setTargetAtTime(this.muted ? 0 : VOLUME, this.#ctx.currentTime, 0.2);
  }

  /** Slow sine LFO that modulates an AudioParam by +-depth. */
  #lfo(param, rate, depth) {
    const ctx = this.#ctx;
    const lfo = ctx.createOscillator();
    const amount = ctx.createGain();
    lfo.frequency.value = rate;
    amount.gain.value = depth;
    lfo.connect(amount).connect(param);
    lfo.start();
  }

  #drone() {
    const ctx = this.#ctx;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    filter.Q.value = 2;
    this.#lfo(filter.frequency, 0.04, 250);
    filter.connect(this.#out);

    // Root, fifth and octaves, each as a slightly detuned pair so they beat slowly.
    const voices = [
      { note: ROOT - 12, gain: 0.5, type: 'sine' },
      { note: ROOT, gain: 0.45, type: 'sawtooth' },
      { note: ROOT + 7, gain: 0.25, type: 'triangle' },
      { note: ROOT + 12, gain: 0.2, type: 'sawtooth' },
      { note: ROOT + 19, gain: 0.1, type: 'sine' },
    ];

    voices.forEach(({ note, gain, type }, i) => {
      const level = ctx.createGain();
      level.gain.value = gain * 0.35;
      this.#lfo(level.gain, 0.03 + i * 0.013, gain * 0.15);
      level.connect(filter);

      for (const detune of [-7, 7]) {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.value = midi(note);
        osc.detune.value = detune;
        this.#lfo(osc.detune, 0.05 + i * 0.01, 4);
        osc.connect(level);
        osc.start();
      }
    });
  }

  #air() {
    const ctx = this.#ctx;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 600;
    filter.Q.value = 4;
    this.#lfo(filter.frequency, 0.025, 300);

    const gain = ctx.createGain();
    gain.gain.value = 0.04;
    this.#lfo(gain.gain, 0.07, 0.025);

    src.connect(filter).connect(gain).connect(this.#out);
    src.start();
  }
};
