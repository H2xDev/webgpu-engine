import { Mesh } from './mesh.js';
import { Renderer } from '../renderer.js';
import { Material } from './material.js';
import { Texture } from './texture.js';

const resolveUrl = (baseUrl, path) => {
      console.log(path);
  path = path.replace(/\\/g, '/');
  return baseUrl.slice(0, baseUrl.lastIndexOf('/') + 1) + path;
};

const colorTexture = ([r, g, b]) => {
  const pixels = new Uint8Array([r, g, b, 1].map((v) => Math.round(Math.min(Math.max(v, 0), 1) * 255)));
  return new Texture().initPixels(1, 1, pixels);
};

class ObjMaterialImporter {
  /**
   * Parses MTL source into material descriptions.
   * @param { string } source
   * @returns { Map<string, { diffuse: number[], albedoMap: string | null, normalMap: string | null }> }
   */
  static parse(source) {
    const defs = new Map();
    let current = null;

    for (const rawLine of source.split(/\r?\n/)) {
      const line = rawLine.split('#')[0].trim();
      if (!line) continue;

      const space = line.search(/\s/);
      if (space < 0) continue;
      const keyword = line.slice(0, space).toLowerCase();
      const args = line.slice(space).trim();

      if (keyword === 'newmtl') {
        current = { diffuse: [1, 1, 1], albedoMap: null, normalMap: null };
        defs.set(args, current);
      } else if (!current) {
        continue;
      } else if (keyword === 'kd') {
        const c = args.split(/\s+/).map(Number);
        if (c.length >= 3 && c.every(Number.isFinite)) current.diffuse = c.slice(0, 3);
      } else if (keyword === 'map_kd') {
        current.albedoMap = ObjMaterialImporter.#textureName(args);
      } else if (keyword === 'map_disp' || keyword === 'bump' || keyword === 'norm') {
        current.normalMap = ObjMaterialImporter.#textureName(args);
      }
    }

    return defs;
  }

