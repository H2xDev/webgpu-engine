import { Renderer } from "./src/view/renderer.js";
import { Scene } from "./src/model/scene.js";
import { InputController } from "./src/controller/input.js";

const app = new class App {
  scene = new Scene();
  renderer = new Renderer();
  input = new InputController();

  constructor() {
    this.renderer.init().then(() => {
      this.renderer.render(this.scene);
    })
  }
}
