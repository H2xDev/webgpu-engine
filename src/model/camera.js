import { mat4, vec3 } from "../gl-matrix/index.js";
import { InputController } from "../controller/input.js";

import { TO_RAD } from "../utils.js";
import { Entity3D } from "./entity_3d.js";

export class Camera3D extends Entity3D {
  /** @type { ReturnType<mat4.create> } */
  projection = mat4.create();

  /** @type { number } */
  fov = 60;

  /** @type { number } */
  aspect = 800/600;

  /** @type { number } */
  near = 0.1;

  /** @type { number } */
  far = 1000;

  input = new InputController();

  constructor() {
    super()
    mat4.perspective(this.projection, TO_RAD * this.fov, this.aspect, this.near, this.far);

    window.addEventListener("resize", () => {
      this.aspect = window.innerWidth / window.innerHeight;
      mat4.perspective(this.projection, TO_RAD * this.fov, this.aspect, this.near, this.far);
    });
  }

  update(_dt) {
    this.rotate([0, 1, 0], -this.input.mouseMovement[0] * 0.1);
    this.rotate(this.right, -this.input.mouseMovement[1] * 0.1);

    const forwardSpeed = this.input.is_key_pressed("KeyW") ? 1 : this.input.is_key_pressed("KeyS") ? -1 : 0;
    const rightSpeed = this.input.is_key_pressed("KeyD") ? 1 : this.input.is_key_pressed("KeyA") ? -1 : 0;

    const speed = 0.05;
    const forwardMovement = vec3.scale(vec3.create(), this.forward, forwardSpeed * speed);
    const rightMovement = vec3.scale(vec3.create(), this.right, rightSpeed * speed);

    const movement = vec3.add(vec3.create(), forwardMovement, rightMovement);
    this.position = vec3.add(vec3.create(), this.position, movement);
  }
}
