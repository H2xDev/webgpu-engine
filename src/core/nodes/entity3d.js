import { Transform } from '../resources/transform.js';
import { vec3, mat4 } from '../gl-matrix/index.js';
import { TO_RAD, assert, createId } from '../utils.js';

/**
 * Represents a 3D entity in a scene graph.
 */

export class Entity3D {
  id = createId();
  root = false;
  transform = new Transform()

  // Allocate a single globalTransform to avoid creating new objects on every access
  #globalTransform = new Transform();
  #lastParentVersion = -1;
  #lastTransformVersion = -1;

  get #globalTransformDirty() {
    const parentVersion = this.parent ? this.parent.globalTransform.version : -1;
    const transformVersion = this.transform.version;

    if (parentVersion !== this.#lastParentVersion || transformVersion !== this.#lastTransformVersion) {
      this.#lastParentVersion = parentVersion;
      this.#lastTransformVersion = transformVersion;
      return true;
    }

    return false;
  }

  /** @type { Entity3D[] } */
  children = [];

  /** @type { Entity3D | null } */
  #parent = null;
  get parent() { return this.#parent; }

  get position() {
    return this.transform.origin;
  }

  set position(value) {
    this.transform.origin = value;
  }

  get globalPosition() {
    return this.globalTransform.origin;
  }

  set globalPosition(value) {
    if (this.parent) {
      const parentGlobalTransform = this.parent.globalTransform.raw;
      const invParentGlobalTransform = mat4.invert(mat4.create(), parentGlobalTransform);
      const localPosition = vec3.transformMat4(vec3.create(), value, invParentGlobalTransform);
      this.position = localPosition;
    } else {
      this.position = value;
    }
  }

  get isInsideTree() {
    if (this.root) return true;

    let current = this.parent;
    while (current) {
      if (current.root) return true;
      current = current.parent;
    }
    return false;
  }

  get globalTransform() {
    if (this.parent && this.parent !== this) {
      if (this.#globalTransformDirty) {
        mat4.multiply(this.#globalTransform.raw, this.parent.globalTransform.raw, this.transform.raw);
      }
      return this.#globalTransform;
    } else {
      return this.transform;
    }
  }

  /**
    * @param { ReturnType<vec3.create> } axis
    * @param { number } angle
    */
  rotate(axis, angle) {
    this.transform.rotate(axis, angle);
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

    this.#clearTransformVersion();
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

  // PRIVATE METHODS
  #clearTransformVersion() {
    this.transform.version++;
    this.#lastTransformVersion = -1;
  }
}
