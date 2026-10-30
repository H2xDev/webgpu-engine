import { mat4, vec3 } from '../gl-matrix/index.js';
import { InputController } from '../inputController.js';
import { TO_RAD } from '../utils.js';
import { Entity3D } from './entity3d.js';

/**
 * Orbits around `target`. Drag with LMB to rotate, Shift+LMB drag to pan, scroll to zoom.
 * Attach a camera as a child to view the scene through it.
 */
export class OrbitControl extends Entity3D {
  /** @type { ReturnType<vec3.create> } */
  target = vec3.create();

  /** Distance from the target. */
  distance = 5;
  minDistance = 0.1;
  maxDistance = 10000;

  /** Degrees. */
  yaw = 0;
  pitch = 0;
  minPitch = -89;
  maxPitch = 89;

  rotateSpeed = 0.4;
  zoomSpeed = 0.1;

  /** Pan amount per pixel, relative to the distance. */
  panSpeed = 0.0015;
  /** Smoothing rate (1/s): higher is snappier, 0 disables damping. */
  damping = 10;

  // Smoothed values actually used for the transform; yaw/pitch/distance are the goals.
  #yaw = 0;
  #pitch = 0;
  #distance = 0;
  #initialized = false;

  /** Smoothed copy of `target`; `target` is the goal. */
  #target = vec3.create();

  /** @param { number } dt */
  update(dt) {
    const shift = InputController.is_key_pressed('ShiftLeft') || InputController.is_key_pressed('ShiftRight');

    if (InputController.is_lmb_pressed && shift) {
      // Pan along the camera's right/up axes, scaled so the scene follows the cursor.
      const scale = this.#distance * this.panSpeed;
      const [dx, dy] = InputController.mouseMovement;
      vec3.scaleAndAdd(this.target, this.target, this.right, -dx * scale);
      vec3.scaleAndAdd(this.target, this.target, this.up, dy * scale);
    } else if (InputController.is_lmb_pressed) {
      this.yaw -= InputController.mouseMovement[0] * this.rotateSpeed;
      this.pitch = Math.min(
        this.maxPitch,
        Math.max(this.minPitch, this.pitch + InputController.mouseMovement[1] * this.rotateSpeed),
      );
    }

    const wheel = InputController.mouseWheel;
    if (wheel) {
      this.distance = Math.min(
        this.maxDistance,
        Math.max(this.minDistance, this.distance * Math.exp(Math.sign(wheel) * this.zoomSpeed)),
      );
    }

    if (!this.#initialized || this.damping <= 0) {
      this.#yaw = this.yaw;
      this.#pitch = this.pitch;
      this.#distance = this.distance;
      vec3.copy(this.#target, this.target);
      this.#initialized = true;
    } else {
      const k = 1 - Math.exp(-this.damping * dt);
      vec3.lerp(this.#target, this.#target, this.target, k);
      this.#yaw += (this.yaw - this.#yaw) * k;
      this.#pitch += (this.pitch - this.#pitch) * k;
      this.#distance += (this.distance - this.#distance) * k;
    }

    this.#apply();
    super.update(dt);
  }

  #apply() {
    const yaw = this.#yaw * TO_RAD;
    const pitch = this.#pitch * TO_RAD;
    const offset = vec3.fromValues(
      Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      Math.cos(yaw) * Math.cos(pitch),
    );
    const eye = vec3.scaleAndAdd(vec3.create(), this.#target, offset, this.#distance);
    mat4.targetTo(this.transform, eye, this.#target, [0, 1, 0]);
  }
}
