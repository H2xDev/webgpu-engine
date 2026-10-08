import { Entity3D } from "./entity_3d.js";
import { Camera3D } from "./camera.js";
import { InputController } from "../inputController.js";
import { MeshInstance } from "./meshInstance.js";
import { ObjMesh } from "../resources/objMesh.js";

export class Scene extends Entity3D {
  /** @type { Camera3D } */
  camera = new Camera3D();
  /** @type { MeshInstance } */
  mi;

  constructor() {
    super();
  }

  /** @param { number } dt */
  update(dt) {
    this.camera.update(dt);
    this.mi.update(dt);
    InputController.update();
  }

  async exit() {
    // Clean up resources or event listeners if needed
  }

  async enter() {
    this.camera.position = [0, 0, 2];
    const sponza = await ObjMesh.load("/sponza.obj");

    this.mi = new MeshInstance(sponza);
    this.mi.position = [0, 0, 0];
  }
}
