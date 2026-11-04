import { Entity3D, InputController, TO_RAD } from '@core';

export class CameraControl extends Entity3D {
  /** @type { number } */
  speed = 1.0;

  constructor(speed = 1.0) {
    super();
    this.speed = speed;
  }
  /** @param { number } dt */
  update(dt) {
    const transform = this.transform;

    if (InputController.is_lmb_pressed) {
      transform.rotate([0, 1, 0], -InputController.mouseMovement[0] * 0.4 * TO_RAD);
      transform.rotate(transform.right, -InputController.mouseMovement[1] * 0.4 * TO_RAD);
    }

    const forwardSpeed = InputController.is_key_pressed("KeyW") ? 1 : InputController.is_key_pressed("KeyS") ? -1 : 0;
    const rightSpeed = InputController.is_key_pressed("KeyD") ? 1 : InputController.is_key_pressed("KeyA") ? -1 : 0;

    const speed = this.speed * dt;
    const { forward, right, origin } = transform;
    transform.origin = origin.map((v, i) => v + (forward[i] * forwardSpeed + right[i] * rightSpeed) * speed);
  }
}
