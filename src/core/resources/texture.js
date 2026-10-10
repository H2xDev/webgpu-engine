import { Renderer } from "../renderer.js";

export class Texture {
  /** @type { GPUTexture } */
  texture;

  /** @type { GPUSampler } */
  sampler;

  /** @param { HTMLImageElement } image */
  init(image) {
    Renderer.device.queue.copyExternalImageToTexture(
      { source: image },
      { texture: this.#createTexture(image.width, image.height) },
      [image.width, image.height]
    );

    return this;
  }

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

  /** @param { string } url */
  static async load(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(new Texture().init(image));
      image.onerror = () => reject(new Error(`Failed to load texture "${url}"`));
      image.src = url;
    });
  }
}

