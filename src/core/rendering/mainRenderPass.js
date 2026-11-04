import { DEPTH_CLEAR, DEPTH_COMPARE, DEPTH_FORMAT, REVERSED_Z, OBJECT_SIZE } from "../convention.js";

import { Renderer } from "../renderer.js";
import { Camera3D } from "../nodes/camera.js";
import { DirectionalLight } from "../nodes/directionalLight.js";
import { Environment } from "../nodes/environment.js";
import { ShaderManager } from "../shaderManager.js";
import { Layouts } from "./layouts.js";
import { RenderPass } from "./renderPass.abstract.js";
import { ShadowRenderPass } from "./shadowRenderPass.js";

export class MainRenderPass extends RenderPass {
  /** @type { MainRenderPass } */
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

  /** @type { GPUBindGroup } used when no Environment node is active */
  fallbackEnvironmentBindGroup = null;

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
    this.#initSceneTexture();
    this.#initDepthTexture();
    this.#initRenderPassDescriptor();
    this.#initBuffer();
    this.#initFallbackEnvironment();
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
            size: OBJECT_SIZE,
          }
        },
      ],
    });
  }

  updateViewTexture() {
    //this.renderPassDescriptor.colorAttachments[0].view = this.context.getCurrentTexture().createView();
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

    if (Camera3D.current) {
      Camera3D.current.writeToBuffer(Renderer.device, this.uniformBuffer);
    }

    if (DirectionalLight.current) {
      DirectionalLight.current.writeLightDataToBuffer(this.uniformBuffer, 64 * 3);
    }

    rp.setPipeline(this.pipeline);
    rp.setBindGroup(2, ShadowRenderPass.instance.shadowMapBindGroup);
    rp.setBindGroup(3, Environment.current?.bindGroup ?? this.fallbackEnvironmentBindGroup);

    renderCallback(rp, this.renderBindGroup);
    rp.end();
  }

  #initSceneTexture() {
    const { device, context } = this;
    const { width, height } = context.canvas;

    this.sceneTexture = device.createTexture({
      size: [width, height, 1],
      format: "rgba16float",
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });

    this.sceneTextureView = this.sceneTexture.createView();

    window.addEventListener("resize", () => {
      this.sceneTexture.destroy();
      this.sceneTexture = device.createTexture({
        size: [window.innerWidth, window.innerHeight, 1],
        format: "rgba16float",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      });
      this.sceneTextureView = this.sceneTexture.createView();

      this.renderPassDescriptor.colorAttachments[0].view = this.sceneTextureView;
    });
  }

  #initBuffer() {
    this.uniformBuffer = this.device.createBuffer({
      size: 64 * 6, // 6 matrices of 4x4 floats (16 floats * 4 bytes each)
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      label: 'RenderData struct uniform'
    });
  }

  #initFallbackEnvironment() {
    const { device } = this;

    const texture = device.createTexture({
      size: [1, 1, 1],
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING,
    });

    const uniformBuffer = device.createBuffer({
      label: 'Fallback Environment Uniform Buffer',
      size: 256,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.fallbackEnvironmentBindGroup = device.createBindGroup({
      label: 'Fallback Environment Bind Group',
      layout: Layouts.environmentLayout,
      entries: [
        { binding: 0, resource: texture.createView() },
        { binding: 1, resource: device.createSampler() },
        { binding: 2, resource: texture.createView() },
        { binding: 3, resource: { buffer: uniformBuffer } },
      ],
    });
  }

  #initRenderPassDescriptor() {
    this.renderPassDescriptor = {
      label: "Main Render Pass",
      colorAttachments: [{
        view: this.sceneTextureView,
        clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
        loadOp: "load",
        storeOp: "store",
      }],
      depthStencilAttachment: {
        view: this.depthTextureView,
        depthClearValue: DEPTH_CLEAR,
        depthLoadOp: "clear",
        depthStoreOp: "store",
      },
    };
  }

  #initDepthTexture() {
    const { device, context } = this;
    const { width, height } = context.canvas;

    this.depthTexture = device.createTexture({
      size: [width, height, 1],
      format: DEPTH_FORMAT,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });

    this.depthTextureView = this.depthTexture.createView();

    window.addEventListener("resize", () => {
      this.depthTexture.destroy();
      this.depthTexture = device.createTexture({
        size: [window.innerWidth, window.innerHeight, 1],
        format: DEPTH_FORMAT,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
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
        targets: [{ format: "rgba16float" }],
        constants: {
          REVERSED_Z: Number(REVERSED_Z),
        },
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "back",
      },
      depthStencil: {
        format: DEPTH_FORMAT,
        depthWriteEnabled: true,
        depthCompare: DEPTH_COMPARE,
      },
    })
  }
}
