import { Mesh } from './mesh.js';
import { Renderer } from '../renderer.js';
import { Material } from './material.js';
import { Texture } from './texture.js';

const GLB_MAGIC = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

const COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
const READERS = {
  5120: ['getInt8', 1],
  5121: ['getUint8', 1],
  5122: ['getInt16', 2],
  5123: ['getUint16', 2],
  5125: ['getUint32', 4],
  5126: ['getFloat32', 4],
};
const NORMALIZE_DIVISOR = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 };

const resolveUrl = (baseUrl, path) => baseUrl.slice(0, baseUrl.lastIndexOf('/') + 1) + path;

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/** Column-major 4x4 multiplication: a * b */
const mul4 = (a, b) => {
  const out = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      for (let k = 0; k < 4; k++) out[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
    }
  }
  return out;
};

const composeTRS = ([tx, ty, tz], [x, y, z, w], [sx, sy, sz]) => [
  (1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
  2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
  2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
  tx, ty, tz, 1,
];

const nodeMatrix = (node) => node.matrix
  ?? composeTRS(node.translation ?? [0, 0, 0], node.rotation ?? [0, 0, 0, 1], node.scale ?? [1, 1, 1]);

/** Inverse-transpose of the upper 3x3 of a column-major 4x4 matrix, returned column-major. */
const normalMatrix = (m) => {
  const [a, b, c, d, e, f, g, h, i] = [m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]];
  const A = e * i - f * h, B = f * g - d * i, C = d * h - e * g;
  const det = a * A + b * B + c * C || 1;
  return [
    A / det, B / det, C / det,
    (c * h - b * i) / det, (a * i - c * g) / det, (b * g - a * h) / det,
    (b * f - c * e) / det, (c * d - a * f) / det, (a * e - b * d) / det,
  ];
};

export class GlbMesh extends Mesh {
  /**
   * @param { object } json glTF JSON
   * @param { ArrayBuffer[] } buffers
   * @param { Map<number, Material> } materials keyed by glTF material index
   */
  constructor(json, buffers, materials = new Map()) {
    super();

    this.parse(json, buffers, materials);
  }

