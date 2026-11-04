import { mat4, mat3, vec3 } from '../gl-matrix/index.js';

// TODO: the position, rotation and scale should be the source of truth
//       and the final matrix should be compsed from them. The rotation
//       should be a quaternion, not a matrix.

export class Transform {
  /**
    * The raw 4x4 matrix representing the transform.
    * @type { ReturnType<mat4.create> }
    */
  #raw;

  version = 0;
  #normalVersion = 0;

  #normalMatrix = mat3.create();

  get raw() {
    return this.#raw;
  }

  /**
    * The underlying Float32Array of the matrix, without the change-tracking proxy.
    * Use it for APIs that reject proxies (e.g. GPUQueue.writeBuffer). Read-only.
    * @type { Float32Array }
    */
  #data;
  get data() {
    return this.#data;
  }

  /**
    * The forward direction of the transform (-Z axis).
    * @type { readonly [number, number, number] }
    */
  static FORWARD = Object.freeze([0, 0, -1]);


  /**
    * The up direction of the transform (Y axis).
    * @type { readonly [number, number, number] }
    */
  static UP = Object.freeze([0, 1, 0]);

  /**
    * The right direction of the transform (X axis).
    * @type { readonly [number, number, number] }
    */
  static RIGHT = Object.freeze([1, 0, 0]);

  /**
    * The zero vector.
    * @type { readonly [number, number, number] }
    */
  static ZERO = Object.freeze([0, 0, 0]);

  /**
    * @return { Transform } A new transform with the identity matrix.
    */
  static identity() {
    return new Transform();
  }

  /**
    * Allocated once to avoid creating new arrays on every access.
    * @type { [number, number, number] }
    */
  #origin = [0, 0, 0];

  /**
    * Allocated once to avoid creating new arrays on every access.
    * @type { [number, number, number] }
    */
  #forward = [0, 0, -1];

  /**
    * Allocated once to avoid creating new arrays on every access.
    * @type { [number, number, number] }
    */
  #up = [0, 1, 0];

  /**
    * Allocated once to avoid creating new arrays on every access.
    * @type { [number, number, number] }
    */
  #right = [1, 0, 0];

