const c1 = 1.70158;
const c2 = c1 * 1.525;
const c3 = c1 + 1;
const c4 = (2 * Math.PI) / 3;
const c5 = (2 * Math.PI) / 4.5;

const bounceOut = (x) => {
  const n1 = 7.5625;
  const d1 = 2.75;

  if (x < 1 / d1) return n1 * x * x;
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
  return n1 * (x -= 2.625 / d1) * x + 0.984375;
};

// Easing curves from https://easings.net
const easings = {
  linear: (x) => x,

  easeInSine: (x) => 1 - Math.cos((x * Math.PI) / 2),
  easeOutSine: (x) => Math.sin((x * Math.PI) / 2),
  easeInOutSine: (x) => -(Math.cos(Math.PI * x) - 1) / 2,

  easeInQuad: (x) => x * x,
  easeOutQuad: (x) => 1 - (1 - x) ** 2,
  easeInOutQuad: (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2),

  easeInCubic: (x) => x ** 3,
  easeOutCubic: (x) => 1 - (1 - x) ** 3,
  easeInOutCubic: (x) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2),

  easeInQuart: (x) => x ** 4,
  easeOutQuart: (x) => 1 - (1 - x) ** 4,
  easeInOutQuart: (x) => (x < 0.5 ? 8 * x ** 4 : 1 - (-2 * x + 2) ** 4 / 2),

  easeInQuint: (x) => x ** 5,
  easeOutQuint: (x) => 1 - (1 - x) ** 5,
  easeInOutQuint: (x) => (x < 0.5 ? 16 * x ** 5 : 1 - (-2 * x + 2) ** 5 / 2),

  easeInExpo: (x) => (x === 0 ? 0 : 2 ** (10 * x - 10)),
  easeOutExpo: (x) => (x === 1 ? 1 : 1 - 2 ** (-10 * x)),
  easeInOutExpo: (x) => {
    if (x === 0) return 0;
    if (x === 1) return 1;
    return x < 0.5 ? 2 ** (20 * x - 10) / 2 : (2 - 2 ** (-20 * x + 10)) / 2;
  },

  easeInCirc: (x) => 1 - Math.sqrt(1 - x * x),
  easeOutCirc: (x) => Math.sqrt(1 - (x - 1) ** 2),
  easeInOutCirc: (x) => (x < 0.5
    ? (1 - Math.sqrt(1 - (2 * x) ** 2)) / 2
    : (Math.sqrt(1 - (-2 * x + 2) ** 2) + 1) / 2),

  easeInBack: (x) => c3 * x ** 3 - c1 * x * x,
  easeOutBack: (x) => 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2,
  easeInOutBack: (x) => (x < 0.5
    ? ((2 * x) ** 2 * ((c2 + 1) * 2 * x - c2)) / 2
    : ((2 * x - 2) ** 2 * ((c2 + 1) * (x * 2 - 2) + c2) + 2) / 2),

  easeInElastic: (x) => {
    if (x === 0) return 0;
    if (x === 1) return 1;
    return -(2 ** (10 * x - 10)) * Math.sin((x * 10 - 10.75) * c4);
  },
  easeOutElastic: (x) => {
    if (x === 0) return 0;
    if (x === 1) return 1;
    return 2 ** (-10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
  },
  easeInOutElastic: (x) => {
    if (x === 0) return 0;
    if (x === 1) return 1;
    return x < 0.5
      ? -(2 ** (20 * x - 10) * Math.sin((20 * x - 11.125) * c5)) / 2
      : (2 ** (-20 * x + 10) * Math.sin((20 * x - 11.125) * c5)) / 2 + 1;
  },

  easeInBounce: (x) => 1 - bounceOut(1 - x),
  easeOutBounce: bounceOut,
  easeInOutBounce: (x) => (x < 0.5
    ? (1 - bounceOut(1 - 2 * x)) / 2
    : (1 + bounceOut(2 * x - 1)) / 2),
};

/**
 * Animates a numeric property (or each element of a numeric array) using requestAnimationFrame.
 */
export class Tween {
  /** Available easing names (see https://easings.net) */
  static easings = Object.freeze(Object.keys(easings));

  /**
   * Starts a tween on `object[key]`.
   * @param { object } object
   * @param { string } key
   * @param { number | number[] } newValue
   * @param { number } time Duration in milliseconds
   * @param { string } [easing='linear']
   * @returns { Promise<boolean> } Resolves `true` when finished, `false` if stopped early
   */
  static property(object, key, newValue, time, easing = 'linear') {
    return new Tween(object, key, newValue, time, easing).start();
  }

  object;
  key;
  to;
  duration;
  easing;
  running = false;

  /** @type { ((value: any, progress: number) => void) | null } */
  onUpdate = null;

  /** @type { (() => void) | null } */
  onComplete = null;

  #from = null;
  #startTime = null;
  #frameId = null;
  #promise = null;
  #resolve = null;

  /**
   * @param { object } object
   * @param { string } key
   * @param { number | number[] } to
   * @param { number } duration Duration in milliseconds
   * @param { string } [easing='linear']
   */
  constructor(object, key, to, duration, easing = 'linear') {
    if (!(easing in easings)) {
      throw new Error(`Unknown easing "${easing}"`);
    }

    this.object = object;
    this.key = key;
    this.to = to;
    this.duration = duration;
    this.easing = easings[easing];
  }

  /**
   * @returns { Promise<boolean> } Resolves `true` when finished, `false` if stopped early
   */
  start() {
    if (this.running) return this.#promise;

    const current = this.object[this.key];
    this.#from = ArrayBuffer.isView(current) || Array.isArray(current)
      ? Array.from(current)
      : current;

    this.#promise = new Promise((resolve) => { this.#resolve = resolve; });
    this.#startTime = null;
    this.running = true;
    this.#frameId = requestAnimationFrame(this.#tick);
    return this.#promise;
  }

  stop() {
    if (!this.running) return this;

    if (this.#frameId !== null) cancelAnimationFrame(this.#frameId);
    this.#frameId = null;
    this.running = false;
    this.#resolve(false);
    return this;
  }

  #tick = (now) => {
    this.#startTime ??= now;

    const t = this.duration <= 0
      ? 1
      : Math.min((now - this.#startTime) / this.duration, 1);

    this.#apply(this.easing(t));
    this.onUpdate?.(this.object[this.key], t);

    if (t >= 1) {
      this.running = false;
      this.#frameId = null;
      this.onComplete?.();
      this.#resolve(true);
      return;
    }

    this.#frameId = requestAnimationFrame(this.#tick);
  };

  #apply(progress) {
    let target = this.object[this.key];

    if (Array.isArray(this.#from)) {
      for (let i = 0; i < this.#from.length; i++) {
        const from = this.#from[i];
        target[i] = from + (this.to[i] - from) * progress;
      }

      this.object[this.key] = target;
      return;
    }

    this.object[this.key] = this.#from + (this.to - this.#from) * progress;
  }
}
