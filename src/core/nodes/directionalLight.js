import { mat4, vec3 } from 'gl-matrix';
import { Renderer } from '../renderer.js';
import { REVERSED_Z } from '../convention.js';

import { Camera3D } from './camera.js';

export class DirectionalLight extends Camera3D {
  size = 20;
  distance_ = 10;
  color = [1, 1, 1];

  get distance() {
    return this.distance_;
  }

  set distance(value) {
    this.distance_ = value;
    const half = this.size / 2;
    const near = REVERSED_Z ? this.distance * 3 : 0.0001;
    const far = REVERSED_Z ? 0.0001 : this.distance * 3;
    this.projection = mat4.orthoZO(mat4.create(), -half, half, -half, half, near, far);
  }

  /** @type { DirectionalLight } */
  static current = null;

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
  }

  exitTree() {
    if (DirectionalLight.current === this) {
      DirectionalLight.current = null;
    }
  }

  makeCurrent() {
    DirectionalLight.current = this;
  }

  update() {
    if (!Camera3D.current) return;
    const cameraTransform = Camera3D.current.globalTransform;
    const cameraPosition = vec3.fromValues(cameraTransform[12], cameraTransform[13], cameraTransform[14]);
    this.position = vec3.scaleAndAdd(vec3.create(), cameraPosition, this.forward, -this.distance);
  }

  /**
    * @param { GPUBuffer } buffer
    * @param { number } offset
    */
  writeLightDataToBuffer(buffer, offset = 0) {
    Renderer.device.queue.writeBuffer(buffer, offset + 0, mat4.invert(mat4.create(), this.globalTransform));
    Renderer.device.queue.writeBuffer(buffer, offset + 64, this.projection);
    Renderer.device.queue.writeBuffer(buffer, offset + 128, new Float32Array(this.color));
  }
}
