import { vec3, mat4 } from '../gl-matrix/index.js';
import { TO_RAD, assert, createId } from '../utils.js';

/**
 * Represents a 3D entity in a scene graph.
 */

export class Entity3D {
  id = createId();
  root = false;

  /** @type { ReturnType<mat4.create> } */
  transform = mat4.identity(mat4.create());

  /** @type { Entity3D | null } */
  #parent = null;
  get parent() { return this.#parent; }

  /** @type { Entity3D[] } */
  children = [];

  #position = vec3.create();

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
    this.#position[0] = this.transform[12];
    this.#position[1] = this.transform[13];
    this.#position[2] = this.transform[14];

    return this.#position;
  }

  set position(value) {
    this.transform[12] = value[0];
    this.transform[13] = value[1];
    this.transform[14] = value[2];

    this.#position[0] = value[0];
    this.#position[1] = value[1];
    this.#position[2] = value[2];
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
    if (this.parent && this.parent !== this) {
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
    child.setParent(this);

    return child;
  }

  /**
    * @param { Entity3D } entity
    */
  setParent(entity) {
    assert(entity !== null, "Parent cannot be null");
    assert(entity instanceof Entity3D, "Parent must be an instance of Entity3D");
    assert(entity !== this, "An entity cannot be its own parent");
    assert(!this.hasChild(entity, true), "An entity cannot be a parent of its own ancestor");

    if (entity.children.includes(this)) {
      return;
    }

    if (this.parent) {
      this.parent.removeChild(this);
    }

    this.#parent = entity;

    if (!entity.hasChild(this)) {
      entity.children.push(this);

      if (this.isInsideTree && entity.isInsideTree) {
        this.propagateCall('enterTree');
      }
    }
  }

  /**
    * @param { Entity3D } entity
    */
  hasChild(entity, deep = false) {
    if (this.children.includes(entity)) {
      return true;
    }

    if (!deep) return false;

    return this.children.some(child => child.hasChild(entity, true));
  }

  /** @param { Entity3D } child */
  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index !== -1) {
      this.children.splice(index, 1);

      if (this.isInsideTree && child.isInsideTree) {
        child.propagateChildrenCall('exitTree');
        child.exitTree();
      }

      child.#parent = null;
    }
  }

  /**
    * Cleans up the entity and its children, removing them from the scene tree.
    */
  cleanup() {
    for (const child of [...this.children]) {
      this.removeChild(child);
      child.cleanup();
    }
  }

  /**
    * Propagates a method call to the entity and all its children
    *
    * @param {string} methodName
    * @param  {...any} args
    */
  propagateCall(methodName, ...args) {
    const children = [...this.children];

    if (typeof this[methodName] === 'function') {
      this[methodName](...args);
    }

    children.forEach(child => child.propagateCall(methodName, ...args));
  }

  /**
    * Propagates a method call to all children of the entity, but not the entity itself.
    *
    * @param {string} methodName
    * @param  {...any} args
    */
  propagateChildrenCall(methodName, ...args) {
    const children = [...this.children];

    children.forEach(child => child.propagateCall(methodName, ...args));
  }

  /**
    * Updates the entity and its children.
    * @param {number} dt - The time delta since the last update, in seconds.
    */
  updateEntities(dt) {
    const children = [...this.children];
    this.update(dt);
    children.forEach(child => child.updateEntities(dt));
  }

  /**
    * Updates the entity and its children. Override this method in subclasses to implement custom update logic.
    * @param {number} _dt - The time delta since the last update, in seconds.
    * @virtual
    */
  update(_dt) {}

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
