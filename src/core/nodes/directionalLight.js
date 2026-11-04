import { mat4 } from 'gl-matrix';
import { Renderer } from '../renderer.js';
import { REVERSED_Z } from '../convention.js';
import { Camera3D } from './camera.js';
import { Entity3D } from './entity3d.js';

export class DirectionalLight extends Entity3D {
  /** @type { DirectionalLight } */
  static #current = null;
  static activeLights = new Set();

  static get current() {
    return DirectionalLight.#current;
  }

  static set current(value) {
    if (DirectionalLight.#current === value) return;

    if (value) {
      DirectionalLight.#current = value;
      return;
    }

    DirectionalLight.#current = DirectionalLight.activeLights.values().next().value ?? null;
  }

  // =========================

  color = [1, 1, 1];

  #size = 20;
  get size() {
    return this.#size;
  }

  set size(value) {
    this.#size = value;
    this.updateProjection();
  }

  #distance = 10;
  get distance() {
    return this.#distance;
  }

  set distance(value) {
    this.#distance = value;
    this.updateProjection();
  }

  /**
    * @param { number } size
    */
  constructor(size) {
    super();
    this.size = size || this.size;
    this.distance = this.size;
  }

  enterTree() {
    if (!DirectionalLight.current) {
      DirectionalLight.current = this;
    }
    DirectionalLight.activeLights.add(this);
  }

  exitTree() {
    DirectionalLight.activeLights.delete(this);

    if (DirectionalLight.current === this) {
      DirectionalLight.current = null;
    }
  }

  makeCurrent() {
    DirectionalLight.current = this;
  }

  update() {
    if (!Camera3D.current) return;
    const cameraPosition = Camera3D.current.globalTransform.origin;
    const forward = this.transform.forward;

    this.transform.origin = cameraPosition.map((v, i) => v - forward[i] * this.distance);
  }

  /**
    * @param { GPUBuffer } buffer
    * @param { number } offset
    */
  writeLightDataToBuffer(buffer, offset = 0) {
    Renderer.device.queue.writeBuffer(buffer, offset + 0, this.globalTransform.inverse().data);
    Renderer.device.queue.writeBuffer(buffer, offset + 64, this.projection);
    Renderer.device.queue.writeBuffer(buffer, offset + 128, new Float32Array(this.color));
  }

  updateProjection() {
    const half = this.size / 2;
    const near = REVERSED_Z ? this.distance * 3 : 0.0001;
    const far = REVERSED_Z ? 0.0001 : this.distance * 3;
    this.projection = mat4.orthoZO(mat4.create(), -half, half, -half, half, near, far);
  }

  /**
    * @param { GPUDevice } device
    * @param { GPUBuffer } buffer
    * @param { number } offset
    */
  writeToBuffer(device, buffer, offset = 0) {
    const viewMatrix = this.globalTransform.inverse().data;
    device.queue.writeBuffer(buffer, offset + 0, viewMatrix);
    device.queue.writeBuffer(buffer, offset + 64, this.globalTransform.data);
    device.queue.writeBuffer(buffer, offset + 128, this.projection);
  }
}
