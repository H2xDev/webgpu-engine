import { ShaderManager } from "../shaderManager.js";
import { KawaseBlur } from "./kawaseBlur.js";

export const GlowPass = new class GlowPass {
  /** @type { GPURenderPipeline } */
  pipeline;

  /** @type { GPUDevice } */
  device;

  /** @type { GPUTexture } */
  glowTexture;

  /** @type { GPUSampler } */
  sampler;

  /** @type { GPUTextureView } */
  glowTextureView;

  /** @type { GPURenderPassDescriptor } */
  renderPassDescriptor

  /** @type { GPUCanvasContext } */
  context

  /** @type { GPUBindGroupLayout } */
  bindGroupLayout;

  /** @type { GPUBindGroup } */
  bindGroup;

  /**
   * @param { GPUDevice } device
   * @param { GPUCanvasContext } context
   */
  async init(device, context) {
    this.device = device;
    this.context = context;

    const vertexShader = await ShaderManager.createModule("src/core/shaders/fullscreenTriangle", device);
    const fragmentShader = await ShaderManager.createModule("src/core/shaders/glowPass", device);

    this.bindGroupLayout = this.device.createBindGroupLayout({
      label: 'Glow Pass Bind Group Layout',
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          texture: {}
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: {},
        }
      ]
    })

    const layout = this.device.createPipelineLayout({
      bindGroupLayouts: [this.bindGroupLayout],
    })

    this.pipeline = this.device.createRenderPipeline({
      layout,
      vertex: {
        module: vertexShader,
        entryPoint: 'vertex_main',
      },
      fragment: {
        module: fragmentShader,
        entryPoint: 'main',
        targets: [{
          format: 'rgba16float'
        }]
      }
    })

    this.renderPassDescriptor = {
      colorAttachments: [
        {
          loadOp: 'clear',
          storeOp: 'store',
          view: this.glowTextureView,
        }
      ]
    }

    this.#initGlowTexture();

    await KawaseBlur.init(device)
  }

  /**
   * @param { GPUCommandEncoder } commandEncoder
   * @param { GPUBindGroup } bindGroup - contains screen texture
   */
  encode(commandEncoder, bindGroup) {
    const rp = commandEncoder.beginRenderPass(this.renderPassDescriptor);
    rp.setPipeline(this.pipeline);
    rp.setBindGroup(0, bindGroup);
    rp.draw(3);
    rp.end();

    KawaseBlur.setTextureSize(this.glowTexture.width, this.glowTexture.height);
    KawaseBlur.processTexture(commandEncoder, this.glowTextureView);
  }

  // TODO: Refactor this method
  #initGlowTexture() {
    const downScale = 16;
    this.glowTexture = this.device.createTexture({
      size: [this.context.canvas.width / downScale, this.context.canvas.height / downScale],
      format: 'rgba16float',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });

    this.sampler ??= this.device.createSampler({
      minFilter: 'linear',
      magFilter: 'linear',
    });

    this.glowTextureView = this.glowTexture.createView();
    this.renderPassDescriptor.colorAttachments[0].view = this.glowTextureView;

    this.bindGroup = this.device.createBindGroup({
      layout: this.bindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: this.glowTexture,
        },
        {
          binding: 1,
          resource: this.sampler,
        }
      ]
    });

    window.addEventListener("resize", () => {
      this.glowTexture.destroy();
      this.#initGlowTexture();
    }, { once: true });
  }
}
