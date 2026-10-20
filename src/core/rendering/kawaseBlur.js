import { ShaderManager } from "../shaderManager.js";

const MAX_PASSES = 5;

export const KawaseBlur = new class KawaseBlur {
  /** @type { Map<GPUTextureView, GPUBindGroup> } */
  bindGroupCache = new Map();

  /** @type { Map<string, GPUTextureView> } */
  internalTextureCache = new Map();

  /** @type { [number, number] } */
  size = [512, 512];

  /** @type { GPURenderPipeline } */
  pipeline;

  /** @type { GPUBindGroup } */
  bindGroup;

  /** @type { GPUDevice } */
  device;

  /** @type { GPUBuffer } */
  uniformBuffer;

  /** @type { GPUTextureView } */
  get pingTextureView() {
    return this.#getInternalTexture("ping")
  }

  /** @type { GPUTextureView } */
  get pongTextureView() {
    return this.#getInternalTexture("pong")
  }

  /** @type { GPUSampler } */
  defaultSampler;

  /** @type { GPURenderPassDescriptor } */
  renderPassDescriptor = {
    colorAttachments: [
      {
        view: null,
        loadOp: "clear",
        storeOp: "store",
        clearValue: { r: 0, g: 0, b: 0, a: 0 }
      }
    ]
  }

  /** @param { GPUDevice } device*/
  async init(device) {
    this.device = device;

    this.defaultSampler = this.device.createSampler({
      minFilter: "linear",
      magFilter: "linear",
    });

    this.uniformBuffer = this.device.createBuffer({
      label: 'Kawase blur uniform buffer',
      size: 16,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM
    });

    await this.#initPipeline();
  }

  async #initPipeline() {
    const bindGroupLayout = this.device.createBindGroupLayout({
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
          buffer: {}
        }
      ]
    });

    const fullScreenTriangleModule = await ShaderManager.createModule("src/core/shaders/fullScreenTriangle", this.device);
    const module = await ShaderManager.createModule("src/core/shaders/kawaseBlur", this.device);

    this.pipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout]
      }),
      vertex: {
        module: fullScreenTriangleModule,
        entryPoint: "vertex_main"
      },
      fragment: {
        module,
        entryPoint: "fragment_main",
        targets: [{ format: "rgba16float" }]
      }
    })
  }

  /** @param { string } postfix */
  #getInternalTexture(postfix) {
    const hash = this.size.join("_") + postfix;

    if (this.internalTextureCache.has(hash)) return this.internalTextureCache.get(hash)

    const tex = this.device.createTexture({
      size: this.size,
      format: 'rgba16float',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    })

    const view = tex.createView()
    this.internalTextureCache.set(hash, view);

    return view;
  }

  /** @param { GPUTextureView } inputTextureView */
  #getInputBindGroup(inputTextureView) {
    if (this.bindGroupCache.has(inputTextureView)) {
      return this.bindGroupCache.get(inputTextureView);
    }

    const bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: inputTextureView
        },
        {
          binding: 1,
          resource: this.defaultSampler,
        },
        {
          binding: 2,
          resource: this.uniformBuffer,
        }
      ]
    });

    this.bindGroupCache.set(inputTextureView, bindGroup);
    return bindGroup;
  }

  /**
   * @param { number } width
   * @param { number } height
   */
  setTextureSize(width, height) {
    this.size = [width, height]
  }

  /**
   * @param { GPUCommandEncoder } commandEncoder
   * @param { GPUTextureView } inoutTextureView
   */
  processTexture(commandEncoder, inoutTextureView, pass = 0) {
    const isLastPass = pass === MAX_PASSES - 1;

    const inputTexture = pass === 0
      ? inoutTextureView
      : pass % 2 === 1
        ? this.pingTextureView
        : this.pongTextureView;

    const outputTexture = isLastPass
      ? inoutTextureView
      : pass % 2 === 0
        ? this.pingTextureView
        : this.pongTextureView;

    const bindGroup = this.#getInputBindGroup(inputTexture);

    this.renderPassDescriptor.colorAttachments[0].view = isLastPass
      ? inoutTextureView
      : outputTexture;

    this.device.queue.writeBuffer(this.uniformBuffer, 0, new Uint32Array([pass]));

    const rp = commandEncoder.beginRenderPass(this.renderPassDescriptor);
    rp.setPipeline(this.pipeline);
    rp.setBindGroup(0, bindGroup)
    rp.draw(3);
    rp.end();

    if (isLastPass) return;

    return this.processTexture(commandEncoder, inoutTextureView, pass + 1)
  }
}
