import { Camera3D } from "../nodes/camera.js";
import { ShaderManager } from "../shaderManager.js";
import { Layouts } from "./layouts.js";
import { RenderPass } from "./renderPass.abstract.js";
import { Environment } from "../nodes/environment.js";

export class EnvironmentRenderPass extends RenderPass {
  /** @type { EnvironmentRenderPass } */
  static instance = null;

  /** @type { GPUBuffer } */
  uniformBuffer;

  /** @type { GPUBindGroupLayout } */
  bindGroupLayout;

  /** @type { GPURenderPassDescriptor } */
  renderPassDescriptor;

  /**
    * @param { GPUDevice } device
    * @param { GPUCanvasContext } context
    */
  constructor(device, context) {
    if (EnvironmentRenderPass.instance) {
      return EnvironmentRenderPass.instance;
    }

    super(device, context);

    EnvironmentRenderPass.instance = this;
  }

  async init() {
    this.#initUniformBuffer();
    this.#initRenderPassDescriptor();
    await this.#initPipeline();

    return this;
  }

  #initRenderPassDescriptor() {
    /** @type { GPURenderPassDescriptor } */
    this.renderPassDescriptor = {
      colorAttachments: [{
        view: this.context.getCurrentTexture().createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        loadOp: 'clear',
        storeOp: 'store',
      }]
    }
  }

  #initUniformBuffer() {
    this.uniformBuffer = this.device.createBuffer({
      label: 'Environment Uniform Buffer',
      size: 256,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  async #initPipeline() {
    const shaderModule = await ShaderManager.createModule('src/core/shaders/environment', this.device);

    this.pipeline = this.device.createRenderPipeline({
      label: 'Environment Render Pipeline',
      layout: this.device.createPipelineLayout({
        label: 'Environment Pipeline Layout',
        bindGroupLayouts: [Layouts.environmentLayout]
      }),
      vertex: {
        module: shaderModule,
        entryPoint: 'vertex_main',
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fragment_main',
        targets: [{ format: navigator.gpu.getPreferredCanvasFormat() }]
      },
      primitive: {
        topology: 'triangle-strip',
        cullMode: 'back',
      }
    });
  }

  updateViewTexture() {
    this.renderPassDescriptor.colorAttachments[0].view = this.context.getCurrentTexture().createView();
  }

  /** @param { GPUCommandEncoder } commandEncoder */
  encode(commandEncoder) {
    if (!Environment.current) return;
    if (!Camera3D.current) return;

    this.updateViewTexture();

    const rp = commandEncoder.beginRenderPass(this.renderPassDescriptor);
    Camera3D.current.writeToBuffer(this.uniformBuffer);
    rp.setPipeline(this.pipeline);
    rp.setBindGroup(0, Environment.current.bindGroup);
    rp.draw(4, 1, 0, 0);
    rp.end();
  }
}
