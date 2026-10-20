import { Renderer } from "../renderer.js";

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
    Renderer.device.queue.copyExternalImageToTexture(
      { source: image },
      { texture: this.#createTexture(image.width, image.height) },
      [image.width, image.height]
    );

    return this;
  }

  /**
    * @param { number } width
    * @param { number } height
    */
  #createTexture(width, height) {
    this.texture = Renderer.device.createTexture({
      size: [width, height, 1],
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.sampler = Renderer.device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
      addressModeU: "repeat",
      addressModeV: "repeat",
      mipmapFilter: "linear",
    });
    return this.texture;
  }

  #generateMipmaps(image) {
    // TODO: Implement mipmap generation
  }

  /** @param { string } url */
  static async load(url) {
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
}
