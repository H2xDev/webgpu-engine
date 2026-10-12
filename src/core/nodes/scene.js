import { mat4, vec3 } from '../gl-matrix/index.js';
import { Entity3D } from "./entity_3d.js";
import { Camera3D } from "./camera.js";
import { InputController } from "../inputController.js";
import { MeshInstance } from "./meshInstance.js";
import { ObjMesh } from "../resources/objMesh.js";
import { DirectionalLight } from "./directionalLight.js";

export class Scene extends Entity3D {
  /** @type { Camera3D } */
  camera = new Camera3D();
  directionalLight = new DirectionalLight(20);
  /** @type { MeshInstance } */
  mi;

  constructor() {
    super();
  }

  /** @param { number } dt */
  update(dt) {
    this.camera.update(dt);
    this.mi.update(dt);
    this.directionalLight.rotate([0.0, 1, 0], 20 * dt);
    this.directionalLight.update();
    InputController.update();
  }

  async exit() {
    // Clean up resources or event listeners if needed
  }

  async enter() {
    this.camera.position = [0, -100, 2];
    this.directionalLight.forward = vec3.normalize(vec3.create(), [0.7, -1, 0]);
    this.camera.forward = vec3.normalize(vec3.create(), [1, -1, 0]);
    mat4.lookAt(this.camera.transform, this.camera.position, vec3.add(vec3.create(), this.camera.position, [1, 0, 0]), [0, 1, 0]);
    const sponza = await ObjMesh.load("/sponza/sponza.obj");

    this.mi = new MeshInstance(sponza);
    this.mi.position = [0, 0, 0];
  }
}
