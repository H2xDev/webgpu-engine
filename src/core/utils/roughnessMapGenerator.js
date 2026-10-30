import { SAMPLE_PANORAMA_SHADER_FUNCTION } from "../shaders/snippets/samplePanorama";

const SOURCE_CODE = /* wgsl */`
  @group(0) @binding(0) var inputTexture : texture_2d<f32>;
  @group(0) @binding(1) var inputSampler: sampler;
  @group(0) @binding(2) var outputTexture : texture_storage_2d<rgba16float, write>;
  @group(0) @binding(3) var<uniform> roughness: f32;

  ${ SAMPLE_PANORAMA_SHADER_FUNCTION }

  @compute @workgroup_size(8, 8)
  fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  }
`;

export const RoughnessMapGenerator = new class RoughnessMapGenerator {
  /** @type { GPUDevice } */
  device;

  /** @type { GPUComputePipeline } */
  pipeline;

  /** @type { GPUBuffer } */
  uniformBuffer;

  /** @param { GPUDevice } device */
  init(device) {
    this.device = device;
    this.pipeline = device.createComputePipeline({
      layout: "auto",
      compute: {
        module: device.createShaderModule({ code: SOURCE_CODE }),
        entryPoint: "main",
      },
    });
  }

  /**
   * @param { GPUTexture } inputTexture
   * @returns { GPUTexture }
   */
  generate(inputTexture) {
    const outputTexture = this.device.createTexture({
      size: [inputTexture.width, inputTexture.height],
      format: "rgba16float",
      usage: 0
        | GPUTextureUsage.STORAGE_BINDING
        | GPUTextureUsage.COPY_SRC
        | GPUTextureUsage.RENDER_ATTACHMENT
        | GPUTextureUsage.TEXTURE_BINDING,
    });

    const commandEncoder = this.device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(this.pipeline);
    passEncoder.setBindGroup(0, this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: inputTexture.createView() },
        { binding: 1, resource: this.device.createSampler() },
        { binding: 2, resource: outputTexture },
        { binding: 3, resource: this.uniformBuffer },
      ],
    }));

    passEncoder.dispatchWorkgroups(inputTexture.width / 8, inputTexture.height / 8, 1);

    return outputTexture
  }
}
