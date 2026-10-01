export class Material {
  /** @type { GPUTexture } */
  texture

  /** @type { GPUTextureView } */
  view

  /** @type { GPUSampler } */
  sampler

  /** @type { GPUDevice } */
  device

  /**
    * @param { GPUDevice } device
    * @param { string } url
    */
  async init(device, url) {
    const blob = await fetch(url).then(t => t.blob())
    const source = await createImageBitmap(blob);

    const size = {
      width: source.width,
      height: source.height,
    };

    const texture = device.createTexture({
      size,
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    })

    device.queue.copyExternalImageToTexture(
      { source },
      { texture },
      size,
    );

    this.view = texture.createView({
      format: "rgba8unorm",
      dimension: "2d",
      aspect: "all",
      baseMipLevel: 0,
      mipLevelCount: 1,
      baseArrayLayer: 0,
      arrayLayerCount: 1,
    });

    this.sampler = device.createSampler({
      addressModeU: "repeat",
      addressModeV: "repeat",
      magFilter: "linear",
      minFilter: "nearest",
      mipmapFilter: "nearest",
      maxAnisotropy: 1,
    })

    return this;
  }
}
