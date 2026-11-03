import { Scene } from './nodes/scene.js'
import { Renderer } from './renderer.js';
import { InputController } from './inputController.js';

export const SceneController = new class SceneController {
  constructor() {
    this.beginLoop = this.beginLoop.bind(this);
  }

  /** @type { Scene | null } */
  currentScene = null;

  /** @param { Scene } scene */
  /** @param { Scene } scene */
  async changeScene(scene) {
    if (this.currentScene) {
      await this.currentScene.exit();
      this.currentScene.cleanup();
      this.currentScene = null;
    }

    await scene.enter();
    this.currentScene = scene;
  }

  lastTimestamp = 0;
  beginLoop(timestamp = 0) {
    const dt = Math.min(0.1, (timestamp - this.lastTimestamp) * 0.001);
    this.lastTimestamp = timestamp;

    if (this.currentScene) {
      this.currentScene.updateEntities(dt);
    }

    Renderer.render();
    InputController.update();

    requestAnimationFrame(this.beginLoop);
  }
}
