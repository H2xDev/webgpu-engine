import { assert } from "./utils.js";
import { Material } from "./resources/material.js";
import { Texture } from "./resources/texture.js";
import { RenderInfo } from "./resources/renderInfo.js";
import { MainRenderPass } from "./rendering/mainRenderPass.js";
import { ShadowRenderPass } from "./rendering/shadowRenderPass.js";
import { PostProcessPass } from "./rendering/postProcessPass.js";
import { Layouts } from "./rendering/layouts.js";
import { EnvironmentRenderPass } from "./rendering/environmentRenderPass.js";
import { KawaseBlur } from "./rendering/kawaseBlur.js";
import { IrradianceMapGenerator } from "./utils/irradianceMapGenerator.js";
import { MipmapGenerator } from "./utils/mipmapGenerator.js";
import { OBJECT_SIZE, OBJECT_STRIDE } from "./convention.js";

export const Renderer = new class Renderer {
  /** @type { GPUDevice } */
  static device;

  canvas = document.createElement("canvas");

  /** @type { GPUCanvasContext } */
  context = this.canvas.getContext("webgpu");

  format = navigator.gpu.getPreferredCanvasFormat();

  /** @type { GPUAdapter } */
  adapter;

  /** @type { GPUDevice } */
  device;

  /** @type { GPUBuffer } */
  objectBuffer;

  /** @type { RenderInfo[] } */
  renderQueue = [];

  /** @type { Material } */
  defaultMaterial;

  /** Scratch for a std140-style padded mat3x3 (3 columns of vec4). */
  normalScratch = new Float32Array(12);

  /** @type { MainRenderPass } */
  mainRenderPass;

  /** @type { ShadowRenderPass } */
  shadowRenderPass;

  /** @type { EnvironmentRenderPass } */
  envRenderPass;

  time = performance.now();

  async init() {
    document.body.appendChild(this.canvas);
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;

    window.addEventListener("resize", this.#updateViewportSize.bind(this));

    await this.#initDevice()
    assert(this.adapter, "The adapter is not initialized");
    assert(this.device, "The device is not initialized")

    MipmapGenerator.init(this.device);
    Layouts.init(this.device);
    Texture.init(this.device);
    Material.init(this.device);

    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: "premultiplied",
    });

    await this.#initRenderPipeline();
    await this.#defineAssets()
  }

  #updateViewportSize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: "premultiplied",
    });

    if (this.depthTexture) this.depthTexture.destroy();

    this.depthTexture = this.device.createTexture({
      size: [this.canvas.width, this.canvas.height, 1],
      format: "depth24plus",
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.depthTextureView = this.depthTexture.createView();
  }

  async #defineAssets() {
    this.objectBuffer = this.device.createBuffer({
      size: OBJECT_STRIDE * 1024,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    this.depthTexture = this.device.createTexture({
      size: [this.canvas.width, this.canvas.height, 1],
      format: "depth24plus",
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    this.defaultMaterial = new Material();

    this.shadowRenderPass.assignObjectBuffer(this.objectBuffer);
    this.mainRenderPass.assignObjectBuffer(this.objectBuffer);
  }

  async #initDevice() {
    this.adapter = await navigator.gpu.requestAdapter();
    this.device = await this.adapter.requestDevice();

    Renderer.device = this.device;
  }

  async #initRenderPipeline() {
    await KawaseBlur.init(this.device);
    IrradianceMapGenerator.init(this.device);

    this.shadowRenderPass = await new ShadowRenderPass(this.device, this.context).init();
    this.mainRenderPass = await new MainRenderPass(this.device, this.context).init();
    this.envRenderPass = await new EnvironmentRenderPass(this.device, this.context).init();
    this.postProcessPass = await new PostProcessPass(this.device, this.context).init();
  }

  /**
    * Renders the scene
    */
  render() {
    const commandEncoder = this.device.createCommandEncoder();

    this.envRenderPass.encode(commandEncoder);
    this.shadowRenderPass.encode(commandEncoder, this.#processRenderQueue.bind(this));
    this.mainRenderPass.encode(commandEncoder, this.#processRenderQueue.bind(this));
    this.postProcessPass.encode(commandEncoder);

    this.device.queue.submit([ commandEncoder.finish() ]);
    this.clearRenderQueue();
  }

  /**
    * Renders the queued render information using the provided render pass encoder and bind group.
    *
    * @param { GPURenderPassEncoder } rp
    * @param { GPUBindGroup } bindGroup
    */
  #processRenderQueue(rp, bindGroup) {
    this.renderQueue.forEach((info, index) => {
      const offset = OBJECT_STRIDE * index;
      // model: mat4x4
      // normalMatrix: mat3x3
      this.device.queue.writeBuffer(this.objectBuffer, offset, info.transform.data);
      const n = info.transform.getNormalMatrix()
      const padded = this.normalScratch;
      padded[0] = n[0]; padded[1] = n[1]; padded[2] = n[2];
      padded[4] = n[3]; padded[5] = n[4]; padded[6] = n[5];
      padded[8] = n[6]; padded[9] = n[7]; padded[10] = n[8];
      this.device.queue.writeBuffer(this.objectBuffer, offset + 64, padded);

      rp.setVertexBuffer(0, info.vertices);
      rp.setIndexBuffer(info.indices, "uint32");
      rp.setBindGroup(0, bindGroup, [ offset ]);

      for (const surface of info.surfaces) {
        const material = surface.material || info.material || this.defaultMaterial;
        rp.setBindGroup(1, material.bindGroup);
        rp.drawIndexed(surface.count, 1, surface.offset);
      }
    });
  }

  clearRenderQueue() {
    this.renderQueue = [];
  }

  /** @param { RenderInfo } renderInfo */
  queueRender(renderInfo) {
    this.renderQueue.push(renderInfo);
  }
}
