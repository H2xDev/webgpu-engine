import { Entity3D } from "./entity3d.js";

export class Scene extends Entity3D {
  constructor() {
    super();
  }

  async exit() {
    // Clean up resources or event listeners if needed
  }

  async enter() {
    // Initialize scene resources or setup if needed
  }
}
