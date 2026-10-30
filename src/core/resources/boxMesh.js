import { Mesh } from './mesh.js';
import { Renderer } from '../renderer.js';
import { Material } from './material.js';

// [normal, uAxis, vAxis] with uAxis x vAxis = normal (counter-clockwise winding)
const FACES = [
  [[1, 0, 0], [0, 0, -1], [0, 1, 0]],
  [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
  [[0, 1, 0], [1, 0, 0], [0, 0, -1]],
  [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
  [[0, 0, 1], [1, 0, 0], [0, 1, 0]],
  [[0, 0, -1], [-1, 0, 0], [0, 1, 0]],
];

export class BoxMesh extends Mesh {
  /**
   * @param { object } [options]
   * @param { number | [number, number, number] } [options.size] Full box size.
   * @param { number } [options.bevel] Edge rounding radius (clamped to half of the smallest side).
   * @param { number } [options.bevelSegments] Subdivisions across each rounded edge.
   * @param { Material | null } [options.material]
   */
  constructor({ size = 1, bevel = 0, bevelSegments = 4, material = null } = {}) {
    super();

    const [sx, sy, sz] = Array.isArray(size) ? size : [size, size, size];
    const half = [sx / 2, sy / 2, sz / 2];
    const b = Math.max(0, Math.min(bevel, ...half));
    const segs = b > 0 ? Math.max(1, Math.floor(bevelSegments)) : 0;

    // Normalized [-1, 1] sample offsets along a face axis: edge arcs on both ends.
    const samples = (halfLen) => {
      if (segs === 0) return [-1, 1];
      const r = b / halfLen;
      const out = [];
      for (let k = 0; k <= segs; k++) out.push(-1 + r * (k / segs));
      for (let k = 0; k <= segs; k++) out.push(1 - r + r * (k / segs));
      return out;
    };

    const axisOf = (a) => a.findIndex((c) => c !== 0);
    const vertexData = [];
    const indices = [];

    for (const [n, u, v] of FACES) {
      const ua = axisOf(u), va = axisOf(v), na = axisOf(n);
      const us = samples(half[ua]);
      const vs = samples(half[va]);
      const base = vertexData.length / 8;

      for (let j = 0; j < vs.length; j++) {
        for (let i = 0; i < us.length; i++) {
          const point = [0, 0, 0];
          point[na] = n[na] * half[na];
          point[ua] = u[ua] * us[i] * half[ua];
          point[va] = v[va] * vs[j] * half[va];

          let normal = n;
          let position = point;
          if (b > 0) {
            const inner = point.map((c, a) => Math.max(-(half[a] - b), Math.min(half[a] - b, c)));
            const dir = point.map((c, a) => c - inner[a]);
            const len = Math.hypot(...dir) || 1;
            normal = dir.map((c) => c / len);
            position = inner.map((c, a) => c + normal[a] * b);
          }

          vertexData.push(...position, ...normal, (us[i] + 1) / 2, 1 - (vs[j] + 1) / 2);
          this.aabb.expand(position);
        }
      }

      const cols = us.length;
      for (let j = 0; j < vs.length - 1; j++) {
        for (let i = 0; i < cols - 1; i++) {
          const a = base + j * cols + i;
          const c = a + cols;
          indices.push(a, a + 1, c, a + 1, c + 1, c);
        }
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
