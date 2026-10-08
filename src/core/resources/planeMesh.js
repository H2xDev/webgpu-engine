import { Mesh } from './mesh.js';
import { Renderer } from '../renderer.js';

export class PlaneMesh extends Mesh {
  /** @param { number } size */
  constructor(size) {
    super();

    this.buffer = Renderer.device.createBuffer({
      size: 6 * 5 * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });

    const vertices = [
      -size, 0, -size, 0, 0,
      -size, 0, size, 0, 1,
      size, 0, size, 1, 1,
      -size, 0, -size, 0, 0,
      size, 0, size, 1, 1,
      size, 0, -size, 1, 0,
    ];

    new Float32Array(this.buffer.getMappedRange()).set(vertices);

    this.buffer.unmap();
    this.vertexCount = 6;
  }
}