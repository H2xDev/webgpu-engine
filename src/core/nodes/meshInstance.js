import { Renderer } from "../renderer.js";
import { Mesh } from "../resources/mesh.js";
import { Material } from "../resources/material.js";
import { Entity3D } from "./entity3d.js";

export class MeshInstance extends Entity3D {
  /** @type { Mesh | null } */
  mesh = null;

  /** @type { Material | null } */
  material = null;

  /**
    * @param { Mesh | null } mesh
    */
  constructor(mesh = null) {
    super();
    this.mesh = mesh;
  }

  /**
    * @param { number } _dt
    */
  update(_dt) {
    if (!this.mesh) return;

    Renderer.queueRender({
      aabb: this.mesh.aabb,
      vertices: this.mesh.vertexBuffer,
      indices: this.mesh.indexBuffer,
      vertexCount: this.mesh.vertexCount,
      indexCount: this.mesh.indexCount,
      transform: this.globalTransform,
      material: this.material,
      surfaces: this.mesh.surfaces,
    })
  }
}
