import { Renderer, SceneController } from "@core";
import { MainScene } from "@game/main.js";

Renderer
  .init()
  .then(async () => {
    await SceneController.changeScene(MainScene);
    SceneController.beginLoop();
  })
