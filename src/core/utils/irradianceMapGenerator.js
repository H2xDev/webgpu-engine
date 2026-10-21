const SOURCE_CODE = /* wgsl */`
  @group(0) @binding(0) var inputTexture : texture_2d<f32>;
  @group(0) @binding(1) var inputSampler: sampler;
  @group(0) @binding(2) var outputTexture : texture_storage_2d<rgba16float, write>;

  const PI = 3.14159265358979323846;

  fn samplePanorama(direction: vec3<f32>) -> vec4<f32> {
    let u = atan2(direction.z, direction.x) / (2.0 * PI) + 0.5;
    let v = acos(clamp(direction.y, -1.0, 1.0)) / PI;

    return textureSampleLevel(inputTexture, inputSampler, vec2<f32>(u, v), 0.0);
  }

  fn getDirection(uv: vec2<f32>) -> vec3<f32> {
      let theta = (uv.x - 0.5) * 2.0 * PI;
      let phi = uv.y * PI;

      return vec3<f32>(
          sin(phi) * cos(theta),
          cos(phi),
          sin(phi) * sin(theta)
      );
  }

  fn getNormalBasis(N: vec3<f32>) -> mat3x3<f32> {
    var up = vec3<f32>(0.0, 1.0, 0.0);

    if (abs(N.y) > 0.999) {
      up = vec3<f32>(1.0, 0.0, 0.0);
    }

    let T = normalize(cross(up, N));
    let B = cross(N, T);

    return mat3x3<f32>(T, B, N);
  }

  @compute @workgroup_size(8, 8)
  fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let size = textureDimensions(outputTexture);

    if (id.x >= size.x || id.y >= size.y) {
        return;
    }

    let uv: vec2<f32> = (vec2<f32>(id.xy) + 0.5) / vec2<f32>(size);
    let normal: vec3<f32> = getDirection(uv);
    let tbn: mat3x3<f32> = getNormalBasis(normal);

    var irradiance: vec3<f32> = vec3<f32>(0.0);
    var sampleCount: f32 = 0.0;
    let sampleDelta: f32 = PI / 64.0;

    for (var phi: f32 = 0.0; phi < 2.0 * PI; phi += sampleDelta) {
      for (var theta: f32 = 0.0; theta < 0.5 * PI; theta += sampleDelta) {
        let x = sin(theta) * cos(phi);
        let y = cos(theta);
        let z = sin(theta) * sin(phi);

        let sampleDir: vec3<f32> = normalize(tbn * vec3<f32>(x, z, y));
        irradiance += samplePanorama(sampleDir).xyz * cos(theta) * sin(theta) * sampleDelta * sampleDelta;
      }
    }

    textureStore(outputTexture, vec2<i32>(id.xy), vec4<f32>(irradiance, 1.0));
  }
`;

export const IrradianceMapGenerator = new class IrradianceMapGenerator {
  /** @type { GPUDevice } */
  device;

  /** @type { GPUComputePipeline } */
  pipeline;

  /** @param { GPUDevice } device */
  init(device) {
    this.device = device;

    this.pipeline = device.createComputePipeline({
      layout: 'auto',
      compute: {
        module: device.createShaderModule({
          code: SOURCE_CODE,
        }),
        entryPoint: 'main',
      }
    })
  }

  /**
   * @param { GPUTextureView } inputTexture
   * @returns { GPUTexture }
   */
  generate(inputTexture) {
    const outputTexture = this.device.createTexture({
      size: [64, 32],
      format: 'rgba16float',
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    })

    const commandEncoder = this.device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(this.pipeline);
    passEncoder.setBindGroup(0, this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: inputTexture },
        { binding: 1, resource: this.device.createSampler() },
        { binding: 2, resource: outputTexture.createView() },
      ],
    }));
    passEncoder.dispatchWorkgroups(Math.ceil(outputTexture.width / 8), Math.ceil(outputTexture.height / 8));
    passEncoder.end();

    this.device.queue.submit([ commandEncoder.finish() ])

    return outputTexture;
  }
}
