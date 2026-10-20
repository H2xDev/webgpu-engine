import { ShaderManager } from "../shaderManager";
import { Layouts } from "./layouts";

export class PostProcessPass {
  /** @type { GPURenderPipeline } */
  pipeline;

  /** @type { GPUBindGroup } */
  bindGroup;

  /** @type { GPUDevice } */
  device;

  /** @type { GPUCanvasContext } */
  context;

  /**
    * @param { GPUDevice } device
    * @param { GPUCanvasContext } context
    */
  constructor(device, context) {
    this.device = device;
    this.context = context;
  }

  async init() {
    await this.#initPipeline();
  }

  async #initPipeline() {
    const shadowModule = await ShaderManager.createModule("src/core/shaders/postProcess.wgsl", this.device);
    this.pipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [Layouts.postProcessLayout],
      }),
      vertex: {
        module: shadowModule,
        entryPoint: "vertex_main",
      },
      fragment: {
        module: shadowModule,
        entryPoint: "fragment_main",
        targets: [{ format: navigator.gpu.getPreferredCanvasFormat() }],
      },
    });
  }
}
