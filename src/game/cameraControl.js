import { vec3 } from '../core/gl-matrix/index.js';
import { Entity3D } from '../core/nodes/entity3d.js';
import { InputController } from '../core/inputController.js';

export class CameraControl extends Entity3D {
  /** @param { number } dt */
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

    super.update(dt);
  }
}
