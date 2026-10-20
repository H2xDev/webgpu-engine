import { ShaderManager } from "../shaderManager.js";
import { Layouts } from "./layouts.js";

export class EnvironmentRenderPass {
  /** @type { EnvironmentRenderPass } */
  static instance = null;

  /** @type { GPUBuffer } */
  uniformBuffer;

  /** @type { GPUDevice } */
  device;

  /** @type { GPUBindGroupLayout } */
  bindGroupLayout;

  /** @type { GPURenderPipeline } */
  pipeline;

  /** @type { GPUCanvasContext } */
  context;

  /** @type { GPURenderPassDescriptor } */
  renderPassDescriptor;

  /**
    * @param { GPUDevice } device
    * @param { GPUCanvasContext } context
    */
  constructor(device, context) {
    if (EnvironmentRenderPass.instance) {
      return EnvironmentRenderPass.instance;
    }

    EnvironmentRenderPass.instance = this;
    this.device = device;
    this.context = context;
  }

  async init() {
    this.#initUniformBuffer();
    this.#initRenderPassDescriptor();
    await this.#initPipeline();

    return this;
  }

  #initRenderPassDescriptor() {
    /** @type { GPURenderPassDescriptor } */
    this.renderPassDescriptor = {
      colorAttachments: [{
        view: this.context.getCurrentTexture().createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        loadOp: 'clear',
        storeOp: 'store',
      }]
    }
  }

  #initUniformBuffer() {
    this.uniformBuffer = this.device.createBuffer({
      label: 'Environment Uniform Buffer',
      size: 256,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  async #initPipeline() {
    const shaderModule = await ShaderManager.createModule('src/core/shaders/environment', this.device);

    this.pipeline = this.device.createRenderPipeline({
      label: 'Environment Render Pipeline',
      layout: this.device.createPipelineLayout({
        label: 'Environment Pipeline Layout',
        bindGroupLayouts: [Layouts.environmentLayout]
      }),
      vertex: {
        module: shaderModule,
        entryPoint: 'vertex_main',
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fragment_main',
        targets: [{ format: navigator.gpu.getPreferredCanvasFormat() }]
      },
      primitive: {
        topology: 'triangle-strip',
        cullMode: 'back',
      }
    });
  }

  updateViewTexture() {
    this.renderPassDescriptor.colorAttachments[0].view = this.context.getCurrentTexture().createView();
  }
}
