import { Scene } from './nodes/scene.js'
import { Renderer } from './renderer.js';

export const SceneController = new class SceneController {
  /** @type { Scene | null } */
  currentScene = null;

  /** @param { Scene } scene */
  async changeScene(scene) {
    if (this.currentScene) {
      await this.currentScene.exit();
      this.currentScene = null;
    }

    await scene.enter();
    this.currentScene = scene;
  }

  lastTimestamp = 0;
  beginLoop(timestamp = 0) {
    const dt = (timestamp - this.lastTimestamp) * 0.001;
    this.lastTimestamp = timestamp;

    if (this.currentScene) {
      this.currentScene.update(dt);
    }

    Renderer.render();

    requestAnimationFrame(this.beginLoop.bind(this));
  }
}
