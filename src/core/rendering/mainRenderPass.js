import { ShaderManager } from "../shaderManager.js";
import { Layouts } from "./layouts.js";

export class MainRenderPass {
  static instance = null;

  /** @type { Omit<GPUVertexState, 'module'> } */
  static vertexState = {
    buffers: [
      {
        // position, normal, uv per vertex
        arrayStride: 32,
        attributes: [
          {
            shaderLocation: 0,
            format: 'float32x3',
            offset: 0,
          },
          {
            shaderLocation: 1,
            format: 'float32x3',
            offset: 12,
          },
          {
            shaderLocation: 2,
            format: 'float32x2',
            offset: 24,
          }
        ]
      }
    ]
  }

  /** @type { GPUBuffer } */
  uniformBuffer

  /** @type { GPURenderPassDescriptor } */
  renderPassDescriptor;

  /** @type { GPUTexture } */
  depthTexture;

  /** @type { GPUTextureView } */
  depthTextureView;

  /** @type { GPUDevice } */
  device;

  /** @type { GPUCanvasContext } */
  context;

  /** @type { GPURenderPipeline } */
  pipeline;

  /**
   * @type { GPUBindGroupLayout }
   */
  shaderBindGroupLayout = null;

  /** @type { GPUBindGroupLayout } */
  static materialBindGroupLayout;

  /** @type { GPUBindGroup } */
  shaderBindGroup = null;

  /**
    * @param { GPUDevice } device
    * @param { GPUCanvasContext } context
    */
  constructor(device, context) {
    if (MainRenderPass.instance) {
      return MainRenderPass.instance;
    }

    this.device = device;
    this.context = context;

    MainRenderPass.instance = this;
  }

  async init() {
    this.#initDepthTexture();
    this.#initRenderPassDescriptor();
    this.#initBuffer();
    await this.#initPipeline();

    return this;
  }

  updateViewTexture() {
    this.renderPassDescriptor.colorAttachments[0].view = this.context.getCurrentTexture().createView();
  }

  #initBuffer() {
    this.uniformBuffer = this.device.createBuffer({
      size: 64 * 6, // 6 matrices of 4x4 floats (16 floats * 4 bytes each)
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      label: 'RenderData struct uniform'
    });
  }

  #initRenderPassDescriptor() {
    const { context } = this;

    this.renderPassDescriptor = {
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
        loadOp: "load",
        storeOp: "store",
      }],
      depthStencilAttachment: {
        view: this.depthTextureView,
        depthClearValue: 1.0,
        depthLoadOp: "clear",
        depthStoreOp: "discard",
      },
    };
  }

  #initDepthTexture() {
    const { device, context } = this;
    const { width, height } = context.canvas;

    this.depthTexture = device.createTexture({
      size: [width, height, 1],
      format: "depth24plus",
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    this.depthTextureView = this.depthTexture.createView();

    window.addEventListener("resize", () => {
      this.depthTexture.destroy();
      this.depthTexture = device.createTexture({
        size: [window.innerWidth, window.innerHeight, 1],
        format: "depth24plus",
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
      this.depthTextureView = this.depthTexture.createView();
      this.renderPassDescriptor.depthStencilAttachment.view = this.depthTextureView;
    });
  }

  /**
   *
   * @param { GPUTextureView } shadowTextureView
   * @param { GPUSampler } shadowSampler
   */
  initShadowBindGroup(shadowTextureView, shadowSampler) {
    this.shadowBindGroup = this.device.createBindGroup({
      layout: Layouts.shadowMapLayout,
      entries: [
        {
          binding: 0,
          resource: shadowTextureView,
        },
        {
          binding: 1,
          resource: shadowSampler,
        }
      ],
    })

    return this;
  }

  async #initPipeline() {
    const { device } = this;

    const shaderModule = await ShaderManager.createModule("core/shaders/main", device);

    this.pipeline = device.createRenderPipeline({
      label: "Main Render Pipeline",
      layout: device.createPipelineLayout({
        label: "Main Render Pipeline Layout",
        bindGroupLayouts: [
          Layouts.geometryLayout,
          Layouts.materialLayout,
          Layouts.shadowMapLayout,
          Layouts.environmentLayout
        ]
      }),
      vertex: Object.assign(MainRenderPass.vertexState, {
        module: shaderModule,
      }),
      fragment: {
        module: shaderModule,
        entryPoint: "fragment_main",
        targets: [{ format: navigator.gpu.getPreferredCanvasFormat() }]
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "back",
      },
      depthStencil: {
        format: "depth24plus",
        depthWriteEnabled: true,
        depthCompare: "less",
      },
    })
  }
}
