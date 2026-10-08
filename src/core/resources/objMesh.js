import { Mesh } from './mesh.js';
import { Renderer } from '../renderer.js';

/**
 * Parses OBJ position and texture-coordinate data into a non-indexed XYZ+UV vertex array.
 * @param { string } source
 * @returns { Float32Array }
 */
export function parseOBJ(source) {
  if (typeof source !== 'string') {
    throw new TypeError('OBJ source must be a string');
  }

  const positions = [];
  const texCoords = [];
  const vertices = [];
  const lines = source.split(/\r?\n/);

  const resolveIndex = (value, count, kind, lineNumber) => {
    if (!/^[+-]?\d+$/.test(value)) {
      throw new Error(`Invalid OBJ ${kind} index "${value}" on line ${lineNumber}`);
    }

    const index = Number(value);
    const resolvedIndex = index > 0 ? index - 1 : count + index;
    if (index === 0 || resolvedIndex < 0 || resolvedIndex >= count) {
      throw new Error(`OBJ ${kind} index "${value}" is out of range on line ${lineNumber}`);
    }

    return resolvedIndex;
  };

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const lineNumber = lineIndex + 1;
    const commentIndex = lines[lineIndex].indexOf('#');
    const content = (commentIndex === -1
      ? lines[lineIndex]
      : lines[lineIndex].slice(0, commentIndex)
    ).trim();

    if (!content) continue;

    const [command, ...values] = content.split(/\s+/);

    if (command === 'v') {
      if (values.length < 3) {
        throw new Error(`OBJ vertex is incomplete on line ${lineNumber}`);
      }

      const position = values.slice(0, 3).map(Number);
      if (!position.every(Number.isFinite)) {
        throw new Error(`Invalid OBJ vertex on line ${lineNumber}`);
      }
      positions.push(position);
    } else if (command === 'vt') {
      if (values.length < 1) {
        throw new Error(`OBJ texture coordinate is incomplete on line ${lineNumber}`);
      }

      const texCoord = [Number(values[0]), Number(values[1] ?? 0)];
      if (!texCoord.every(Number.isFinite)) {
        throw new Error(`Invalid OBJ texture coordinate on line ${lineNumber}`);
      }
      texCoords.push(texCoord);
    } else if (command === 'f') {
      if (values.length < 3) {
        throw new Error(`OBJ face has fewer than three vertices on line ${lineNumber}`);
      }

      const face = values.map((value) => {
        const parts = value.split('/');
        if (parts.length > 3 || !parts[0]) {
          throw new Error(`Invalid OBJ face vertex "${value}" on line ${lineNumber}`);
        }

        const position = positions[resolveIndex(parts[0], positions.length, 'vertex', lineNumber)];
        const texCoord = parts[1]
          ? texCoords[resolveIndex(parts[1], texCoords.length, 'texture coordinate', lineNumber)]
          : [0, 0];

        return [...position, ...texCoord];
      });

      for (let corner = 1; corner < face.length - 1; corner++) {
        vertices.push(...face[0], ...face[corner], ...face[corner + 1]);
      }
    }
  }

  if (vertices.length === 0) {
    throw new Error('OBJ source does not contain any faces');
  }

  return new Float32Array(vertices);
}

export class ObjMesh extends Mesh {
  /** @param { string } source */
  constructor(source) {
    super();

    const vertices = parseOBJ(source);
    this.buffer = Renderer.device.createBuffer({
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });

    new Float32Array(this.buffer.getMappedRange()).set(vertices);

    this.buffer.unmap();
    this.vertexCount = vertices.length / 5;
  }

  /** @param { string } url */
  static async load(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load OBJ "${url}": ${response.status} ${response.statusText}`);
    }

    return new ObjMesh(await response.text());
  }
}
