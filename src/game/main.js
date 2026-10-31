import { vec3, mat4 } from "gl-matrix";

import { Scene, Camera3D, MeshInstance, DirectionalLight, Environment, OrbitControl } from "@core/nodes";
import { Texture, GlbMesh, BoxMesh, Material, PlaneMesh } from "@core/resources";

import { Player } from "@game/player.js";
import { LevelGenerator } from "@game/level.js";

export const MainScene = new class MainScene extends Scene {
  camera = new Camera3D();
  cameraControl = new OrbitControl();

  /** @type { DirectionalLight } */
  directionalLight;

  /** @type { LevelGenerator } */
  levelGenerator;

  defineDirectionalLight() {
    this.directionalLight = new DirectionalLight(10);
    this.directionalLight.color = [10.0, 10.0, 10.0];
    this.directionalLight.position = [0, 0, 0];
    this.directionalLight.forward = vec3.normalize(vec3.create(), [-1, -0.2, -1]);

    this.directionalLight = this.addChild(this.directionalLight);
  }

  async enter() {
    const panoramaTexture = await Texture.load("/src/game/sky.exr");
    const glbMesh = await GlbMesh.load("/queen_of_swords/skull_salazar_downloadable.glb");

    this.addChild(new MeshInstance(glbMesh));
    this.addChild(new Camera3D());
    this.addChild(new Environment(panoramaTexture));

    this.cameraControl.addChild(this.camera);
    this.addChild(this.cameraControl);
  }

  /**
    * @param { number } dt
    */
  update(dt) {
    super.update(dt);
  }
}
