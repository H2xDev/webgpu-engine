import { vec3, mat4 } from "./src/core/gl-matrix/index.js";

import { Renderer } from "./src/core/renderer.js";
import { Scene } from "./src/core/nodes/scene.js";
import { SceneController } from "./src/core/sceneController.js";
import { Camera3D } from "./src/core/nodes/camera.js";
import { MeshInstance } from "./src/core/nodes/meshInstance.js";
import { DirectionalLight } from "./src/core/nodes/directionalLight.js";
import { Texture } from "./src/core/resources/texture.js";
import { Environment } from "./src/core/nodes/environment.js";
import { GlbMesh } from "./src/core/resources/glbMesh.js";
import { OrbitControl } from "./src/core/nodes/orbitControl.js";
import { BoxMesh } from "./src/core/resources/boxMesh.js";
import { Material } from "./src/core/resources/material.js";
import { PlaneMesh } from "./src/core/resources/planeMesh.js";
import { Player } from "./src/game/player.js";

const MAP_WIDTH = 10;
const MAP_DEPTH = 6;

/**
 * Generates a grid of column heights: walls on the border, a few pillars inside.
 * @param { number } width
 * @param { number } depth
 * @param { number } maxHeight
 * @param { number } pillarChance
 */
function generateMap(width, depth, maxHeight = 4, pillarChance = 0.08) {
  const result = new Array(width * depth).fill(0);

  for (let z = 0; z < depth; z++) {
    for (let x = 0; x < width; x++) {
      const isBorder = x === 0 || z === 0 || x === width - 1 || z === depth - 1;

      if (isBorder) {
        result[z * width + x] = Math.random() < 0.7 ? 1 : 1 + Math.floor(Math.random() * maxHeight);
      } else if (Math.random() < pillarChance) {
        result[z * width + x] = 1 + Math.floor(Math.random() * 2);
      }
    }
  }

  return result;
}

const map = generateMap(MAP_WIDTH, MAP_DEPTH);
const MAP_HEIGHT = MAP_DEPTH;

const MainScene = new class MainScene extends Scene {
  camera = new Camera3D();
  cameraControl = new OrbitControl();
  /** @type { DirectionalLight } */
  directionalLight;

  defineDirectionalLight() {
    this.directionalLight = new DirectionalLight(10);
    this.directionalLight.color = [10.0, 10.0, 10.0];
    this.directionalLight.position = [0, 0, 0];
    this.directionalLight.forward = vec3.normalize(vec3.create(), [-1, -0.2, -1]);
    this.addChild(this.directionalLight);
  }

  async enter() {
    const panoramaTexture = await Texture.load("/src/game/gradient_panorama.png");
    const glbMesh = await GlbMesh.load("/queen_of_swords/skull_salazar_downloadable.glb");

    const cube = new BoxMesh({
      size: [1, 0.5, 1],
      bevel: 0.05,
      bevelSegments: 0,
      material: Object.assign(new Material().init(), {
        albedoTint: [1.0, 1.0, 1.0],
        metallic: 0.0,
        roughness: 1.0,
      }),
    });

    this.addChild(new Player());

    const ground = new MeshInstance(new PlaneMesh({
      size: [100, 100],
      material: Object.assign(new Material().init(), {
        albedoTint: [0.8, 0.8, 0.8],
        metallic: 0.0,
        roughness: 0.5,
      }),
    }))

    ground.position = [0, -0.25, 0];
    this.addChild(ground);

    const env = new Environment(panoramaTexture);
    env.energy = 0.8;

    this.defineDirectionalLight();

    this.camera.fov = 10;

    const [cubeW, cubeH, cubeD] = cube.aabb.getSize();
    const cubeCenter = cube.aabb.getCenter();
    const offsetX = (MAP_WIDTH - 1) / 2;
    const offsetZ = (MAP_HEIGHT - 1) / 2;

    for (let i = 0; i < map.length; i++) {
      for (let j = 0; j < map[i]; j++) {
        if (!map[i]) continue;

        const x = i % MAP_WIDTH;
        const z = Math.floor(i / MAP_WIDTH);
        const instance = new MeshInstance(cube);

        instance.position = [
          (x - offsetX) * cubeW - cubeCenter[0],
          -cubeCenter[1] + j * cubeH,
          (z - offsetZ) * cubeD - cubeCenter[2],
        ];

        this.addChild(instance);
      }
    }

    const halfFov = (this.camera.fov * Math.PI / 180) / 2;
    const mapSize = Math.max(MAP_WIDTH * cubeW, MAP_HEIGHT * cubeD, cubeH);
    this.cameraControl.distance = mapSize / 2 / Math.tan(halfFov);
    this.cameraControl.pitch = 45;
    this.cameraControl.yaw = -75;

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

Renderer
  .init()
  .then(async () => {
    await SceneController.changeScene(MainScene);
    SceneController.beginLoop();
  })
