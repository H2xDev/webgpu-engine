import { Mesh } from './mesh.js';
import { Renderer } from '../renderer.js';
import { Material } from './material.js';

export class PlaneMesh extends Mesh {
  /**
   * XZ plane facing +Y, centered at the origin.
   * @param { object } [options]
   * @param { number | [number, number] } [options.size] Full size along X and Z.
   * @param { number | [number, number] } [options.segments] Subdivisions along X and Z.
   * @param { Material | null } [options.material]
   */
  constructor({ size = 1, segments = 1, material = null } = {}) {
    super();

    const [sx, sz] = Array.isArray(size) ? size : [size, size];
    const [nx, nz] = (Array.isArray(segments) ? segments : [segments, segments])
      .map((s) => Math.max(1, Math.floor(s)));

    const vertexData = [];
    const indices = [];

    for (let j = 0; j <= nz; j++) {
      for (let i = 0; i <= nx; i++) {
        const u = i / nx;
        const v = j / nz;
        const position = [(u - 0.5) * sx, 0, (0.5 - v) * sz];
        vertexData.push(...position, 0, 1, 0, u, v);
        this.aabb.expand(position);
      }
    }

    const cols = nx + 1;
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const a = j * cols + i;
        const c = a + cols;
        indices.push(a, a + 1, c, a + 1, c + 1, c);
      }
    }

    this.defineSurface(0, indices.length, material);

    const device = Renderer.device;
    const vertices = new Float32Array(vertexData);
    const indexArray = new Uint32Array(indices);

    this.vertexBuffer = device.createBuffer({
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(this.vertexBuffer, 0, vertices);

    this.indexBuffer = device.createBuffer({
      size: indexArray.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(this.indexBuffer, 0, indexArray);

    this.vertexCount = vertices.length / 8;
    this.indexCount = indexArray.length;
  }
}
