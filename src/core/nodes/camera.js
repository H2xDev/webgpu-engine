import { mat4, vec3 } from "gl-matrix";

import { TO_RAD } from "../utils.js";
import { Entity3D } from "./entity3d.js";

export class Camera3D extends Entity3D {
  /** @type { Camera3D } */
  static current;

  /** @type { ReturnType<mat4.create> } */
  projection = mat4.create();

  /** @type { "perspective" | "orthographic" } */
  type_ = "perspective";

  get type() {
    return this.type_;
  }

  set type(value) {
    this.type_ = value;
    this.updateProjection();
  }

  /** @type { number } */
  fov_ = 75;

  /**
    * Distance from the camera to its focus point. Used to size the orthographic view
    * so that it matches the perspective view at that distance.
    * @type { number }
    */
  orthoDistance = 10;

  get fov() {
    return this.fov_;
  }

  set fov(value) {
    this.fov_ = value;
    this.updateProjection();
  }

  /** @type { number } */
  aspect = window.innerWidth / window.innerHeight;

  /** @type { number } */
  near_ = 0.1;

  /** @type { number } */
  far_ = 4000;

  get near() {
    return this.near_;
  }

  set near(value) {
    this.near_ = value;
    this.updateProjection();
  }

  get far() {
    return this.far_;
  }

  set far(value) {
    this.far_ = value;
    this.updateProjection();
  }

  get isCurrent() {
    return Camera3D.current === this;
  }

  constructor() {
    super()
    this.updateProjection();

    window.addEventListener("resize", () => {
      this.aspect = window.innerWidth / window.innerHeight;
      this.updateProjection();
    });
  }

  updateProjection() {
    if (this.type === "perspective") {
      mat4.perspective(this.projection, TO_RAD * this.fov, this.aspect, this.near, this.far);
    } else if (this.type === "orthographic") {
      const halfHeight = this.orthoDistance * Math.tan(TO_RAD * this.fov / 2);
      const halfWidth = halfHeight * this.aspect;
      mat4.orthoZO(this.projection, -halfWidth, halfWidth, -halfHeight, halfHeight, this.near, this.far);
    }
  }

  enterTree() {
    Camera3D.current = this;
  }

  /**
    * @param { GPUDevice } device
    * @param { GPUBuffer } buffer
    * @param { number } offset
    */
  writeToBuffer(device, buffer, offset = 0) {
    const viewMatrix = mat4.invert(mat4.create(), this.globalTransform);
    device.queue.writeBuffer(buffer, offset + 0, viewMatrix);
    device.queue.writeBuffer(buffer, offset + 64, this.globalTransform);
    device.queue.writeBuffer(buffer, offset + 128, this.projection);
  }
}
