import { Renderer } from "../renderer.js";
import { Entity3D } from "./entity3d.js";
import { PostProcessPass } from "../rendering/postProcessPass.js";

/**
  * @typedef {Object} PostProcessOptions
  * @property { number } [aaEdgeThreshold]
  * @property { number } [aaSpan]
  * @property { number } [cameraNear]
  * @property { number } [cameraFar]
  * @property { number } [vingetteIntensity]
  * @property { number } [vingetteRadius]
  * @property { number } [vingetteSoftness]
  * @property { number } [dofFocusDistance]
  * @property { number } [dofAperture]
  * @property { number } [dofMaxRadius]
  * @property { number } [dofSamples]
  * @property { number } [aoIntensity]
  * @property { number } [aoRadius]
  */

export class PostProcess extends Entity3D {
  /** @type { PostProcess } */
  static current_;

  /** @type { Set<PostProcess> } */
  static activePostProcesses = new Set();

  static get current() {
    return PostProcess.current_;
  }

  static set current(value) {
    if (value) {
      PostProcess.current_ = value;
      PostProcessPass.instance.currentUniformBuffer = value?.uniformBuffer ?? null;
    } else {
      PostProcess.current_ = PostProcess.activePostProcesses.values().next().value ?? null;
      PostProcessPass.instance.currentUniformBuffer = PostProcess.current_?.uniformBuffer ?? null;
    }
  }


  #aaEdgeThreshold = 0.02;
  #aaSpan = 1.5;

  #cameraNear = 0.1;
  #cameraFar = 4000.0;

  #vingetteIntensity = 1.0;
  #vingetteRadius = 0.75;
  #vingetteSoftness = 0.45;

  #dofFocusDistance = 5.0;
  #dofAperture = 4.0;
  #dofMaxRadius = 10.0;
  #dofSamples = 32;

  #aoIntensity = 1.0;
  #aoRadius = 0.5;

  uniformBuffer = null;

  get aoIntensity() {
    return this.#aoIntensity;
  }

  set aoIntensity(value) {
    this.#aoIntensity = value;
    Renderer.device.queue.writeBuffer(this.uniformBuffer, 44, new Float32Array([this.#aoIntensity]));
  }

  get aoRadius() {
    return this.#aoRadius;
  }

  set aoRadius(value) {
    this.#aoRadius = value;
    Renderer.device.queue.writeBuffer(this.uniformBuffer, 48, new Float32Array([this.#aoRadius]));
  }

  get aaEdgeThreshold() {
    return this.#aaEdgeThreshold;
  }

  set aaEdgeThreshold(value) {
    this.#aaEdgeThreshold = value;
    Renderer.device.queue.writeBuffer(this.uniformBuffer, 0, new Float32Array([this.#aaEdgeThreshold]));
  }

  get aaSpan() {
    return this.#aaSpan;
  }

  set aaSpan(value) {
    this.#aaSpan = value;
    Renderer.device.queue.writeBuffer(this.uniformBuffer, 4, new Float32Array([this.#aaSpan]));
  }

  get cameraNear() {
    return this.#cameraNear;
  }

  set cameraNear(value) {
    this.#cameraNear = value;
    Renderer.device.queue.writeBuffer(this.uniformBuffer, 8, new Float32Array([this.#cameraNear]));
  }

  get cameraFar() {
    return this.#cameraFar;
  }

  set cameraFar(value) {
    this.#cameraFar = value;
    Renderer.device.queue.writeBuffer(this.uniformBuffer, 12, new Float32Array([this.#cameraFar]));
  }

  get vingetteIntensity() {
    return this.#vingetteIntensity;
  }

  set vingetteIntensity(value) {
    this.#vingetteIntensity = value;
    Renderer.device.queue.writeBuffer(this.uniformBuffer, 16, new Float32Array([this.#vingetteIntensity]));
  }

  get vingetteRadius() {
    return this.#vingetteRadius;
  }

  set vingetteRadius(value) {
    this.#vingetteRadius = value;
    Renderer.device.queue.writeBuffer(this.uniformBuffer, 20, new Float32Array([this.#vingetteRadius]));
  }

  get vingetteSoftness() {
    return this.#vingetteSoftness;
  }

  set vingetteSoftness(value) {
    this.#vingetteSoftness = value;
    Renderer.device.queue.writeBuffer(this.uniformBuffer, 24, new Float32Array([this.#vingetteSoftness]));
  }

  get dofFocusDistance() {
    return this.#dofFocusDistance;
  }

  set dofFocusDistance(value) {
    this.#dofFocusDistance = value;
    Renderer.device.queue.writeBuffer(this.uniformBuffer, 28, new Float32Array([this.#dofFocusDistance]));
  }

  get dofAperture() {
    return this.#dofAperture;
  }

  set dofAperture(value) {
    this.#dofAperture = value;
    Renderer.device.queue.writeBuffer(this.uniformBuffer, 32, new Float32Array([this.#dofAperture]));
  }

  get dofMaxRadius() {
    return this.#dofMaxRadius;
  }

  set dofMaxRadius(value) {
    this.#dofMaxRadius = value;
    Renderer.device.queue.writeBuffer(this.uniformBuffer, 36, new Float32Array([this.#dofMaxRadius]));
  }

  get dofSamples() {
    return this.#dofSamples;
  }

  set dofSamples(value) {
    this.#dofSamples = value;
    Renderer.device.queue.writeBuffer(this.uniformBuffer, 40, new Uint32Array([this.#dofSamples]));
  }

  constructor(options = {}) {
    super();

    this.uniformBuffer = Renderer.device.createBuffer({
        size: 64,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    const data = new ArrayBuffer(64);
    new Float32Array(data, 0, 10).set([
      this.#aaEdgeThreshold,
      this.#aaSpan,
      this.#cameraNear,
      this.#cameraFar,
      this.#vingetteIntensity,
      this.#vingetteRadius,
      this.#vingetteSoftness,
      this.#dofFocusDistance,
      this.#dofAperture,
      this.#dofMaxRadius,
    ]);
    new Uint32Array(data, 40, 1)[0] = this.#dofSamples;
    new Float32Array(data, 44, 2).set([this.#aoIntensity, this.#aoRadius]);
    Renderer.device.queue.writeBuffer(this.uniformBuffer, 0, data);

    this.#assignOptions(options);
  }

  enterTree() {
    PostProcess.activePostProcesses.add(this);
    if (PostProcess.current) return;
    PostProcess.current = this;
  }

  exitTree() {
    PostProcess.activePostProcesses.delete(this);
    if (PostProcess.current === this) {
      PostProcess.current = null;
    }
  }

  /**
   * @param { PostProcessOptions } options
   */
  #assignOptions(options) {
    this.#verifyOptions(options);
    Object.assign(this, options);
  }

  /**
   * @param { PostProcessOptions } options
   */
  #verifyOptions(options) {
    const validKeys = [
      "aaEdgeThreshold",
      "aaSpan",
      "cameraNear",
      "cameraFar",
      "vingetteIntensity",
      "vingetteRadius",
      "vingetteSoftness",
      "dofFocusDistance",
      "dofAperture",
      "dofMaxRadius",
      "dofSamples",
      "aoIntensity",
      "aoRadius",
    ];

    const keys = Object.keys(options);

    for (const key of keys) {
      if (!validKeys.includes(key)) {
        throw new Error(`Invalid option key: ${key}`);
      }
    }
  }
}
