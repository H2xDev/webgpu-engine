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
    this.bindGroup = this.device.createBindGroup({
      layout: Layouts.postProcessLayout,
      entries: [
        {
          binding: 0,
          resource: MainRenderPass.instance.sceneTextureView,
        },
        {
          binding: 1,
          resource: this.device.createSampler({
            'label': 'Post Process Sampler',
          }),
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

    const glowLayout = this.device.createBindGroupLayout({
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
          }
      ]
    });

    this.pipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [
          Layouts.postProcessLayout,
          glowLayout,
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
