/** Procedural sound effects (WebAudio), no asset files needed. */
export const Sfx = new class Sfx {
  #ctx = null;
  #master = null;

  constructor() {
    // Browsers only allow audio after a user gesture.
    const unlock = () => {
      this.#ensure()?.resume();
    };
    for (const type of ['keydown', 'pointerdown']) window.addEventListener(type, unlock);
  }

  #ensure() {
    if (!this.#ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.#ctx = new AC();
      this.#master = this.#ctx.createGain();
      this.#master.gain.value = 0.35;
      this.#master.connect(this.#ctx.destination);
    }
    return this.#ctx;
  }

  /**
   * @param { object } o
   * @param { OscillatorType } [o.type]
   * @param { number } o.from  Start frequency.
   * @param { number } [o.to]  End frequency.
   * @param { number } o.dur   Duration in seconds.
   * @param { number } [o.vol]
   * @param { number } [o.delay]
   */
  #tone({ type = 'sine', from, to = from, dur, vol = 0.5, delay = 0 }) {
    const ctx = this.#ensure();
    if (!ctx || ctx.state !== 'running') return;

    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(gain).connect(this.#master);
    osc.start(t);
    osc.stop(t + dur);
  }

  #noise(dur, vol = 0.4, delay = 0) {
    const ctx = this.#ensure();
    if (!ctx || ctx.state !== 'running') return;

    const t = ctx.currentTime + delay;
    const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * dur)), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    src.buffer = buffer;
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    src.connect(filter).connect(gain).connect(this.#master);
    src.start(t);
  }

  step() { this.#tone({ type: 'sine', from: 140, to: 60, dur: 0.12, vol: 0.5 }); }
  blocked() { this.#tone({ type: 'square', from: 90, to: 70, dur: 0.08, vol: 0.15 }); }
  push() { this.#noise(0.25, 0.5); this.#tone({ type: 'triangle', from: 80, to: 50, dur: 0.25, vol: 0.4 }); }
  pickup() {
    this.#tone({ type: 'triangle', from: 880, dur: 0.1, vol: 0.4 });
    this.#tone({ type: 'triangle', from: 1320, dur: 0.18, vol: 0.4, delay: 0.08 });
  }
  unlock() {
    this.#tone({ type: 'square', from: 300, to: 200, dur: 0.08, vol: 0.25 });
    this.#tone({ type: 'square', from: 500, to: 700, dur: 0.12, vol: 0.25, delay: 0.1 });
    this.#noise(0.4, 0.3, 0.12);
  }
  doorOpen() { this.#noise(0.6, 0.45); this.#tone({ type: 'sawtooth', from: 70, to: 110, dur: 0.6, vol: 0.2 }); }
  doorClose() { this.#noise(0.5, 0.45); this.#tone({ type: 'sawtooth', from: 110, to: 55, dur: 0.5, vol: 0.2 }); }
  plate() { this.#tone({ type: 'square', from: 200, to: 260, dur: 0.07, vol: 0.2 }); }
  crumble() { this.#noise(0.5, 0.6); this.#tone({ type: 'triangle', from: 120, to: 40, dur: 0.5, vol: 0.4 }); }
  teleport() { this.#tone({ type: 'sine', from: 300, to: 1600, dur: 0.35, vol: 0.35 }); this.#tone({ type: 'sine', from: 1600, to: 300, dur: 0.35, vol: 0.3, delay: 0.3 }); }
  win() {
    [523, 659, 784, 1047].forEach((f, i) => this.#tone({ type: 'triangle', from: f, dur: 0.35, vol: 0.4, delay: i * 0.13 }));
  }
};
