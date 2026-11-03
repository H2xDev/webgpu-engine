import { vec3 } from 'gl-matrix';
import { Entity3D, InputController } from '@core';

export class CameraControl extends Entity3D {
  /** @type { number } */
  speed = 1.0;

  constructor(speed = 1.0) {
    super();
    this.speed = speed;
  }
  /** @param { number } dt */
  update(dt) {
    if (InputController.is_lmb_pressed) {
      this.rotate([0, 1, 0], -InputController.mouseMovement[0] * 0.4);
      this.rotate(this.right, -InputController.mouseMovement[1] * 0.4);
    }

    const forwardSpeed = InputController.is_key_pressed("KeyW") ? 1 : InputController.is_key_pressed("KeyS") ? -1 : 0;
    const rightSpeed = InputController.is_key_pressed("KeyD") ? 1 : InputController.is_key_pressed("KeyA") ? -1 : 0;

    const speed = this.speed * dt;
    const forwardMovement = vec3.scale(vec3.create(), this.forward, forwardSpeed * speed);
    const rightMovement = vec3.scale(vec3.create(), this.right, rightSpeed * speed);

    const movement = vec3.add(vec3.create(), forwardMovement, rightMovement);
    this.position = vec3.add(vec3.create(), this.position, movement);
  }
}
