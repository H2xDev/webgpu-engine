import { ShaderManager } from "../shaderManager.js";
import { Layouts } from "./layouts.js";
import { MainRenderPass } from "./mainRenderPass.js";

export class ShadowRenderPass {
  static instance = null;

  /** @type { GPURenderPassDescriptor } */
  renderPassDescriptor = {
    colorAttachments: [],
    depthStencilAttachment: {
      view: null,
      depthClearValue: 1.0,
      depthLoadOp: "clear",
      depthStoreOp: "store",
    },
  }

  /** @type { GPUBuffer } */
  uniformBuffer

  /** @type { GPUBindGroupLayout } */
  bindGroupLayout

  /** @type { GPUBindGroup } */
  bindGroup

  /** @type { GPUTexture } */
  depthTexture

  /** @type { GPUTextureView } */
  depthTextureView

  /** @type { GPUSampler } */
  depthTextureSampler;

  /** @type { GPUDevice } */
  device

  /** @type { GPURenderPipeline } */
  pipeline

  /** @type { GPUBindGroupLayout } */
  geometryBindGroupLayout = null

  /**
   * @param { GPUDevice } device
   */
  constructor(device) {
    if (ShadowRenderPass.instance) {
      return ShadowRenderPass.instance;
    }

    ShadowRenderPass.instance = this;

    this.device = device;
  }

  async init() {
    this.#initDepthTexture();
    this.#initBuffer();
    await this.#initPipeline();

    return this;
  }

  #initBuffer() {
    this.uniformBuffer = this.device.createBuffer({
      size: 64 * 6,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      label: 'ShadowRenderPass Uniform Buffer'
    });
  }

  #initDepthTexture() {
    this.depthTexture = this.device.createTexture({
      size: [4096, 4096, 1],
      format: "depth32float",
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });

    this.depthTextureView = this.depthTexture.createView();
    this.renderPassDescriptor.depthStencilAttachment.view = this.depthTextureView;
    this.depthTextureSampler = this.device.createSampler({
      compare: "less",
    });
  }

  async #initPipeline() {
    const shaderModule = await ShaderManager.createModule("src/core/shaders/main", this.device);

    this.pipeline = this.device.createRenderPipeline({
      label: "ShadowRenderPass Pipeline",
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [
          Layouts.geometryLayout,
        ],
      }),
      vertex: Object.assign(MainRenderPass.vertexState, {
        module: shaderModule,
      }),
      primitive: {
        topology: "triangle-list",
        cullMode: "back",
      },
      depthStencil: {
        format: "depth32float",
        depthWriteEnabled: true,
        depthCompare: "less",
      },
    });
  }
}
