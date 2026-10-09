import { Mesh } from './mesh.js';
import { Renderer } from '../renderer.js';

export class BoxMesh extends Mesh {
  /** @param { number } size */
  constructor(size) {
    super();

    this.buffer = Renderer.device.createBuffer({
      size: 36 * 8 * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });

    const faces = [
      // -Z
      [[size, -size, -size], [-size, -size, -size], [-size, size, -size], [size, size, -size]],
      // +Z
      [[-size, -size, size], [size, -size, size], [size, size, size], [-size, size, size]],
      // -X
      [[-size, -size, -size], [-size, -size, size], [-size, size, size], [-size, size, -size]],
      // +X
      [[size, -size, size], [size, -size, -size], [size, size, -size], [size, size, size]],
      // -Y
      [[-size, -size, -size], [size, -size, -size], [size, -size, size], [-size, -size, size]],
      // +Y
      [[-size, size, size], [size, size, size], [size, size, -size], [-size, size, -size]],
    ];
    const normals = [
      [0, 0, -1],
      [0, 0, 1],
      [-1, 0, 0],
      [1, 0, 0],
      [0, -1, 0],
      [0, 1, 0],
    ];
    const uv = [[0, 0], [1, 0], [1, 1], [0, 1]];
    const indices = [0, 1, 2, 0, 2, 3];
    const vertices = faces.flatMap((face, faceIndex) =>
      indices.flatMap((index) => [...face[index], ...normals[faceIndex], ...uv[index]])
    );

    new Float32Array(this.buffer.getMappedRange()).set(vertices);

    this.buffer.unmap();
    this.vertexCount = 36;
  }
}
