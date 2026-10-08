import { assert } from "../utils.js";
import { Renderer } from "../renderer.js";

export class Mesh {
  /** @type { GPUBuffer } */
  buffer;

  /** @type { GPUVertexBufferLayout } */
  bufferLayout = {
    arrayStride: 20, // how much bytes per vertex
    attributes: [
      {
        shaderLocation: 0,
        format: 'float32x3',
        offset: 0,
      },
      {
        shaderLocation: 1,
        format: 'float32x2',
        offset: 12, // 3 floats offset
      }
    ]
  }

  vertexCount = 0;

  constructor() {
    assert(Renderer.device, "Renderer device is not initialized");
  }
}
