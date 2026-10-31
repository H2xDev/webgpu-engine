import { Entity3D, MeshInstance, Camera3D } from '@core';
import { Material } from '../core/resources/material.js';
import { BoxMesh } from '../core/resources/boxMesh.js';
import { InputController } from '../core/inputController.js';

import { vec3 } from '../core/gl-matrix/index.js';

export class Player extends Entity3D {
  meshInstance;
  rawPosition = vec3.create();

  constructor() {
    super()
    this.meshInstance = this.addChild(new MeshInstance(
      new BoxMesh({
        size: [1, 0.25, 1],
        bevel: 0.05,
        bevelSegments: 0,
        material: Object.assign(new Material().init(), {
          albedoTint: [1.0, 1.0, 1.0],
          metallic: 0.0,
          roughness: 0.0,
          emissionTint: [1, 0.2, 1],
          emissionEnergy: 5.0,
        }),
      })
    ));

    this.meshInstance.position = [0, -0.125, 0];
  }

  /**
   * @param { number } dt
   */
  update(dt) {
    const kleft = InputController.is_key_pressed('KeyA') ? 1 : 0;
    const kright = InputController.is_key_pressed('KeyD') ? 1 : 0;
    const kforward = InputController.is_key_pressed('KeyW') ? 1 : 0;
    const kbackward = InputController.is_key_pressed('KeyS') ? 1 : 0;

    const mright = kright - kleft;
    const mforward = kforward - kbackward;

    const speed = 10 * dt;

    const camera = Camera3D.current;

    // const forward = vec3.normalize(vec3.create(), camera.globalForward);
    // vec3.normalize(forward, vec3.multiply(forward, forward, [1, 0, 1]));

    // const right = vec3.normalize(vec3.create(), camera.globalRight);
    // vec3.normalize(right, vec3.multiply(right, right, [1, 0, 1]));

    vec3.scaleAndAdd(this.rawPosition, this.rawPosition, this.forward, -mright * speed);
    vec3.scaleAndAdd(this.rawPosition, this.rawPosition, this.right, mforward * speed);

    const targetPos = [
      Math.round(this.rawPosition[0]) + 0.5,
      Math.round(this.rawPosition[1]),
      Math.round(this.rawPosition[2]) + 0.5,
    ];

    this.position = vec3.lerp(this.position, this.position, targetPos, 25.0 * dt);

    super.update(dt);
  }
}
