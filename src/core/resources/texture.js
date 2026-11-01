import { MipmapGenerator } from "../utils/mipmapGenerator.js";
import { decodeExr } from "../utils/exrDecoder.js";

export class Texture {
  /** @type { GPUDevice } */
  static device;

  /** @type { GPUTexture } */
  texture;

  /** @type { GPUSampler } */
  sampler;

  /** @type { GPUTextureView } */
  #view;

  /**
    * @param { HTMLImageElement } image
    */
  init(image) {
    this.texture = MipmapGenerator.generateMipmaps(image);
    this.sampler = Texture.device.createSampler({
      minFilter: "linear",
      magFilter: "linear",
      mipmapFilter: "linear",
      addressModeU: "repeat",
      addressModeV: "repeat",
    })

    return this;
  }

  get view() {
    if (!this.#view) {
      this.#view = this.texture.createView();
    }
    return this.#view;
  }

  /**
    * Initializes the texture from half-float RGBA pixel data (e.g. decoded EXR).
    * @param { Uint16Array } data
    * @param { number } width
    * @param { number } height
    */
  initHalfFloat(data, width, height) {
    MipmapGenerator.init(Texture.device);
    this.texture = MipmapGenerator.generateMipmapsFromHalfFloat(data, width, height);
    this.sampler = Texture.device.createSampler({
      minFilter: "linear",
      magFilter: "linear",
      mipmapFilter: "linear",
      addressModeU: "repeat",
      addressModeV: "clamp-to-edge",
    });

    return this;
  }

  /** @type { GPUTextureView } */
  static WHITE_TEXTURE = null;

  /** @type { GPUTextureView } */
  static BLACK_TEXTURE = null;

  /** @type { GPUTextureView } */
  static NORMAL_TEXTURE = null;

  /** @type { GPUSampler } */
  static DEFAULT_SAMPLER = null;

  /**
    * Initializes fallback textures and a default sampler for use when a texture is missing or fails to load.
    *
    * @param { GPUDevice } device
    */
  static init(device) {
    Texture.device = device;

    const fallbackWhiteTexture = device.createTexture({
      size: [1, 1, 1],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });

    const fallbackBlackTexture = device.createTexture({
      size: [1, 1, 1],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });

    const fallbackNormalTexture = device.createTexture({
      size: [1, 1, 1],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });

    device.queue.writeTexture(
      { texture: fallbackWhiteTexture },
      new Uint8Array([255, 255, 255, 255]),
      { bytesPerRow: 4 },
      { width: 1, height: 1, depthOrArrayLayers: 1 }
    );

    device.queue.writeTexture(
      { texture: fallbackNormalTexture },
      new Uint8Array([128, 128, 255, 255]),
      { bytesPerRow: 4 },
      { width: 1, height: 1, depthOrArrayLayers: 1 }
    );

    device.queue.writeTexture(
      { texture: fallbackBlackTexture },
      new Uint8Array([0, 0, 0, 255]),
      { bytesPerRow: 4 },
      { width: 1, height: 1, depthOrArrayLayers: 1 }
    );

    Texture.WHITE_TEXTURE = fallbackWhiteTexture.createView();
    Texture.BLACK_TEXTURE = fallbackBlackTexture.createView();
    Texture.NORMAL_TEXTURE = fallbackNormalTexture.createView();
    Texture.DEFAULT_SAMPLER = device.createSampler({
      minFilter: "linear",
      magFilter: "linear",
      mipmapFilter: "linear",
      addressModeU: "repeat",
      addressModeV: "repeat",
    });
  }

  /** @param { string } url */
  static async load(url) {
    if (/\.exr(\?.*)?$/i.test(url)) return Texture.#loadExr(url);

    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(new Texture().init(image));
      image.onerror = (err) => {
        console.error(err)
        reject(new Error(`Failed to load texture "${url}"`));
      };
      image.src = url;
    });
  }

  /** @param { string } url */
  static async #loadExr(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load EXR "${url}": ${response.status} ${response.statusText}`);
    }

    const { width, height, data } = await decodeExr(await response.arrayBuffer());
    return new Texture().initHalfFloat(data, width, height);
  }
}
