import { mat4, vec3 } from 'gl-matrix';
import { Renderer } from '../renderer.js';
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
    this.projection = mat4.orthoZO(mat4.create(), -half, half, -half, half, 0.0001, this.distance * 3);
  }

  /** @type { DirectionalLight } */
  static current = null;

  /**
    * @param { number } size
    */
  constructor(size) {
    super();
    this.size = size || this.size;
    const half = this.size / 2;
    this.distance = this.size;
    // Light sits `distance` behind the camera, so depth range is centered on the camera position
    this.projection = mat4.orthoZO(mat4.create(), -half, half, -half, half, 0.0001, this.distance * 3);
  }

  enterTree() {
    DirectionalLight.current = this;
  }

  // Keep the orthographic shadow projection; Camera3D would replace it with a perspective one on resize.
  updateProjection() {}

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
