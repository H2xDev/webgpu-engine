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

  /** @type { GPUTextureView } */
  static FALLBACK_BLACK_TEXTURE;

  /** @type { GPUTextureView } */
  static FALLBACK_TEXTURE_NORMAL;

  /** @type { GPUSampler } */
  static FALLBACK_SAMPLER;

  /** @type { Texture } */
  albedo;

  /** @type { Texture } */
  normalMap;

  /** @type { Texture } */
  ormMap;

  /** @type { Texture } */
  emissionMap;

  /** @type { GPUBindGroup } */
  bindGroup;

  /** @type { TransparencyType } */
  transparency = TransparencyType.OPAQUE;

  /** @type { GPUBuffer } */
  #uniformBuffer;

  #normalScale = 1.0;
  #metallic = 1.0;
  #roughness = 1.0;
  #albedoTint = [1.0, 1.0, 1.0];
  #emissionTint = [0.0, 0.0, 0.0];
  #emissionEnergy = 1.0;

  get normalScale() {
    return this.#normalScale;
  }

  set normalScale(value) {
    this.#normalScale = value;
    Renderer.device.queue.writeBuffer(this.#uniformBuffer, 0, new Float32Array([value]));
  }

  get albedoTint() {
    return this.#albedoTint;
  }

  set albedoTint(value) {
    this.#albedoTint = value;
    Renderer.device.queue.writeBuffer(this.#uniformBuffer, 16, new Float32Array(value));
  }

  get metallic() {
    return this.#metallic;
  }

  set metallic(value) {
    this.#metallic = value;
    Renderer.device.queue.writeBuffer(this.#uniformBuffer, 28, new Float32Array([value]));
  }

  get roughness() {
    return this.#roughness;
  }

  set roughness(value) {
    this.#roughness = value;
    Renderer.device.queue.writeBuffer(this.#uniformBuffer, 32, new Float32Array([value]));
  }

  get emissionTint() {
    return this.#emissionTint;
  }

  set emissionTint(value) {
    this.#emissionTint = value;
    Renderer.device.queue.writeBuffer(this.#uniformBuffer, 48, new Float32Array(value));
  }

  get emissionEnergy() {
    return this.#emissionEnergy;
  }

  set emissionEnergy(value) {
    this.#emissionEnergy = value;
    Renderer.device.queue.writeBuffer(this.#uniformBuffer, 60, new Float32Array([value]));
  }

  static initFallbackTexture() {
    if (Material.FALLBACK_TEXTURE) return;

    const fallbackTexture = Renderer.device.createTexture({
      size: [1, 1, 1],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });

    const fallbackBlackTexture = Renderer.device.createTexture({
      size: [1, 1, 1],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });

    const fallbackNormalTexture = Renderer.device.createTexture({
      size: [1, 1, 1],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });

    Renderer.device.queue.writeTexture(
      { texture: fallbackTexture },
      new Uint8Array([255, 255, 255, 255]),
      { bytesPerRow: 4 },
      { width: 1, height: 1, depthOrArrayLayers: 1 }
    );

    Renderer.device.queue.writeTexture(
      { texture: fallbackNormalTexture },
      new Uint8Array([128, 128, 255, 255]),
      { bytesPerRow: 4 },
      { width: 1, height: 1, depthOrArrayLayers: 1 }
    );

    Renderer.device.queue.writeTexture(
      { texture: fallbackBlackTexture },
      new Uint8Array([0, 0, 0, 255]),
      { bytesPerRow: 4 },
      { width: 1, height: 1, depthOrArrayLayers: 1 }
    );

    Material.FALLBACK_TEXTURE = fallbackTexture.createView();
    Material.FALLBACK_TEXTURE_NORMAL = fallbackNormalTexture.createView();
    Material.FALLBACK_BLACK_TEXTURE = fallbackBlackTexture.createView();
    Material.FALLBACK_SAMPLER = Renderer.device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      mipmapFilter: 'linear',
    });
  }

  /**
    * @param { Texture } albedo
    * @param { Texture | null } normalmap
    * @param { Texture | null } ormMap
    * @param { Texture | null } emissionMap
    *
    * @returns { Material }
    */
  init(
    albedo = null,
    normalmap = null,
    ormMap = null,
    emissionMap = null,
  ) {
    this.albedo = albedo;
    this.normalMap = normalmap;
    this.ormMap = ormMap;
    this.emissionMap = emissionMap;

    Material.initFallbackTexture();

    this.initUniformBuffer();
    this.#initBindGroup();

    return this;
  }

  duplicate() {
    return Object.assign(new Material().initUniformBuffer(), {
      bindGroup: this.bindGroup,
      albedo: this.albedo,
      normalMap: this.normalMap,
      ormMap: this.ormMap,
      emissionMap: this.emissionMap,
      transparency: this.transparency,
      normalScale: this.#normalScale,
      metallic: this.#metallic,
      roughness: this.#roughness,
      albedoTint: [...this.#albedoTint],
      emissionTint: [...this.#emissionTint],
      emissionEnergy: this.#emissionEnergy,
    })
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
            : Material.FALLBACK_TEXTURE_NORMAL,
        },
        {
          binding: 3,
          resource: this.ormMap
            ? this.ormMap.texture.createView()
            : Material.FALLBACK_TEXTURE,
        },
        {
          binding: 4,
          resource: this.emissionMap
            ? this.emissionMap.texture.createView()
            : Material.FALLBACK_BLACK_TEXTURE,
        },
        {
          binding: 5,
          resource: {
            buffer: this.#uniformBuffer,
            offset: 0,
          },
        },
      ]
    });
  }

  initUniformBuffer() {
    this.#uniformBuffer = Renderer.device.createBuffer({
      size: 80,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    Renderer.device.queue.writeBuffer(this.#uniformBuffer, 0, new Float32Array([this.#normalScale]));
    Renderer.device.queue.writeBuffer(this.#uniformBuffer, 16, new Float32Array(this.#albedoTint));
    Renderer.device.queue.writeBuffer(this.#uniformBuffer, 28, new Float32Array([this.#metallic]));
    Renderer.device.queue.writeBuffer(this.#uniformBuffer, 32, new Float32Array([this.#roughness]));
    Renderer.device.queue.writeBuffer(this.#uniformBuffer, 48, new Float32Array(this.#emissionTint));
    Renderer.device.queue.writeBuffer(this.#uniformBuffer, 60, new Float32Array([this.#emissionEnergy]));

    return this;
  }
}
