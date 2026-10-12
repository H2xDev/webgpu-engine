import { mat4, vec3 } from '../gl-matrix/index.js';
import { Camera3D } from './camera.js';

export class DirectionalLight extends Camera3D {
  size = 20;
  distance = 10;
  color = [1, 1, 1];

  /** @type { DirectionalLight } */
  static current = null;

  /**
    * @param { number } size
    */
  constructor(size) {
    super();
    this.size = size || this.size;
    const half = this.size * 100;
    this.distance = half;
    this.projection = mat4.orthoZO(mat4.create(), -half, half, -half, half, 0.001, half * 3);

    if (!DirectionalLight.current) {
      DirectionalLight.current = this;
    }
  }

  update() {
    if (!Camera3D.current) return;
    this.position = vec3.scaleAndAdd(this.position, Camera3D.current.position, this.forward, -this.distance);
  }
}
