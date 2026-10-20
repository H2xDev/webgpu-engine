import { Camera3D } from "../nodes/camera.js";
import { DirectionalLight } from "../nodes/directionalLight.js";
import { Environment } from "../nodes/environment.js";
import { ShaderManager } from "../shaderManager.js";
import { Layouts } from "./layouts.js";
import { RenderPass } from "./renderPass.abstract.js";
import { ShadowRenderPass } from "./shadowRenderPass.js";

export class MainRenderPass extends RenderPass {
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

  /** @type { GPUTexture } */
  sceneTexture;

  /** @type { GPUTextureView } */
  sceneTextureView;

  /**
   * @type { GPUBindGroupLayout }
   */
  shaderBindGroupLayout = null;

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

    super(device, context);

    this.device = device;
    this.context = context;

    MainRenderPass.instance = this;
  }

  async init() {
    this.#initDepthTexture();
    this.#initRenderPassDescriptor();
    this.#initBuffer();
    this.#initSceneTexture();
    await this.#initPipeline();

    return super.init();
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

  updateViewTexture() {
    this.renderPassDescriptor.colorAttachments[0].view = this.context.getCurrentTexture().createView();
  }

  /**
    * @param { GPUCommandEncoder } commandEncoder
    * @param { (rp: GPURenderPassEncoder, bg: GPUBindGroup) => void } renderCallback
    */
  encode(commandEncoder, renderCallback) {
    if (!ShadowRenderPass.instance) {
      console.warn("ShadowRenderPass instance is not initialized. Skipping main render pass.");
      return;
    }

    this.updateViewTexture();

    /** @type { GPURenderPassEncoder } */
    const rp = commandEncoder.beginRenderPass(this.renderPassDescriptor);

    Camera3D.current.writeToBuffer(this.uniformBuffer);

    if (DirectionalLight.current) {
      DirectionalLight.current.writeLightDataToBuffer(this.uniformBuffer, 64 * 3);
    }

    rp.setPipeline(this.pipeline);
    rp.setBindGroup(2, ShadowRenderPass.instance.shadowMapBindGroup);

    if (Environment.current) {
      rp.setBindGroup(3, Environment.current.bindGroup);
    }

    renderCallback(rp, this.renderBindGroup);
    rp.end();
  }

  #initSceneTexture() {
    const { device, context } = this;
    const { width, height } = context.canvas;

    this.sceneTexture = device.createTexture({
      size: [width, height, 1],
      format: navigator.gpu.getPreferredCanvasFormat(),
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });

    this.sceneTextureView = this.sceneTexture.createView();

    window.addEventListener("resize", () => {
      this.sceneTexture.destroy();
      this.sceneTexture = device.createTexture({
        size: [window.innerWidth, window.innerHeight, 1],
        format: navigator.gpu.getPreferredCanvasFormat(),
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      });
      this.sceneTextureView = this.sceneTexture.createView();
    });
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

  async #initPipeline() {
    const { device } = this;

    const shaderModule = await ShaderManager.createModule("src/core/shaders/main", device);

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
