import { Renderer } from "../renderer.js";
import { MipmapGenerator } from "../utils/mipmapGenerator.js";
import { decodeExr } from "../utils/exrDecoder.js";

export class Texture {
  /** @type { GPUTexture } */
  texture;

  /** @type { GPUSampler } */
  sampler;

  /**
    * @param { HTMLImageElement } image
    * @param { boolean } generateMipmaps
    */
  init(image, generateMipmaps = false) {
    // Renderer.device.queue.copyExternalImageToTexture(
    //   { source: image },
    //   { texture: this.#createTexture(image.width, image.height) },
    //   [image.width, image.height]
    // );

    MipmapGenerator.init(Renderer.device);
    this.texture = MipmapGenerator.generateMipmaps(image);
    this.sampler = Renderer.device.createSampler({
      minFilter: "linear",
      magFilter: "linear",
      mipmapFilter: "linear",
      addressModeU: "repeat",
      addressModeV: "repeat",
    })

    return this;
  }

  /**
    * Initializes the texture from half-float RGBA pixel data (e.g. decoded EXR).
    * @param { Uint16Array } data
    * @param { number } width
    * @param { number } height
    */
  initHalfFloat(data, width, height) {
    MipmapGenerator.init(Renderer.device);
    this.texture = MipmapGenerator.generateMipmapsFromHalfFloat(data, width, height);
    this.sampler = Renderer.device.createSampler({
      minFilter: "linear",
      magFilter: "linear",
      mipmapFilter: "linear",
      addressModeU: "repeat",
      addressModeV: "clamp-to-edge",
    });

    return this;
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