  /** @param { string } url */
  static async load(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load GLB "${url}": ${response.status} ${response.statusText}`);
    }

    const { json, bin } = GlbMesh.#parseContainer(await response.arrayBuffer());
    const buffers = await Promise.all((json.buffers ?? []).map(async (buffer, i) => {
      if (buffer.uri === undefined) {
        if (!bin || i !== 0) throw new Error(`GLB "${url}": buffer ${i} has no data`);
        return bin;
      }
      const blob = await GlbMesh.#fetchUri(buffer.uri, url);
      return blob.arrayBuffer();
    }));

    const materials = await GlbMesh.#loadMaterials(json, buffers, url);
    return new GlbMesh(json, buffers, materials);
  }

  /** @param { ArrayBuffer } data */
  static #parseContainer(data) {
    const view = new DataView(data);
    if (view.byteLength < 12 || view.getUint32(0, true) !== GLB_MAGIC) {
      throw new Error('Not a valid GLB file');
    }
    if (view.getUint32(4, true) !== 2) throw new Error('Unsupported GLB version');

    const length = Math.min(view.getUint32(8, true), view.byteLength);
    let json = null;
    let bin = null;
    let offset = 12;
    while (offset + 8 <= length) {
      const chunkLength = view.getUint32(offset, true);
      const chunkType = view.getUint32(offset + 4, true);
      const start = offset + 8;
      if (chunkType === CHUNK_JSON) {
        json = JSON.parse(new TextDecoder().decode(new Uint8Array(data, start, chunkLength)));
      } else if (chunkType === CHUNK_BIN && !bin) {
        bin = data.slice(start, start + chunkLength);
      }
      offset = start + chunkLength + ((4 - (chunkLength % 4)) % 4);
    }

    if (!json) throw new Error('GLB has no JSON chunk');
    return { json, bin };
  }

  static async #fetchUri(uri, baseUrl) {
    const response = await fetch(uri.startsWith('data:') ? uri : resolveUrl(baseUrl, uri));
    if (!response.ok) throw new Error(`Failed to load "${uri}": ${response.status} ${response.statusText}`);
    return response.blob();
  }

  static async #loadMaterials(json, buffers, url) {
    const imageCache = new Map();
    const loadTexture = (textureIndex) => {
      if (textureIndex === undefined) return Promise.resolve(null);
      const imageIndex = json.textures?.[textureIndex]?.source;
      const image = json.images?.[imageIndex];
      if (!image) return Promise.resolve(null);

      if (!imageCache.has(imageIndex)) {
        imageCache.set(imageIndex, (async () => {
          let blob;
          if (image.bufferView !== undefined) {
            const bv = json.bufferViews[image.bufferView];
            const bytes = new Uint8Array(buffers[bv.buffer], bv.byteOffset ?? 0, bv.byteLength);
            blob = new Blob([bytes], { type: image.mimeType });
          } else {
            blob = await GlbMesh.#fetchUri(image.uri, url);
          }
          const bitmap = await createImageBitmap(blob, { colorSpaceConversion: 'none' });
          return new Texture().init(bitmap);
        })().catch((e) => {
          console.error(e);
          return null;
        }));
      }
      return imageCache.get(imageIndex);
    };

    const materials = new Map();
    for (const [index, def] of (json.materials ?? []).entries()) {
      const albedo = await loadTexture(def.pbrMetallicRoughness?.baseColorTexture?.index);
      const normal = await loadTexture(def.normalTexture?.index);
      const emission = await loadTexture(def.emissiveTexture?.index);
      const roughness = await loadTexture(def.pbrMetallicRoughness?.metallicRoughnessTexture?.index);

      const material = new Material().init(albedo, normal, roughness, emission);
      if (normal && def.normalTexture.scale !== undefined) material.normalScale = def.normalTexture.scale;
      const baseColor = def.pbrMetallicRoughness?.baseColorFactor;
      if (baseColor) material.albedoTint = baseColor.slice(0, 3);

      material.metallic = def.pbrMetallicRoughness?.metallicFactor ?? 1.0;
      material.roughness = def.pbrMetallicRoughness?.roughnessFactor ?? 1.0;

      console.log(def);

      materials.set(index, material);
    }

    return materials;
  }

  /**
   * Reads an accessor into a flat, de-interleaved array (normalized when required).
   * @returns { number[] }
   */
  static #readAccessor(json, buffers, index) {
    const accessor = json.accessors[index];
    const size = COMPONENTS[accessor.type];
    const [getter, bytes] = READERS[accessor.componentType];
    const out = new Array(accessor.count * size).fill(0);
    const divisor = accessor.normalized ? NORMALIZE_DIVISOR[accessor.componentType] : 0;

    if (accessor.bufferView !== undefined) {
      const bv = json.bufferViews[accessor.bufferView];
      const view = new DataView(buffers[bv.buffer]);
      const base = (bv.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
      const stride = bv.byteStride || size * bytes;

      for (let i = 0; i < accessor.count; i++) {
        for (let c = 0; c < size; c++) {
          const v = view[getter](base + i * stride + c * bytes, true);
          out[i * size + c] = divisor ? Math.max(v / divisor, -1) : v;
        }
      }
    }

    return out;
  }

  parse(json, buffers, materials = new Map()) {
    const vertexData = [];
    const indices = [];

    const addPrimitive = (primitive, matrix) => {
      if ((primitive.mode ?? 4) !== 4) return;
      const attrs = primitive.attributes;
      if (attrs.POSITION === undefined) return;

      let positions = GlbMesh.#readAccessor(json, buffers, attrs.POSITION);
      let normals = attrs.NORMAL !== undefined ? GlbMesh.#readAccessor(json, buffers, attrs.NORMAL) : null;
      let uvs = attrs.TEXCOORD_0 !== undefined ? GlbMesh.#readAccessor(json, buffers, attrs.TEXCOORD_0) : null;
      let local = primitive.indices !== undefined
        ? GlbMesh.#readAccessor(json, buffers, primitive.indices)
        : Array.from({ length: positions.length / 3 }, (_, i) => i);

      // Missing normals: unshare vertices per triangle to get flat shading.
      if (!normals) {
        const flatPositions = [];
        const flatNormals = [];
        const flatUvs = [];
        for (let t = 0; t + 2 < local.length; t += 3) {
          const p = [0, 1, 2].map((k) => positions.slice(local[t + k] * 3, local[t + k] * 3 + 3));
          const a = p[1].map((v, i) => v - p[0][i]);
          const b = p[2].map((v, i) => v - p[0][i]);
          const n = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
          const len = Math.hypot(...n) || 1;
          for (let k = 0; k < 3; k++) {
            flatPositions.push(...p[k]);
            flatNormals.push(n[0] / len, n[1] / len, n[2] / len);
            flatUvs.push(uvs?.[local[t + k] * 2] ?? 0, uvs?.[local[t + k] * 2 + 1] ?? 0);
          }
        }
        positions = flatPositions;
        normals = flatNormals;
        uvs = flatUvs;
        local = Array.from({ length: positions.length / 3 }, (_, i) => i);
      }

      const nm = normalMatrix(matrix);
      const base = vertexData.length / 8;

      for (let i = 0; i < positions.length / 3; i++) {
        const [x, y, z] = [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]];
        const [nx, ny, nz] = [normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]];

        const n = [
          nm[0] * nx + nm[3] * ny + nm[6] * nz,
          nm[1] * nx + nm[4] * ny + nm[7] * nz,
          nm[2] * nx + nm[5] * ny + nm[8] * nz,
        ];
        const len = Math.hypot(...n) || 1;

        const vx = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12];
        const vy = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13];
        const vz = matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14];

        this.aabb.expand([vx, vy, vz]);

        vertexData.push(
          vx, vy, vz,
          n[0] / len, n[1] / len, n[2] / len,
          uvs?.[i * 2] ?? 0, uvs?.[i * 2 + 1] ?? 0,
        );
      }

      const offset = indices.length;
      for (const i of local) indices.push(base + i);
      this.defineSurface(offset, indices.length - offset, materials.get(primitive.material) ?? null);
    };

    const visit = (nodeIndex, parent, stack) => {
      const node = json.nodes?.[nodeIndex];
      if (!node || stack.has(nodeIndex)) return;
      const matrix = mul4(parent, nodeMatrix(node));

      if (node.mesh !== undefined) {
        for (const primitive of json.meshes[node.mesh].primitives) addPrimitive(primitive, matrix);
      }
      stack.add(nodeIndex);
      for (const child of node.children ?? []) visit(child, matrix, stack);
      stack.delete(nodeIndex);
    };

    if (json.nodes?.length) {
      const roots = json.scenes?.[json.scene ?? 0]?.nodes ?? json.nodes.map((_, i) => i);
      for (const root of roots) visit(root, IDENTITY, new Set());
    } else {
      for (const mesh of json.meshes ?? []) {
        for (const primitive of mesh.primitives) addPrimitive(primitive, IDENTITY);
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
  }
}
