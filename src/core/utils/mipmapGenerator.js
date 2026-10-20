const SOURCE_CODE = /* wgsl */`
  @group(0) @binding(0) var inputTexture : texture_2d<f32>;
  @group(0) @binding(1) var outputTexture : texture_storage_2d<rgba8unorm, write>;

  @compute @workgroup_size(8, 8)
  fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
      let outputSize = textureDimensions(outputTexture);

      if (global_id.x >= outputSize.x || global_id.y >= outputSize.y) {
          return;
      }

      let inputSize = textureDimensions(inputTexture, 0);
      let coord = vec2<i32>(global_id.xy * 2u);
      let maxCoord = vec2<i32>(inputSize) - vec2<i32>(1, 1);

      let c0 = textureLoad(inputTexture, min(coord, maxCoord), 0);
      let c1 = textureLoad(inputTexture, min(coord + vec2<i32>(1, 0), maxCoord), 0);
      let c2 = textureLoad(inputTexture, min(coord + vec2<i32>(0, 1), maxCoord), 0);
      let c3 = textureLoad(inputTexture, min(coord + vec2<i32>(1, 1), maxCoord), 0);

      let color = (c0 + c1 + c2 + c3) * 0.25;

      textureStore(outputTexture, vec2<i32>(global_id.xy), color);
  }
`;

export const MipmapGenerator  = new class MipmapGenerator {
  /** @type { GPUPipeline } */
  pipeline;

  /** @type { GPUDevice } */
  device;


  /** @param { GPUDevice } device */
  init(device) {
    if (this.pipeline) return;

    this.device = device;
    this.pipeline = device.createComputePipeline({
      layout: 'auto',
      compute: {
        module: device.createShaderModule({
          code: SOURCE_CODE,
        }),
        entryPoint: 'main',
      },
    })
  }

  /**
   * Generates mipmaps for a given texture source.
   *
   * @param { HTMLImageElement } source
   * @returns { GPUTexture }
   */
  generateMipmaps(source) {
    const mipLevelCount = Math.floor(Math.log2(Math.max(source.width, source.height))) + 1;

    const outputTexture = this.device.createTexture({
      size: [source.width, source.height, 1],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
      mipLevelCount,
    });

    this.device.queue.copyExternalImageToTexture({ source }, { texture: outputTexture }, [source.width, source.height])

    this.generate(outputTexture, mipLevelCount - 1)

    return outputTexture;
  }

  /**
   *
   * @param { GPUTexture } inputTexture
   * @param { number } maxMipLevel
   * @param { number } mipLevel
   * @param { GPUCommandEncoder } commandEncoder
   */
  generate(inputTexture, maxMipLevel, mipLevel = 0, commandEncoder = this.device.createCommandEncoder()) {
    const inputTextureView = inputTexture.createView({
      dimension: '2d',
      baseMipLevel: mipLevel,
      mipLevelCount: 1,
    });

    const outputTextureView = inputTexture.createView({
      dimension: '2d',
      baseMipLevel: mipLevel + 1,
      mipLevelCount: 1,
    });

    const bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: inputTextureView,
        },
        {
          binding: 1,
          resource: outputTextureView,
        },
      ],
    });

    const width = Math.max(1, inputTexture.width >> (mipLevel + 1));
    const height = Math.max(1, inputTexture.height >> (mipLevel + 1));

    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(this.pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8));
    passEncoder.end();

    const isLastMipLevel = mipLevel + 1 === maxMipLevel;
    if (!isLastMipLevel) {
      this.generate(inputTexture, maxMipLevel, mipLevel + 1, commandEncoder);
    } else {
      this.device.queue.submit([commandEncoder.finish()]);
    }
  }
}
