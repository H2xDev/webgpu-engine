import { vec3, mat4 } from '../gl-matrix/index.js';
import { TO_RAD, createId } from '../utils.js';

export class Entity3D {
  id = createId();
  root = false;

  /** @type { ReturnType<mat4.create> } */
  transform = mat4.identity(mat4.create());

  /** @type { Entity3D | null } */
  parent_ = null;

  get parent() {
    return this.parent_;
  }

  set parent(value) {
    const oldValue = this.parent_;
    this.parent_ = value;

    if (!oldValue && value && value.isInsideTree) {
      this.enterTree();
      this.children.forEach(child => child.enterTree());
      return;
    }

    if (oldValue && !value) {
      this.children.forEach(child => child.exitTree());
      this.exitTree();
      return;
    }
  }

  /** @type { Entity3D[] } */
  children = [];

  #position_ = vec3.create();

  get isInsideTree() {
    if (this.root) return true;

    let current = this.parent;
    while (current) {
      if (current.root) return true;
      current = current.parent;
    }
    return false;
  }

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

  get globalRight() {
    const globalTransform = this.globalTransform;
    return vec3.fromValues(globalTransform[0], globalTransform[1], globalTransform[2]);
  }

  get globalUp() {
    const globalTransform = this.globalTransform;
    return vec3.fromValues(globalTransform[4], globalTransform[5], globalTransform[6]);
  }

  get globalForward() {
    const globalTransform = this.globalTransform;
    return vec3.fromValues(-globalTransform[8], -globalTransform[9], -globalTransform[10]);
  }

  get globalTransform() {
    if (this.parent) {
      const globalTransform = mat4.create();
      mat4.multiply(globalTransform, this.parent.globalTransform, this.transform);
      return globalTransform;
    } else {
      return this.transform;
    }
  }

  get globalPosition() {
    const globalTransform = this.globalTransform;
    return vec3.fromValues(globalTransform[12], globalTransform[13], globalTransform[14]);
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

  /**
    * Rotates the entity to face a target point in world space.
    * @param { ReturnType<vec3.create> } target
    * @param { ReturnType<vec3.create> } up
    */
  lookAt(target, up = [0, 1, 0]) {
    const eye = vec3.clone(this.position);
    const direction = vec3.sub(vec3.create(), eye, target);
    if (vec3.squaredLength(direction) < 1e-12) return;

    vec3.normalize(direction, direction);
    let safeUp = vec3.normalize(vec3.create(), up);

    // Parallel direction and up produce a zero cross product, which makes the matrix singular
    if (vec3.squaredLength(vec3.cross(vec3.create(), direction, safeUp)) < 1e-8) {
      safeUp = Math.abs(direction[1]) < 0.99 ? vec3.fromValues(0, 1, 0) : vec3.fromValues(0, 0, 1);
    }

    this.transform = mat4.targetTo(this.transform, eye, target, safeUp);
  }

  /**
    * @template { Entity3D } T
    * @param { T } child
    * @returns { T }
    */
  addChild(child) {
    if (child.parent) {
      child.parent.removeChild(child);
    }

    child.parent = this;
    this.children.push(child);

    return child;
  }

  /** @param { Entity3D } child */
  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index !== -1) {
      child.parent = null;
      this.children.splice(index, 1);
    }
  }

  update(_dt) {
    this.children.forEach(child => child.update(_dt));
  }

  /**
    * Triggered when the entity is added to the scene tree. Override this method in subclasses to perform custom initialization or setup logic.
    * @virtual
    */
  enterTree() {}

  /**
    * Triggered when the entity is removed from the scene tree. Override this method in subclasses to perform custom cleanup or teardown logic.
    * @virtual
    */
  exitTree() {}
}
