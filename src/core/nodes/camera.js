import { mat4, vec3 } from "../gl-matrix/index.js";
import { InputController } from "../inputController.js";

import { TO_RAD } from "../utils.js";
import { Entity3D } from "./entity_3d.js";

export class Camera3D extends Entity3D {
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

  update(dt) {
    this.rotate([0, 1, 0], -InputController.mouseMovement[0] * 0.4);
    this.rotate(this.right, -InputController.mouseMovement[1] * 0.4);

    const forwardSpeed = InputController.is_key_pressed("KeyW") ? 1 : InputController.is_key_pressed("KeyS") ? -1 : 0;
    const rightSpeed = InputController.is_key_pressed("KeyD") ? 1 : InputController.is_key_pressed("KeyA") ? -1 : 0;

    const speed = 200.0 * dt;
    const forwardMovement = vec3.scale(vec3.create(), this.forward, forwardSpeed * speed);
    const rightMovement = vec3.scale(vec3.create(), this.right, rightSpeed * speed);

    const movement = vec3.add(vec3.create(), forwardMovement, rightMovement);
    this.position = vec3.add(vec3.create(), this.position, movement);
  }
}
