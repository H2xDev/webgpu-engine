import { vec3, mat4 } from "gl-matrix";

import { Entity3D, Camera3D, InputController } from "@core";

// Higher values make the camera follow the target more tightly.
const FOLLOW_SPEED = 6;
const HANDHELD_AMPLITUDE = 0.01;
const HANDHELD_ANGLE = 0.2 * Math.PI / 180;
const HANDHELD_SPEED = 1.0;

const DEG = Math.PI / 180;
const ORBIT_ROTATE_SPEED = 0.4;
const ORBIT_PAN_SPEED = 0.0015;
const ORBIT_ZOOM_SPEED = 0.1;
// Smoothing rate (1/s) for orbit yaw/pitch/distance.
const ORBIT_DAMPING = 10;
const ORBIT_MIN_PITCH = -5;
const ORBIT_MAX_PITCH = 80;
const ORBIT_MIN_DISTANCE = 3;
const ORBIT_MAX_DISTANCE = 60;

export class FollowCamera extends Entity3D {
  /** @type { Camera3D } */
  camera

  /** @type { Entity3D } */
  target

  /** @type { vec3 } Camera offset from the pivot, derived from the smoothed orbit values. */
  cameraOffset

  /** @type { vec3 } Smoothed pivot position. */
  followPosition

  /** Orbit goals, in degrees and world units. */
  yaw = -130;
  pitch = 45;
  distance = 15;

  controlsEnabled = true;

  /** Pivot offset from the target, moved by Shift+LMB drag. */
  panOffset = vec3.create();

  #yaw = -130;
  #pitch = 45;
  #distance = 15;

  time = 0;

  /**
   * @param { Entity3D } target
   */
  constructor(target) {
    super();
    this.target = target;

    const camera = this.addChild(new Camera3D());
    camera.fov = 40;
    camera.near = 0.1;
    camera.orthoDistance = 15;
    this.camera = camera;

    this.distance = this.#distance = camera.orthoDistance;
    this.#applyOrbit();

    this.position = vec3.clone(target.position);
    this.followPosition = vec3.clone(this.position);
  }

  /** Sets the camera's local transform to look at the pivot from the smoothed orbit offset. */
  #applyOrbit() {
    const yaw = this.#yaw * DEG;
    const pitch = this.#pitch * DEG;
    this.cameraOffset = vec3.fromValues(
      Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      Math.cos(yaw) * Math.cos(pitch),
    );
    vec3.scale(this.cameraOffset, this.cameraOffset, this.#distance);
    mat4.targetTo(this.camera.transform, this.cameraOffset, vec3.create(), [0, 1, 0]);
  }

  /** @param { number } dt */
  #handleOrbitInput(dt) {
    const shift = InputController.is_key_pressed('ShiftLeft') || InputController.is_key_pressed('ShiftRight');
    const [dx, dy] = InputController.mouseMovement;

    if (InputController.is_lmb_pressed && shift) {
      const scale = this.#distance * ORBIT_PAN_SPEED;
      vec3.scaleAndAdd(this.panOffset, this.panOffset, this.camera.globalRight, -dx * scale);
      vec3.scaleAndAdd(this.panOffset, this.panOffset, this.camera.globalUp, dy * scale);
    } else if (InputController.is_lmb_pressed) {
      this.yaw -= dx * ORBIT_ROTATE_SPEED;
      this.pitch = Math.min(ORBIT_MAX_PITCH, Math.max(ORBIT_MIN_PITCH, this.pitch + dy * ORBIT_ROTATE_SPEED));
    }

    const wheel = InputController.mouseWheel;
    if (wheel) {
      this.distance = Math.min(
        ORBIT_MAX_DISTANCE,
        Math.max(ORBIT_MIN_DISTANCE, this.distance * Math.exp(Math.sign(wheel) * ORBIT_ZOOM_SPEED)),
      );
    }

    const k = 1 - Math.exp(-ORBIT_DAMPING * dt);
    this.#yaw += (this.yaw - this.#yaw) * k;
    this.#pitch += (this.pitch - this.#pitch) * k;
    this.#distance += (this.distance - this.#distance) * k;
  }

  /**
   * Irregular, hand-like drift in [-1, 1] built from unrelated sine frequencies.
   * @param { number } t
   * @param { number } seed
   */
  handheldNoise(t, seed) {
    return (
      Math.sin(t * 1.3 + seed) * 0.5 +
      Math.sin(t * 2.7 + seed * 2.1) * 0.3 +
      Math.sin(t * 4.9 + seed * 3.7) * 0.2
    );
  }

  /** @param { number } dt */
  update(dt) {
    if (this.controlsEnabled) this.#handleOrbitInput(dt);
    this.#applyOrbit();

    const pivot = vec3.add(vec3.create(), this.target.position, this.panOffset);
    const followT = 1 - Math.exp(-FOLLOW_SPEED * dt);
    this.followPosition = vec3.lerp(vec3.create(), this.followPosition, pivot, followT);

    this.time += dt * HANDHELD_SPEED;
    const right = this.camera.right;
    const up = this.camera.up;
    const shakeRight = this.handheldNoise(this.time, 0) * HANDHELD_AMPLITUDE;
    const shakeUp = this.handheldNoise(this.time, 1.7) * HANDHELD_AMPLITUDE;
    const shake = vec3.scaleAndAdd(vec3.create(), vec3.scale(vec3.create(), right, shakeRight), up, shakeUp);
    this.position = vec3.add(vec3.create(), this.followPosition, shake);

    const rx = mat4.fromXRotation(mat4.create(), this.handheldNoise(this.time, 3.1) * HANDHELD_ANGLE);
    const ry = mat4.fromYRotation(mat4.create(), this.handheldNoise(this.time, 5.3) * HANDHELD_ANGLE);
    const rz = mat4.fromZRotation(mat4.create(), this.handheldNoise(this.time, 7.9) * HANDHELD_ANGLE);
    const tilt = mat4.multiply(mat4.create(), mat4.multiply(mat4.create(), rx, ry), rz);
    mat4.multiply(this.camera.transform, this.camera.transform, tilt);

    super.update(dt);
  }
}
