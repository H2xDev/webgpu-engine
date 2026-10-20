import { DirectionalLight } from "../nodes/directionalLight.js";
import { ShaderManager } from "../shaderManager.js";
import { Layouts } from "./layouts.js";
import { MainRenderPass } from "./mainRenderPass.js";
import { RenderPass } from "./renderPass.abstract.js";

export class ShadowRenderPass extends RenderPass {
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
  objectBuffer;

  /** @type { GPUBindGroup } */
  renderBindGroup;

  /** @type { GPUBuffer } */
  uniformBuffer

  /** @type { GPUBindGroup } */
  shadowMapBindGroup

  /** @type { GPUTexture } */
  depthTexture

  /** @type { GPUTextureView } */
  depthTextureView

  /** @type { GPUSampler } */
  depthTextureSampler;

  /** @type { GPURenderPipeline } */
  pipeline

  /** @type { GPUBindGroupLayout } */
  geometryBindGroupLayout = null

  /**
   * @param { GPUDevice } device
   * @param { GPUCanvasContext } context
   */
  constructor(device, context) {
    if (ShadowRenderPass.instance) {
      return ShadowRenderPass.instance;
    }

    super(device, context);

    ShadowRenderPass.instance = this;
  }

  async init() {
    this.#initDepthTexture();
    this.#initBuffer();
    this.#initBindGroup();
    await this.#initPipeline();

    return this;
  }

  /** @param { GPUBuffer } objectBuffer */
  assignObjectBuffer(objectBuffer) {
    this.renderBindGroup = this.device.createBindGroup({
      layout: Layouts.geometryLayout,
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this.uniformBuffer,
          }
        },
        {
          binding: 1,
          resource: {
            buffer: objectBuffer,
            offset: 0,
            size: 64,
          }
        },
      ],
    });
  }

  /**
    * @param { GPUCommandEncoder } commandEncoder
    * @param { (passEncoder: GPURenderPassEncoder, bg: GPUBindGroup) => void } renderCallback
    */
  encode(commandEncoder, renderCallback) {
    if (!DirectionalLight.current) {
      console.warn("No directional light found. Skipping shadow pass.");
      return;
    }

    const shadowPass = commandEncoder.beginRenderPass(this.renderPassDescriptor);
    DirectionalLight.current.writeToBuffer(this.uniformBuffer);

    shadowPass.setPipeline(this.pipeline);
    renderCallback(shadowPass, this.renderBindGroup);
    shadowPass.end();
  }

  #initBuffer() {
    this.uniformBuffer = this.device.createBuffer({
      size: 64 * 6,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      label: 'ShadowRenderPass Uniform Buffer'
    });
  }

  #initBindGroup() {
    this.shadowMapBindGroup = this.device.createBindGroup({
      layout: Layouts.shadowMapLayout,
      entries: [
        {
          binding: 0,
          resource: this.depthTextureView,
        },
        {
          binding: 1,
          resource: this.depthTextureSampler,
        }
      ]
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
