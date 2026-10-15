import { mat4, vec3 } from "../gl-matrix/index.js";
import { Renderer } from "../renderer.js";

import { TO_RAD } from "../utils.js";
import { Entity3D } from "./entity3d.js";

export class Camera3D extends Entity3D {
  /** @type { Camera3D } */
  static current;

  /** @type { ReturnType<mat4.create> } */
  projection = mat4.create();

  /** @type { number } */
  fov = 75;

  /** @type { number } */
  aspect = window.innerWidth / window.innerHeight;

  /** @type { number } */
  near = 0.1;

  /** @type { number } */
  far = 4000;

  get isCurrent() {
    return Camera3D.current === this;
  }

  constructor() {
    super()
    mat4.perspective(this.projection, TO_RAD * this.fov, this.aspect, this.near, this.far);

    window.addEventListener("resize", () => {
      this.aspect = window.innerWidth / window.innerHeight;
      mat4.perspective(this.projection, TO_RAD * this.fov, this.aspect, this.near, this.far);
    });

    if (!Camera3D.current) {
      Camera3D.current = this;
    }
  }

  /**
    * @param { GPUBuffer } buffer
    * @param { number } offset
    */
  writeToBuffer(buffer, offset = 0) {
    const viewMatrix = mat4.invert(mat4.create(), this.globalTransform);
    Renderer.device.queue.writeBuffer(buffer, offset + 0, viewMatrix);
    Renderer.device.queue.writeBuffer(buffer, offset + 64, this.globalTransform);
    Renderer.device.queue.writeBuffer(buffer, offset + 128, this.projection);
  }
}
