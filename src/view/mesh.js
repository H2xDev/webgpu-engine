export class Mesh {
  /** @type { GPUBuffer } */
  buffer

  /** @type { GPUVertexBufferLayout } */
  bufferLayout

  /** @param { GPUDevice } device */
  constructor(device) {
    // x y z u v
    const vertices = new Float32Array([
      -0.5, 0.0, -0.5, 0.0, 0.0,
      0.5, 0.0, -0.5, 1.0, 0.0,
      -0.5, 0.0, 0.5, 0.0, 1.0,
      0.5, 0.0, 0.5, 1.0, 1.0,
    ]);

    /** @type { GPUBufferDescriptor } */
    const descriptor = {
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    };

    this.buffer = device.createBuffer(descriptor);

    new Float32Array(this.buffer.getMappedRange()).set(vertices)
    this.buffer.unmap();

    this.bufferLayout = {
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
  }
}
