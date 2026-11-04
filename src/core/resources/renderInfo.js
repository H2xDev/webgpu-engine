import { AABB } from "./aabb.js";
import { Material } from "./material.js";
import { MeshSurface } from "./mesh.js";
import { Transform } from "./transform.js";

export class RenderInfo {
  /** @type {GPUBuffer} */
  vertices;

  /** @type {GPUBuffer} */
  indices;

  /** @type {number} */
  vertexCount;

  /** @type {number} */
  indexCount;

  /** @type { Transform } */
  transform;

  /** @type { MeshSurface[] } */
  surfaces = [];

  /** @type { AABB } */
  aabb;

  /** @type { Material | null } */
  material = null;
}
