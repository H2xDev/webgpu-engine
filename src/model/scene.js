import { Entity3D } from "./entity_3d.js";
import { Camera3D } from "./camera.js";
import { Triangle } from "./triangle.js";
import { InputController } from "../controller/input.js";

export class Scene extends Entity3D {
  input = new InputController();

  /** @type { Camera3D } */
  camera = new Camera3D();

  /** @type { Triangle[] } */
  triangles = [];

  constructor() {
    super();
    this.camera.position = [0, 0, 2];

    const triangle = new Triangle();
    triangle.position = [0, -0.5, 0];

    this.triangles.push(triangle);
  }

  /** @param { number } dt */
  update(dt) {
    for (const triangle of this.triangles) {
      triangle.update(dt);
    }

    this.camera.update(dt);
    this.input.update();
  }
}
