export class MainRenderPass {
  static instance = null;

  /** @type { GPURenderPassDescriptor } */
  descriptor

  /** @type { GPUTexture } */
  depthTexture

  /** @type { GPUTextureView } */
  depthTextureView

  /** @type { GPUDevice } */
  device

  /**
    * @param { GPUDevice } device
    * @param { GPUCanvasContext } context
    */
  constructor(device, context) {
    if (MainRenderPass.instance) {
      return MainRenderPass.instance;
    }
    MainRenderPass.instance = this;

    this.device = device;
    this.depthTexture = device.createTexture({
      size: [context.canvas.width, context.canvas.height, 1],
      format: "depth24plus",
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.depthTextureView = this.depthTexture.createView();

    this.descriptor = {
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        clearValue: { r: 0.0, g: 0.0, b: 0.25, a: 1.0 },
        loadOp: "clear",
        storeOp: "store",
      }],
      depthStencilAttachment: {
        view: this.depthTextureView,
        depthClearValue: 1.0,
        depthLoadOp: "clear",
        depthStoreOp: "discard",
      },
    }
  }
}