  constructor() {
    /** @type { Float32Array } */
    const raw = mat4.identity(mat4.create());

    this.#data = raw;
    this.#raw = new Proxy(raw, {
      set: (target, property, value) => {
        target[property] = value;
        this.version++;
        return true;
      }
    });

    const originalSet = raw.set;
    raw.set = (array, offset) => {
      originalSet.call(raw, array, offset);
      this.version++;
      return raw;
    };

    const originalFill = raw.fill;
    raw.fill = (value, start, end) => {
      originalFill.call(raw, value, start, end);
      this.version++;
      return raw;
    }
  }

  /**
    * The origin of the transform.
    *
    * > [!CAUTION]
    * > This is a mutable array that is updated on each access, so it should not be stored or modified directly.
    * @return { [number, number, number] } The origin of the transform.
    */
  get origin() {
    const raw = this.raw;
    this.#origin[0] = raw[12];
    this.#origin[1] = raw[13];
    this.#origin[2] = raw[14];
    return this.#origin;
  }

  set origin(value) {
    this.raw[12] = value[0];
    this.raw[13] = value[1];
    this.raw[14] = value[2];
  }

  /**
    * Direction the transform is facing (-Z axis).
    *
    * > [!CAUTION]
    * > This is a mutable array that is updated on each access, so it should not be stored or modified directly.
    */
  get forward() {
    const raw = this.raw;
    this.#forward[0] = -raw[8];
    this.#forward[1] = -raw[9];
    this.#forward[2] = -raw[10];
    return this.#forward;
  }

  /**
    * Direction of the transform's up vector (Y axis).
    *
    * > [!CAUTION]
    * > This is a mutable array that is updated on each access, so it should not be stored or modified directly.
    */
  get up() {
    const raw = this.raw;
    this.#up[0] = raw[4];
    this.#up[1] = raw[5];
    this.#up[2] = raw[6];

    return this.#up;
  }

  /**
    * Direction of the transform's right vector (X axis).
    *
    * > [!CAUTION]
    * > This is a mutable array that is updated on each access, so it should not be stored or modified directly.
    */
  get right() {
    const raw = this.raw;
    this.#right[0] = raw[0];
    this.#right[1] = raw[1];
    this.#right[2] = raw[2];
    return this.#right;
  }

  set forward(value) {
    this.raw[8] = -value[0];
    this.raw[9] = -value[1];
    this.raw[10] = -value[2];

  }

  set up(value) {
    this.raw[4] = value[0];
    this.raw[5] = value[1];
    this.raw[6] = value[2];
  }

  set right(value) {
    this.raw[0] = value[0];
    this.raw[1] = value[1];
    this.raw[2] = value[2];
  }

  /**
    * Allocated once to avoid creating new arrays on every access.
    * @type { [number, number, number] }
    */
  #scale = [1, 1, 1];

  /**
    * Scale of the transform.
    *
    * > [!CAUTION]
    * > This is a mutable array that is updated on each access, so it should not be stored or modified directly.
    */
  get scale() {
    this.#scale[0] = Math.hypot(this.raw[0], this.raw[1], this.raw[2]);
    this.#scale[1] = Math.hypot(this.raw[4], this.raw[5], this.raw[6]);
    this.#scale[2] = Math.hypot(this.raw[8], this.raw[9], this.raw[10]);

    return this.#scale;
  }

  set scale(value) {
    const currentScale = this.scale;

    const scaleX = currentScale[0] === 0
      ? 1 : value[0] / currentScale[0];

    const scaleY = currentScale[1] === 0
      ? 1 : value[1] / currentScale[1];

    const scaleZ = currentScale[2] === 0
      ? 1 : value[2] / currentScale[2];

    this.raw[0] *= scaleX;
    this.raw[1] *= scaleX;
    this.raw[2] *= scaleX;

    this.raw[4] *= scaleY;
    this.raw[5] *= scaleY;
    this.raw[6] *= scaleY;

    this.raw[8] *= scaleZ;
    this.raw[9] *= scaleZ;
    this.raw[10] *= scaleZ;
  }


  /**
    * Rotate around the local X, Y and Z axes (applied in that order).
    *
    * @param { number } x Angle in radians.
    * @param { number } y Angle in radians.
    * @param { number } z Angle in radians.
    * @return { Transform } This transform.
    */
  rotateLocal(x, y, z) {
    const rotation = mat4.create();
    mat4.rotateX(rotation, rotation, x);
    mat4.rotateY(rotation, rotation, y);
    mat4.rotateZ(rotation, rotation, z);
    mat4.multiply(this.raw, this.raw, rotation);

    return this;
  }

  /**
    * Copy the values of another transform into this one.
    *
    * @param { Transform } other
    * @return { Transform } This transform.
    */
  copy(other) {
    mat4.copy(this.raw, other.raw);

    return this;
  }

  /**
    * Rotate around a world-space axis passing through this transform's origin.
    *
    * @param { [number, number, number] } axis
    * @param { number } angle Angle in radians.
    * @return { Transform } This transform.
    */
  rotate(axis, angle) {
    return this.rotateAround([this.raw[12], this.raw[13], this.raw[14]], axis, angle);
  }

  /**
    * Rotate this transform around a world-space pivot point.
    * Both orientation and origin are rotated.
    *
    * @param { [number, number, number] } pivot World-space point to rotate around.
    * @param { [number, number, number] } axis Rotation axis.
    * @param { number } angle Angle in radians.
    * @return { Transform } This transform.
    */
  rotateAround(pivot, axis, angle) {
    const normalizedAxis = vec3.normalize(vec3.create(), axis);
    const base = this;
    const rotation = mat4.fromRotation(mat4.create(), angle, normalizedAxis);
    const offset = [base.raw[12] - pivot[0], base.raw[13] - pivot[1], base.raw[14] - pivot[2]];
    const x = rotation[0] * offset[0] + rotation[4] * offset[1] + rotation[8] * offset[2];
    const y = rotation[1] * offset[0] + rotation[5] * offset[1] + rotation[9] * offset[2];
    const z = rotation[2] * offset[0] + rotation[6] * offset[1] + rotation[10] * offset[2];

    mat4.multiply(this.raw, rotation, base.raw);
    this.raw[12] = pivot[0] + x;
    this.raw[13] = pivot[1] + y;
    this.raw[14] = pivot[2] + z;

    return this;
  }

  /**
    * Returns the distance between this transform and another transform.
    *
    * @param { Transform } other
    * @return { number } The distance between this transform and the other transform.
    */
  distanceTo(other) {
    return Math.hypot(
      other.raw[12] - this.raw[12],
      other.raw[13] - this.raw[13],
      other.raw[14] - this.raw[14]
    );
  }

  /**
    * Get the direction from this transform to the other transform.
    *
    * @param { Transform } other
    * @return { number[] } The direction from this transform to the other transform.
    */
  directionTo(other) {
    const dx = other.raw[12] - this.raw[12];
    const dy = other.raw[13] - this.raw[13];
    const dz = other.raw[14] - this.raw[14];
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (length === 0) return [...Transform.FORWARD];

    return [dx / length, dy / length, dz / length];
  }

  /**
    * Look at a target position.
    *
    * @param { [number, number, number] | readonly [number, number, number] } target The target position to look at.
    * @param { [number, number, number] | readonly [number, number, number] } up The normalized up direction of the transform.
    */
  lookAt(target, up = Transform.UP) {
    /** @type { [number, number, number] } */
    const scale = [...this.scale];

    if (!Object.isFrozen(up)) {
      up = [...up];
      vec3.normalize(up, up);
    } else {
      const len = vec3.length(up);

      if (len > 1.00001 || len < 0.9999) {
        throw new Error("Transform.lookAt: up vector must be normalized.");
      }
    }

    if (vec3.equals(this.origin, target)) {
      return this;
    }

    if (scale[0] === 0 || scale[1] === 0 || scale[2] === 0) {
      return this;
    }

    const targetDirection = vec3.create()
    vec3.normalize(targetDirection, vec3.subtract(targetDirection, target, this.origin));

    const isParallel = Math.abs(vec3.dot(up, targetDirection)) > 0.999;

    if (isParallel) {
      up = Math.abs(targetDirection[0]) > 0.999 ? Transform.UP : Transform.RIGHT;
    }

    if (vec3.length(up) < 0.0001) {
      console.warn("Transform.lookAt: up vector is zero, cannot look at target.");
      return this;
    }

    mat4.targetTo(this.raw, this.origin, target, up);
    this.scale = scale;


    return this;
  }

  /**
    * Duplicate this transform.
    *
    * @return { Transform } A new transform with the same values as this transform.
    */
  duplicate() {
    const newTransform = new Transform();
    mat4.copy(newTransform.raw, this.raw);
    return newTransform;
  }

  /**
    * Invert this transform.
    * Creates a new transform if clone is true, otherwise modifies this transform.
    *
    * @param { boolean } [clone=true] Whether to create a new transform or modify this one.
    * @return { Transform } The inverted transform.
    */
  inverse(clone = true) {
    if (clone) {
      const newTransform = new Transform();
      mat4.invert(newTransform.raw, this.raw);
      return newTransform;
    } else {
      mat4.invert(this.raw, this.raw);

      return this;
    }
  }

  /**
    * Multiply this transform by another transform.
    * Creates a new transform if clone is true, otherwise modifies this transform.
    *
    * @example
    * ```javascript
    * const transformA = new Transform();
    * const transformB = new Transform();
    * const result = transformA.multiply(transformB); // Creates a new transform
    * ```
    *
    * @param { Transform } transformB The other transform to multiply by.
    * @param { boolean } clone Whether to create a new transform or modify this one.
    * @return { Transform } The resulting transform.
    */
  multiply(transformB, clone = true) {
    if (clone) {
      const newTransform = new Transform();
      mat4.multiply(newTransform.raw, this.raw, transformB.raw);
      return newTransform;
    } else {
      mat4.multiply(this.raw, this.raw, transformB.raw);

      return this;
    }
  }

  getNormalMatrix() {
    if (this.#normalVersion === this.version) {
      return this.#normalMatrix;
    }
    mat3.normalFromMat4(this.#normalMatrix, this.raw);
    this.#normalVersion = this.version;
    return this.#normalMatrix;
  }
}
