import { REVERSED_Z } from "../convention.js";

import { ShaderManager } from "../shaderManager.js";
import { Layouts } from "./layouts.js";
import { MainRenderPass } from "./mainRenderPass.js";
import { RenderPass } from "./renderPass.abstract.js";
import { GlowPass } from './glowPass.js';
import { Texture } from "@core/resources";
import { Camera3D, PostProcess } from "@core/nodes";

export class PostProcessPass extends RenderPass {
  /** @type { PostProcessPass } */
  static instance = null;

  /** @type { GPUBindGroup } */
  bindGroup;

  /** @type { GPURenderPassDescriptor } */
  renderPassDescriptor = {
    colorAttachments: [{
      /** @type { GPUTextureView } */
      view: null,
      clearValue: { r: 0, g: 0, b: 0, a: 1 },
      loadOp: 'load',
      storeOp: 'store',
    }]
  }

  /** @type { GPURenderPipeline } */
  glowPipeline;

  /** @type { GPUBindGroup } */
  glowBindGroup;

  /** @type { GPUBuffer } */
  fallbackPostProcessUniformBuffer;

  /** @type { GPUBuffer } */
  #currentUniformBuffer = null;

  get currentUniformBuffer() {
    return this.#currentUniformBuffer;
  }

  set currentUniformBuffer(value) {
    this.#currentUniformBuffer = value ?? this.fallbackPostProcessUniformBuffer;
    this.#initBindGroup();
  }

  /**
    * @param { GPUDevice } device
    * @param { GPUCanvasContext } context
    */
  constructor(device, context) {
    if (PostProcessPass.instance) {
      return PostProcessPass.instance;
    }

    super(device, context);
    PostProcessPass.instance = this;
  }

  async init() {
    this.#initUniformBuffer();
    this.#initBindGroup();
    await this.#initPipeline();
    await GlowPass.init(this.device, this.context);

    return super.init();
  }

  #initUniformBuffer() {
    this.fallbackPostProcessUniformBuffer = this.device.createBuffer({
      label: "Fallback Post Process Uniform Buffer",
      size: 64,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.currentUniformBuffer = this.fallbackPostProcessUniformBuffer;

    const data = new Float32Array([
      0.02, // aaEdgeThreshold
      1.5,  // aaSpan
      0.1,  // cameraNear
      4000.0, // cameraFar
      1.0, // vingetteIntensity
      0.75, // vingetteRadius
      0.45, // vingetteSoftness
      5.0,  // dofFocusDistance
      4.0,  // dofAperture
      10.0, // dofMaxRadius
    ]);

    this.device.queue.writeBuffer(this.fallbackPostProcessUniformBuffer, 0, data);
    this.device.queue.writeBuffer(this.fallbackPostProcessUniformBuffer, 40, new Uint32Array([8]));
  }

  #initBindGroup() {
    this.sceneView = MainRenderPass.instance.sceneTextureView;
    this.depthView = MainRenderPass.instance.depthTextureView;
    this.bindGroup = this.device.createBindGroup({
      layout: Layouts.postProcessLayout,
      entries: [
        {
          binding: 0,
          resource: MainRenderPass.instance.sceneTextureView,
        },
        {
          binding: 1,
          resource: Texture.DEFAULT_SAMPLER,
        },
        {
          binding: 2,
          resource: MainRenderPass.instance.depthTextureView,
        },
        {
          binding: 3,
          resource: this.currentUniformBuffer,
        },
      ],
    });
  }

  async #initPipeline() {
    const vertexShader = await ShaderManager.createModule("src/core/shaders/fullscreenTriangle", this.device);
    const fragmentShader = await ShaderManager.createModule("src/core/shaders/postProcess", this.device);

    const vertex = {
      entryPoint: "vertex_main",
      module: vertexShader,
    }

    this.pipeline = this.device.createRenderPipeline({
      label: "Post Process Pipeline",
      layout: this.device.createPipelineLayout({
        label: "Post Process Pipeline Layout",
        bindGroupLayouts: [
          Layouts.postProcessLayout,
          Layouts.glowLayout,
        ],
      }),
      vertex,
      fragment: {
        module: fragmentShader,
        entryPoint: "fragment_main",
        targets: [{ format: navigator.gpu.getPreferredCanvasFormat() }],
        constants: {
          REVERSED_Z: Number(REVERSED_Z),
        }
      },
    });
  }

  #updateViewTexture() {
    this.renderPassDescriptor.colorAttachments[0].view = this.context.getCurrentTexture().createView();
  }

  /** @param { GPUCommandEncoder } commandEncoder */
  encode(commandEncoder) {
    if (
      this.sceneView !== MainRenderPass.instance.sceneTextureView ||
      this.depthView !== MainRenderPass.instance.depthTextureView
    ) {
      this.#initBindGroup();
    }

    this.#updateViewTexture();

    if (PostProcess.current && Camera3D.current) {
      const { current: camera } = Camera3D;
      const { current: postProcess } = PostProcess;

      if (camera.near !== postProcess.cameraNear) {
        postProcess.cameraNear = camera.near;
      }

      if (camera.far !== postProcess.cameraFar) {
        postProcess.cameraFar = camera.far;
      }
    }

    let rp = commandEncoder.beginRenderPass(this.renderPassDescriptor);
    rp.setPipeline(this.pipeline);
    rp.setBindGroup(0, this.bindGroup);
    rp.setBindGroup(1, GlowPass.bindGroup);
    rp.draw(3);
    rp.end();

    GlowPass.encode(commandEncoder, this.bindGroup)
  }
}
