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

const MainScene = new class MainScene extends Scene {
  camera = new Camera3D();
  cameraControl = new CameraControl();
  directionalLight = new DirectionalLight(20);
  meshInstance = new MeshInstance();

  async enter() {
    const panoramaTexture = await Texture.load("/src/game/EveningSkyHDRI046B.png");
    const env = new Environment(panoramaTexture);

    this.cameraControl.position = [0, -100, 2];
    this.directionalLight.forward = vec3.normalize(vec3.create(), [0.7, -1, 0]);
    this.cameraControl.forward = vec3.normalize(vec3.create(), [1, -1, 0]);
    mat4.lookAt(this.cameraControl.transform, this.cameraControl.position, vec3.add(vec3.create(), this.cameraControl.position, [1, 0, 0]), [0, 1, 0]);

    const sponza = await ObjMesh.load("/sponza/sponza.obj");

    this.meshInstance = new MeshInstance(sponza);
    this.meshInstance.position = [0, 0, 0];

    this.addChild(this.meshInstance);
    this.cameraControl.addChild(this.camera);
    this.addChild(this.cameraControl);
    this.addChild(this.directionalLight);
  }

  /**
    * @param { number } dt
    */
  update(dt) {
    this.directionalLight.rotate([0.0, 1, 0], 20 * dt);

    super.update(dt);
  }
}

Renderer
  .init()
  .then(async () => {
    await SceneController.changeScene(MainScene);
    SceneController.beginLoop();
  })
