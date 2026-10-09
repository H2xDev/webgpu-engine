import { assert } from "../utils.js";
import { Renderer } from "../renderer.js";

export class Mesh {
  /** @type { GPUBuffer } */
  buffer;

  /** @type { GPUVertexBufferLayout } */
  bufferLayout = {
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

  constructor() {
    assert(Renderer.device, "Renderer device is not initialized");
  }
}