  /** Strips texture options (e.g. "-bm 1.0") and returns the file path. */
  static #textureName(args) {
    const optionArity = {
      '-blendu': 1, '-blendv': 1, '-cc': 1, '-clamp': 1, '-imfchan': 1, '-mm': 2,
      '-o': 3, '-s': 3, '-t': 3, '-texres': 1, '-bm': 1, '-boost': 1, '-type': 1,
    };
    const tokens = args.split(/\s+/);
    let i = 0;
    while (i < tokens.length && tokens[i].toLowerCase() in optionArity) {
      i += 1 + optionArity[tokens[i].toLowerCase()];
    }
    return tokens.slice(i).join(' ') || null;
  }

  /**
   * @param { string } url
   * @returns { Promise<Map<string, Material>> }
   */
  static async load(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load material library "${url}": ${response.status} ${response.statusText}`);
    }

    const defs = ObjMaterialImporter.parse(await response.text());
    const textureCache = new Map();
    const loadTexture = (path) => {
      path = path.replace('.tga', '.png');

      const textureUrl = resolveUrl(url, path);
      if (!textureCache.has(textureUrl)) {
        textureCache.set(textureUrl, Texture.load(textureUrl).catch((e) => {
          console.error(e);
          return null;
        }));
      }
      return textureCache.get(textureUrl);
    };

    const materials = new Map();
    for (const [name, def] of defs) {
      const albedo = (def.albedoMap && await loadTexture(def.albedoMap));
      const normal = def.normalMap ? await loadTexture(def.normalMap) : null;

      if (albedo && normal) {
        materials.set(name, new Material().init(albedo, normal));
      }
    }

    return materials;
  }
}

export class ObjMesh extends Mesh {
  /**
   * @param { string } source
   * @param { Map<string, Material> } materials
   */
  constructor(source, materials = new Map()) {
    super();

    this.parse(source, materials);
  }

  /** @param { string } url */
  static async load(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load OBJ "${url}": ${response.status} ${response.statusText}`);
    }
    const source = await response.text();

    const materials = new Map();
    for (const [, lib] of source.matchAll(/^\s*mtllib\s+(.+?)\s*$/gm)) {
      try {
        const loaded = await ObjMaterialImporter.load(resolveUrl(url, lib));
        for (const [name, material] of loaded) materials.set(name, material);
      } catch (e) {
        console.error(e);
        console.trace(e.message);
      }
    }

    return new ObjMesh(source, materials);
  }

  /**
   * @param { string } source
   * @param { Map<string, Material> } materials
   */
  parse(source, materials = new Map()) {
    const positions = [];
    const normals = [];
    const uvs = [];

    const vertexData = [];
    const indices = [];
    const vertexCache = new Map();

    let surfaceStart = 0;
    let surfaceMaterial = null;

    const closeSurface = () => {
      const count = indices.length - surfaceStart;
      if (count > 0) this.defineSurface(surfaceStart, count, surfaceMaterial);
      surfaceStart = indices.length;
    };

    const resolve = (list, raw, size) => {
      if (!raw) return -1;
      const total = list.length / size;
      const n = parseInt(raw, 10);
      const index = n < 0 ? total + n : n - 1;
      return index >= 0 && index < total ? index : -1;
    };

    const pushVertex = (ref, faceNormal, faceId) => {
      const [vRaw, vtRaw, vnRaw] = ref.split('/');
      const p = resolve(positions, vRaw, 3);
      if (p < 0) return null;
      const t = resolve(uvs, vtRaw, 2);
      const n = resolve(normals, vnRaw, 3);

      const key = n >= 0 ? `${p}/${t}/${n}` : `${p}/${t}/f${faceId}`;
      let index = vertexCache.get(key);
      if (index === undefined) {
        const nrm = n >= 0 ? normals.slice(n * 3, n * 3 + 3) : faceNormal;
        const uv = t >= 0 ? [uvs[t * 2], 1 - uvs[t * 2 + 1]] : [0, 0];
        index = vertexData.length / 8;
        vertexData.push(...positions.slice(p * 3, p * 3 + 3), ...nrm, ...uv);
        vertexCache.set(key, index);
      }
      return index;
    };

    const computeNormal = (refs) => {
      const pts = refs.slice(0, 3).map((r) => {
        const p = resolve(positions, r.split('/')[0], 3);
        return p < 0 ? [0, 0, 0] : positions.slice(p * 3, p * 3 + 3);
      });
      const a = pts[1].map((v, i) => v - pts[0][i]);
      const b = pts[2].map((v, i) => v - pts[0][i]);
      const n = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
      const len = Math.hypot(...n) || 1;
      return n.map((v) => v / len);
    };

    let faceId = 0;
    for (const rawLine of source.split(/\r?\n/)) {
      const line = rawLine.split('#')[0].trim();
      if (!line) continue;

      const parts = line.split(/\s+/);
      const keyword = parts[0];

      switch (keyword) {
        case 'v':
          positions.push(+parts[1], +parts[2], +parts[3]);
          break;
        case 'vn':
          normals.push(+parts[1], +parts[2], +parts[3]);
          break;
        case 'vt':
          uvs.push(+parts[1], +(parts[2] ?? 0));
          break;
        case 'usemtl':
          closeSurface();
          surfaceMaterial = materials.get(line.slice(keyword.length).trim()) ?? null;
          break;
        case 'f': {
          const refs = parts.slice(1);
          if (refs.length < 3) break;
          const faceNormal = computeNormal(refs);
          const id = faceId++;
          const face = refs.map((r) => pushVertex(r, faceNormal, id));
          if (face.includes(null)) break;
          for (let i = 1; i < face.length - 1; i++) {
            indices.push(face[0], face[i], face[i + 1]);
          }
          break;
        }
      }
    }

    closeSurface();

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
