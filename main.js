import { Renderer } from "./src/core/renderer.js";
import { Scene } from "./src/core/nodes/scene.js";
import { SceneController } from "./src/core/sceneController.js";

const app = new class App {
  /** @type { Scene } */
  scene;

  constructor() {
    Renderer
      .init()
      .then(() => {
        SceneController.changeScene(new Scene());
        SceneController.beginLoop();
      })
  }
}
