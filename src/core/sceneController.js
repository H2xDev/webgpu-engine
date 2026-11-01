import { Scene } from './nodes/scene.js'
import { Renderer } from './renderer.js';
import { InputController } from './inputController.js';

export const SceneController = new class SceneController {
  /** @type { Scene | null } */
  currentScene = null;

  /** @param { Scene } scene */
  validateScene(scene) {
    const overridesUpdate = scene.update !== Scene.prototype.update;

    if (overridesUpdate && !/\bsuper\.update\s*\(/.test(scene.update.toString())) {
      throw new Error(`Scene "${scene.constructor.name}" overrides update() but does not call super.update(dt)`);
    }
  }

  /** @param { Scene } scene */
  async changeScene(scene) {
    this.validateScene(scene);

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
    InputController.update();

    requestAnimationFrame(this.beginLoop.bind(this));
  }
}
