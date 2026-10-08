import { vec3, mat4 } from '../gl-matrix/index.js';
import { TO_RAD } from '../utils.js';

export class Entity3D {
  /** @type { ReturnType<mat4.create> } */
  transform = mat4.identity(mat4.create());
  #position_ = vec3.create();

  /** @type { { x: number; y: number; z: number; } } */
  posProxy = new Proxy({x: 0, y: 0, z: 0}, {
    set: (target, prop, value) => {
      if (prop === 'x') this.transform[12] = value;
      if (prop === 'y') this.transform[13] = value;
      if (prop === 'z') this.transform[14] = value;

      target[prop] = value;
      return true;
    },
    get: (target, prop) => {
      if (prop === 'x') return this.transform[12];
      if (prop === 'y') return this.transform[13];
      if (prop === 'z') return this.transform[14];

      return target[prop];
    }
  });

  get position() {
    this.#position_[0] = this.transform[12];
    this.#position_[1] = this.transform[13];
    this.#position_[2] = this.transform[14];

    return this.#position_;
  }

  set position(value) {
    this.transform[12] = value[0];
    this.transform[13] = value[1];
    this.transform[14] = value[2];

    this.#position_[0] = value[0];
    this.#position_[1] = value[1];
    this.#position_[2] = value[2];
  }

  get forward() {
    return vec3.fromValues(-this.transform[8], -this.transform[9], -this.transform[10]);
  }

  get up() {
    return vec3.fromValues(this.transform[4], this.transform[5], this.transform[6]);
  }

  get right() {
    return vec3.fromValues(this.transform[0], this.transform[1], this.transform[2]);
  }

  /**
    * @param { ReturnType<vec3.create> } axis
    * @param { number } angle
    */
  rotate(axis, angle) {
    const rotation = mat4.fromRotation(mat4.create(), angle * TO_RAD, axis);
    const tempPosition = vec3.clone(this.position);
    this.position = [0, 0, 0];
    mat4.multiply(this.transform, rotation, this.transform);
    this.position = tempPosition;
  }

  update(_dt) {}
}
