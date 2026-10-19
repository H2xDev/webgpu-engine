import { ShaderManager } from "../shaderManager.js";
import { KawaseBlur } from "./kawaseBlur.js";
import { Layouts } from "./layouts.js";
import { MainRenderPass } from "./mainRenderPass.js";
import { RenderPass } from "./renderPass.abstract.js";

const GLOW_TEXTURE_FORMAT = "rgba16float";

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

  /** @type { GPUTextureView } */
  glowTextureView;

  /** @type { GPUTexture } */
  glowTexture;

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
    this.#initGlowTexture();
    await this.#initPipeline();

    return super.init();
  }

  // TODO: Refactor this method
  #initGlowTexture() {
    const downScale = 4;
    this.glowTexture = this.device.createTexture({
      size: [this.context.canvas.width / downScale, this.context.canvas.height / downScale],
      format: GLOW_TEXTURE_FORMAT,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });

    this.glowTextureView = this.glowTexture.createView();

    window.addEventListener("resize", () => {
      this.glowTexture.destroy();
      this.#initGlowTexture();
    }, { once: true })
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
    const vertex = {
      module: await ShaderManager.createModule("src/core/shaders/postProcess", this.device),
      entryPoint: "vertex_main",
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

    this.glowBindGroup = this.device.createBindGroup({
      layout: glowLayout,
      entries: [
        {
          binding: 0,
          resource: this.glowTextureView,
        },
        {
          binding: 1,
          resource: this.device.createSampler({
            label: 'Glow Sampler',
            magFilter: 'linear',
            minFilter: 'linear',
          }),
        },
      ],
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
        module: vertex.module,
        entryPoint: "fragment_main",
        targets: [{ format: navigator.gpu.getPreferredCanvasFormat() }],
      },
    });

    this.glowPipeline = this.device.createRenderPipeline({
      label: "Glow Render Pipeline",
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [Layouts.postProcessLayout],
      }),
      vertex,
      fragment: {
        module: vertex.module,
        entryPoint: "glow_pass",
        targets: [{ format: GLOW_TEXTURE_FORMAT }],
      }
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
    rp.setBindGroup(1, this.glowBindGroup)
    rp.draw(3);
    rp.end();

    this.renderPassDescriptor.colorAttachments[0].view = this.glowTextureView;
    rp = commandEncoder.beginRenderPass(this.renderPassDescriptor);
    rp.setPipeline(this.glowPipeline)
    rp.setBindGroup(0, this.bindGroup)
    rp.draw(3);
    rp.end();

    KawaseBlur.setTextureSize(this.glowTexture.width, this.glowTexture.height);
    KawaseBlur.processTexture(commandEncoder, this.glowTextureView);
  }
}
