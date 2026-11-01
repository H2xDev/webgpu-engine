import { Renderer } from "../renderer.js";
import { Entity3D } from "./entity3d.js";
import { PostProcessPass } from "../rendering/postProcessPass.js";

export class PostProcess extends Entity3D {
  /** @type { PostProcess } */
  static current_;

  static get current() {
    return PostProcess.current_;
  }

  /** @param { PostProcess } value */
  static set current(value) {
    PostProcess.current_ = value;
    PostProcessPass.instance.currentUniformBuffer = value.uniformBuffer;
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

  uniformBuffer = null;

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
    Renderer.device.queue.writeBuffer(this.uniformBuffer, 0, data);

    this.#assignOptions(options);
  }

  enterTree() {
    if (PostProcess.current) return;
    PostProcess.current = this;
  }

  exitTree() {
    if (PostProcess.current === this) {
      PostProcess.current = null;
    }
  }

  #assignOptions(options) {
    this.#verifyOptions(options);
    Object.assign(this, options);
  }

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
      "dofSamples"
    ];

    for (const key of Object.keys(options)) {
      if (!validKeys.includes(key)) {
        throw new Error(`Invalid option key: ${key}`);
      }
    }
  }
}
