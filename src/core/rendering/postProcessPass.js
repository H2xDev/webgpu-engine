import { ShaderManager } from "../shaderManager.js";
import { Layouts } from "./layouts.js";
import { MainRenderPass } from "./mainRenderPass.js";
import { RenderPass } from "./renderPass.abstract.js";
import { GlowPass } from './glowPass.js';

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
    this.#initBindGroup();
    await this.#initPipeline();
    await GlowPass.init(this.device, this.context);

    return super.init();
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
          resource: this.device.createSampler({ label: 'Post Process Sampler' }),
        },
        {
          binding: 2,
          resource: MainRenderPass.instance.depthTextureView,
        }
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

    let rp = commandEncoder.beginRenderPass(this.renderPassDescriptor);
    rp.setPipeline(this.pipeline);
    rp.setBindGroup(0, this.bindGroup);
    rp.setBindGroup(1, GlowPass.bindGroup);
    rp.draw(3);
    rp.end();

    GlowPass.encode(commandEncoder, this.bindGroup)
  }
}
