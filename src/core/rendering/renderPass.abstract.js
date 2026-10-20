/**
  * @abstract
  * Interface for a render pass. This class defines the structure and methods that any render pass should implement. It is intended to be subclassed by specific render pass implementations.
  * Each render pass should be a singleton, meaning that there should only be one instance of each render pass type.
  */
export class RenderPass {
  /** @type { GPURenderPipeline } */
  pipeline;

  /** @type { GPURenderPassDescriptor } */
  pipelineDescriptor;

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

  /**
    * Initialize the render pass. This method should be overridden by subclasses to set up the pipeline and any necessary resources.
    * @returns { Promise<this> }
    */
  async init() {
    return this;
  }

  /**
    * Encode the render pass commands. This method should be overridden by subclasses to encode the specific rendering commands for the pass.
    * @param { GPUCommandEncoder } commandEncoder
    * @param { (rp: GPURenderPassEncoder) => void } renderCallback
    */
  encode(commandEncoder, renderCallback) {}
}
