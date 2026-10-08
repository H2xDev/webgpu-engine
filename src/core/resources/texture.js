import { Renderer } from "../renderer.js";

export class Texture {
  /** @type { GPUTexture } */
  texture;

  /** @type { GPUSampler } */
  sampler;

  /** @param { HTMLImageElement } image */
  init(image) {
    this.texture = Renderer.device.createTexture({
      size: [image.width, image.height, 1],
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });

    Renderer.device.queue.copyExternalImageToTexture(
      { source: image },
      { texture: this.texture },
      [image.width, image.height]
    );

    this.sampler = Renderer.device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
      addressModeU: "repeat",
      addressModeV: "repeat",
      mipmapFilter: "linear",
    });

    Renderer.device.queue.copyExternalImageToTexture(
      { source: image },
      { texture: this.texture },
      [image.width, image.height]
    );

    return this;
  }

  /** @param { string } url */
  static load(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.src = url;
      image.onload = () => resolve(new Texture().init(image));
      image.onerror = reject;
    });
  }
}
