import { Renderer } from "../renderer.js";
import { Texture } from "./texture.js";

export class Material {
  /** @type { GPUTexture } */
  static FALLBACK_NORMAL_MAP;

  /** @type { GPUSampler } */
  static FALLBACK_NORMAL_MAP_SAMPLER;

  /** @type { GPUTexture } */
  static FALLBACK_ALBEDO_MAP;

  /** @type { GPUSampler } */
  static FALLBACK_ALBEDO_MAP_SAMPLER;

  /** @type { Texture } */
  albedo;

  /** @type { Texture } */
  normalMap;

  /** @type { GPUBindGroup } */
  bindGroup;

  /** @type { GPUBuffer } */
  #uniformBuffer;

  #normalScale = 3.0;
  get normalScale() {
    return this.#normalScale;
  }

  set normalScale(value) {
    this.#normalScale = value;
    Renderer.device.queue.writeBuffer(this.#uniformBuffer, 0, new Float32Array([value]));
  }

  static initFallbackNormalMap() {
    if (Material.FALLBACK_NORMAL_MAP) return;

    const fallbackNormalMapTexture = Renderer.device.createTexture({
      size: [1, 1, 1],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });

    const fallbackNormalMapData = new Uint8Array([128, 128, 255, 255]);
    Renderer.device.queue.writeTexture(
      { texture: fallbackNormalMapTexture },
      fallbackNormalMapData,
      { bytesPerRow: 4 },
      { width: 1, height: 1, depthOrArrayLayers: 1 }
    );

    Material.FALLBACK_NORMAL_MAP = fallbackNormalMapTexture;
    Material.FALLBACK_NORMAL_MAP_SAMPLER = Renderer.device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      mipmapFilter: 'linear',
    });
  }

  static initFallbackAlbedo() {
    if (Material.FALLBACK_ALBEDO_MAP) return;

    const fallbackAlbedoMapTexture = Renderer.device.createTexture({
      size: [1, 1, 1],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });

    const fallbackAlbedoMapData = new Uint8Array([255, 255, 255, 255]);
    Renderer.device.queue.writeTexture(
      { texture: fallbackAlbedoMapTexture },
      fallbackAlbedoMapData,
      { bytesPerRow: 4 },
      { width: 1, height: 1, depthOrArrayLayers: 1 }
    );

    Material.FALLBACK_ALBEDO_MAP = fallbackAlbedoMapTexture;
    Material.FALLBACK_ALBEDO_MAP_SAMPLER = Renderer.device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      mipmapFilter: 'linear',
    });
  }

  /**
    * @param { Texture } texture
    * @param { Texture | null } normalmap
    */
  init(texture, normalmap = null) {
    this.albedo = texture;
    this.normalMap = normalmap;

    Material.initFallbackNormalMap();
    Material.initFallbackAlbedo();

    this.#initUniformBuffer();
    this.#initBindGroup();

    return this;
  }

  #initBindGroup() {
    this.bindGroup = Renderer.device.createBindGroup({
      layout: Renderer.materialBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: this.albedo.texture.createView(),
        },
        {
          binding: 1,
          resource: this.albedo.sampler,
        },
        {
          binding: 2,
          resource: this.normalMap
            ? this.normalMap.texture.createView()
            : Material.FALLBACK_NORMAL_MAP.createView(),
        },
        {
          binding: 3,
          resource: this.normalMap
            ? this.normalMap.sampler
            : Material.FALLBACK_NORMAL_MAP_SAMPLER,
        },
        {
          binding: 4,
          resource: {
            buffer: this.#uniformBuffer,
            offset: 0,
            size: 4,
          },
        },
      ]
    });
  }

  #initUniformBuffer() {
    this.#uniformBuffer = Renderer.device.createBuffer({
      size: 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    Renderer.device.queue.writeBuffer(this.#uniformBuffer, 0, new Float32Array([this.#normalScale]));
  }
}
