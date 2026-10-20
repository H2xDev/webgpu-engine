export const Layouts = new class Layouts {
  #geometryLayout = {
    label: 'Geometry Layout',
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: {},
      },
      {
        binding: 1,
        visibility: GPUShaderStage.VERTEX,
        buffer: {
          type: "read-only-storage",
          hasDynamicOffset: true,
        },
      }
    ]
  };

  #materialLayout = {
    label: 'Material Layout',
    entries: [
      { // Albedo texture
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        texture: {},
      },
      { // Albedo sampler
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: {},
      },
      { // Normal map texture
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        texture: {},
      },
      { // Normal map sampler
        binding: 3,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: {},
      },
      { // Material properties
        binding: 4,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: {},
      },
    ]
  };

  #shadowMapLayout = {
    label: 'Shadow Map Layout',
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        texture: {
          sampleType: "depth",
        },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: {
          type: "comparison",
        },
      }
    ],
  }

  #environmentLayout = {
    label: 'Environment Layout',
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        texture: {}
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: {}
      },
      {
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: {
          type: 'uniform',
        }
      }
    ]
  }

  /** @type { GPUBindGroupLayout } */
  postProcessLayout;

  /** @type { GPUBindGroupLayout } */
  materialLayout;

  /** @type { GPUBindGroupLayout } */
  geometryLayout;

  /** @type { GPUBindGroupLayout } */
  shadowMapLayout;

  /** @type { GPUBindGroupLayout } */
  environmentLayout;

  /**
   * @param { GPUDevice } device
   */
  init(device) {
    this.geometryLayout = device.createBindGroupLayout(this.#geometryLayout)
    this.materialLayout = device.createBindGroupLayout(this.#materialLayout)
    this.shadowMapLayout = device.createBindGroupLayout(this.#shadowMapLayout)
    this.environmentLayout = device.createBindGroupLayout(this.#environmentLayout)
  }
}
