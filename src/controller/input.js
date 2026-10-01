import { vec2 } from "../gl-matrix/index.js";

export class InputController {
  /** @type { InputController } */
  static instance = null;

  #keys = new Set();
  mousePos = vec2.create();
  mouseMovement = vec2.create();

  /** @param { HTMLElement } domElement */
  constructor(domElement = document.body) {
    if (InputController.instance) {
      return InputController.instance;
    }

    domElement.addEventListener("keydown", (event) => {
      this.#keys.add(event.code);
    });

    domElement.addEventListener("keyup", (event) => {
      this.#keys.delete(event.code);
    });

    domElement.addEventListener("mousemove", (event) => {
      this.mousePos[0] = event.clientX;
      this.mousePos[1] = event.clientY;
      this.mouseMovement[0] = event.movementX;
      this.mouseMovement[1] = event.movementY;
    });

    InputController.instance = this;
  }

  /** @param { string } key */
  is_key_pressed(key) {
    return this.#keys.has(key);
  }

  update() {
    this.mouseMovement[0] = 0;
    this.mouseMovement[1] = 0;
  }
};
