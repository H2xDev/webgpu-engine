import { Renderer } from "../renderer.js";
import { Mesh } from "../resources/mesh.js";
import { Material } from "../resources/material.js";
import { Entity3D } from "./entity_3d.js";

export class MeshInstance extends Entity3D {
  /** @type { Mesh | null } */
  mesh = null;

  /** @type { Material | null } */
  material = null;

  constructor(mesh = null) {
    super();
    this.mesh = mesh;
  }

  update(_dt) {
    if (!this.mesh) return;

    Renderer.queueRender({
      vertices: this.mesh.buffer,
      vertexCount: this.mesh.vertexCount,
      transform: this.transform,
      material: this.material,
    })
  }
}
