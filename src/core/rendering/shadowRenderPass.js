export class ShadowRenderPass {
  static instance = null;

  /** @type { GPURenderPassDescriptor } */
  descriptor = {
    colorAttachments: [],
    depthStencilAttachment: {
      view: null,
      depthClearValue: 1.0,
      depthLoadOp: "clear",
      depthStoreOp: "store",
    },
  }

  /** @type { GPUTexture } */
  depthTexture

  /** @type { GPUTextureView } */
  depthTextureView

  /** @type { GPUDevice } */
  device

  /**
   * @param { GPUDevice } device
   */
  constructor(device) {
    if (ShadowRenderPass.instance) {
      return ShadowRenderPass.instance;
    }

    ShadowRenderPass.instance = this;

    this.device = device;
    this.depthTexture = device.createTexture({
      size: [4096, 4096, 1],
      format: "depth32float",
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });

    this.depthTextureView = this.depthTexture.createView();
    this.descriptor.depthStencilAttachment.view = this.depthTextureView;
  }
}
