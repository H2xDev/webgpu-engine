import { Renderer } from "../renderer.js";
import { Layouts } from "../rendering/layouts.js";
import { Texture } from "./texture.js";

/** @enum { number } */
export const TransparencyType = {
  OPAQUE: 0,
  TRANSPARENT: 1,
  CUTOUT: 2,
}

export class Material {
  /** @type { GPUTextureView } */
  static FALLBACK_TEXTURE;

  /** @type { GPUSampler } */
  static FALLBACK_SAMPLER;

  /** @type { Texture } */
  albedo;

  /** @type { Texture } */
  normalMap;

  /** @type { GPUBindGroup } */
  bindGroup;

  /** @type { TransparencyType } */
  transparency = TransparencyType.OPAQUE;

  /** @type { GPUBuffer } */
  #uniformBuffer;

  #normalScale = 1.0;
  #metallic = 0.0;
  #roughness = 1.0;

  get normalScale() {
    return this.#normalScale;
  }

  set normalScale(value) {
    this.#normalScale = value;
    Renderer.device.queue.writeBuffer(this.#uniformBuffer, 0, new Float32Array([value]));
  }

  static initFallbackTexture() {
    if (Material.FALLBACK_TEXTURE) return;

    const fallbackTexture = Renderer.device.createTexture({
      size: [1, 1, 1],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });

    Renderer.device.queue.writeTexture(
      { texture: fallbackTexture },
      new Uint8Array([128, 128, 255, 255]),
      { bytesPerRow: 4 },
      { width: 1, height: 1, depthOrArrayLayers: 1 }
    );

    Material.FALLBACK_TEXTURE = fallbackTexture.createView();
    Material.FALLBACK_SAMPLER = Renderer.device.createSampler({
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

    Material.initFallbackTexture();

    this.#initUniformBuffer();
    this.#initBindGroup();

    return this;
  }

  #initBindGroup() {
    this.bindGroup = Renderer.device.createBindGroup({
      layout: Layouts.materialLayout,
      entries: [
        {
          binding: 0,
          resource: this.albedo
            ? this.albedo.sampler
            : Material.FALLBACK_SAMPLER,
        },
        {
          binding: 1,
          resource: this.albedo
            ? this.albedo.texture.createView()
            : Material.FALLBACK_TEXTURE,
        },
        {
          binding: 2,
          resource: this.normalMap
            ? this.normalMap.texture.createView()
            : Material.FALLBACK_TEXTURE,
        },
        {
          binding: 3,
          resource: Material.FALLBACK_TEXTURE,
        },
        {
          binding: 4,
          resource: Material.FALLBACK_TEXTURE,
        },
        {
          binding: 5,
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
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    Renderer.device.queue.writeBuffer(this.#uniformBuffer, 0, new Float32Array([this.#normalScale]));
  }
}
