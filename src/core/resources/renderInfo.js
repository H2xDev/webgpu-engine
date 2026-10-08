import { Material } from "./material.js";

export class RenderInfo {
  /** @type {GPUBuffer} */
  vertices;

  /** @type {number} */
  vertexCount;

  /** @type {Float32Array} */
  transform;

  /** @type {Material | null} */
  material = null;
}
