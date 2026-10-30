import { mat4, vec3 } from "./src/core/gl-matrix/index.js";

import { Renderer } from "./src/core/renderer.js";
import { Scene } from "./src/core/nodes/scene.js";
import { SceneController } from "./src/core/sceneController.js";
import { Camera3D } from "./src/core/nodes/camera.js";
import { ObjMesh } from "./src/core/resources/objMesh.js";
import { MeshInstance } from "./src/core/nodes/meshInstance.js";
import { DirectionalLight } from "./src/core/nodes/directionalLight.js";
import { CameraControl } from "./src/game/cameraControl.js";
import { Texture } from "./src/core/resources/texture.js";
import { Environment } from "./src/core/nodes/environment.js";
import { GlbMesh } from "./src/core/resources/glbMesh.js";
import { OrbitControl } from "./src/core/nodes/orbitControl.js";

const MainScene = new class MainScene extends Scene {
  camera = new Camera3D();
  cameraControl = new OrbitControl();
  meshInstance = new MeshInstance();
  /** @type { DirectionalLight } */
  directionalLight;

  defineDirectionalLight() {
    this.directionalLight = new DirectionalLight(0.01);
    this.directionalLight.position = [0, 0, 0];
    this.directionalLight.forward = vec3.normalize(vec3.create(), [-1, -1, -1]);
    this.addChild(this.directionalLight);
  }

  async enter() {
    const panoramaTexture = await Texture.load("/src/game/IndoorEnvironmentHDRI005_2K_HDR.exr");
    const sponza = await GlbMesh.load("/queen_of_swords/silent_ash.glb");

    const env = new Environment(panoramaTexture);
    env.energy = 2.0;

    this.defineDirectionalLight();

    this.camera.fov = 20;

    this.meshInstance = new MeshInstance(sponza);
    this.meshInstance.position = vec3.scale(vec3.create(), sponza.aabb.getCenter(), -1);

    const halfFov = (this.camera.fov * Math.PI / 180) / 2;
    this.cameraControl.distance = Math.max(...sponza.aabb.getSize()) / 2 / Math.tan(halfFov);

    this.addChild(this.meshInstance);
    this.cameraControl.addChild(this.camera);
    this.addChild(this.cameraControl);
  }

  /**
    * @param { number } dt
    */
  update(dt) {
    super.update(dt);

    if (this.directionalLight) {
      this.directionalLight.rotate([0.0, 1, 0], 20 * dt);
    }
  }
}

Renderer
  .init()
  .then(async () => {
    await SceneController.changeScene(MainScene);
    SceneController.beginLoop();
  })
