import { assert } from "../utils.js";
import { Renderer } from "../renderer.js";
import { Material } from "./material.js";

export class MeshSurface {
  offset = 0;
  count = 0;
  material = null;
}

export class Mesh {
  /** @type { GPUBuffer } */
  vertexBuffer;

  /** @type { GPUBuffer } */
  indexBuffer;

  /** @type { MeshSurface[] } */
  surfaces = [];

  /** @type { GPUVertexBufferLayout } */
  vertexBufferLayout = {
    arrayStride: 32, // position, normal, and UV per vertex
    attributes: [
      {
        shaderLocation: 0,
        format: 'float32x3',
        offset: 0,
      },
      {
        shaderLocation: 1,
        format: 'float32x3',
        offset: 12,
      },
      {
        shaderLocation: 2,
        format: 'float32x2',
        offset: 24, // 6 floats offset
      }
    ]
  }

  vertexCount = 0;
  indexCount = 0;

  constructor() {
    assert(Renderer.device, "Renderer device is not initialized");
  }

  /**
    * @param { number } offset
    * @param { number } count
    * @param { Material | null } material
    */
  defineSurface(offset, count, material) {
    const surface = new MeshSurface();
    surface.offset = offset;
    surface.count = count;
    surface.material = material;
    this.surfaces.push(surface);
  }
}
