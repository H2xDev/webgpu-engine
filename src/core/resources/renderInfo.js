import { Material } from "./material.js";
import { MeshSurface } from "./mesh.js";

export class RenderInfo {
  /** @type {GPUBuffer} */
  vertices;

  /** @type {GPUBuffer} */
  indices;

  /** @type {number} */
  vertexCount;

  /** @type {number} */
  indexCount;

  /** @type {Float32Array} */
  transform;

  /** @type {MeshSurface[]} */
  surfaces = [];

  /** @type {Material | null} */
  material = null;
}
