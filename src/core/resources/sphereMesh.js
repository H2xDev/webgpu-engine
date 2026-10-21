import { Mesh } from './mesh.js';
import { Renderer } from '../renderer.js';
import { Material } from './material.js';

export class SphereMesh extends Mesh {
  /**
   * @param { number } radius
   * @param { number } latitudeBands
   * @param { number } longitudeBands
   * @param { Material | null } material
   */
  constructor(radius = 1, latitudeBands = 32, longitudeBands = 32, material = null) {
    super();

    this.generate(radius, latitudeBands, longitudeBands, material);
  }

  /**
   * Builds a UV sphere centered at the origin.
   * @param { number } radius
   * @param { number } latitudeBands
   * @param { number } longitudeBands
   * @param { Material | null } material
   */
  generate(radius, latitudeBands, longitudeBands, material) {
    const vertexData = [];
    const indices = [];

    for (let lat = 0; lat <= latitudeBands; lat++) {
      const theta = (lat * Math.PI) / latitudeBands;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);

      for (let lon = 0; lon <= longitudeBands; lon++) {
        const phi = (lon * 2 * Math.PI) / longitudeBands;
        const sinPhi = Math.sin(phi);
        const cosPhi = Math.cos(phi);

        const x = cosPhi * sinTheta;
        const y = cosTheta;
        const z = sinPhi * sinTheta;

        const u = 1 - lon / longitudeBands;
        const v = 1 - lat / latitudeBands;

        vertexData.push(
          radius * x, radius * y, radius * z, // position
          x, y, z, // normal
          u, v, // uv
        );
      }
    }

    for (let lat = 0; lat < latitudeBands; lat++) {
      for (let lon = 0; lon < longitudeBands; lon++) {
        const first = lat * (longitudeBands + 1) + lon;
        const second = first + longitudeBands + 1;

        indices.push(first, first + 1, second);
        indices.push(second, first + 1, second + 1);
      }
    }

    const device = Renderer.device;
    const vertices = new Float32Array(vertexData);
    const indexArray = new Uint32Array(indices);

    this.vertexBuffer = device.createBuffer({
      size: Math.max(vertices.byteLength, 4),
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(this.vertexBuffer, 0, vertices);

    this.indexBuffer = device.createBuffer({
      size: Math.max(indexArray.byteLength, 4),
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(this.indexBuffer, 0, indexArray);

    this.vertexCount = vertices.length / 8;
    this.indexCount = indexArray.length;

    this.defineSurface(0, this.indexCount, material);
  }
}
