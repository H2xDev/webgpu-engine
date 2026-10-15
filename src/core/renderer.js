import { assert } from "./utils.js";
import { Material } from "./resources/material.js";
import { Texture } from "./resources/texture.js";
import { RenderInfo } from "./resources/renderInfo.js";
import { Camera3D } from "./nodes/camera.js";
import { DirectionalLight } from "./nodes/directionalLight.js";
import { MainRenderPass } from "./rendering/mainRenderPass.js";
import { ShadowRenderPass } from "./rendering/shadowRenderPass.js";
import { Layouts } from "./rendering/layouts.js";
import { EnvironmentRenderPass } from "./rendering/environmentRenderPass.js";
import { Environment } from "./nodes/environment.js";

export const Renderer = new class Renderer {
  canvas = document.createElement("canvas");

  /** @type { GPUCanvasContext } */
  context = this.canvas.getContext("webgpu");

  format = navigator.gpu.getPreferredCanvasFormat();

  /** @type { GPUAdapter } */
  adapter;

  /** @type { GPUDevice } */
  device;

  /** @type { GPUDevice } */
  static device;

  /** @type { GPUShaderModule } */
  shaderModule;

  /** @type { GPURenderPipeline } */
  pipeline;

  /** @type { GPURenderPipeline } */
  shadowPassPipeline;

  /** @type { GPUBuffer } */
  objectBuffer;

  /** @type { RenderInfo[] } */
  renderQueue = [];

  /** @type { Material } */
  defaultMaterial;

  objectSize = 64;
  objectStride = 256;

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

    Layouts.init(this.device);

    this.context.configure({ device: this.device, format: this.format });

    await this.#initRenderPipeline();
    await this.#defineAssets()
    this.#initBindGroup();
  }

  #updateViewportSize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.context.configure({ device: this.device, format: this.format });
    this.depthTexture.destroy();
    this.depthTexture = this.device.createTexture({
      size: [this.canvas.width, this.canvas.height, 1],
      format: "depth24plus",
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.depthTextureView = this.depthTexture.createView();
  }

  async #defineAssets() {
    this.objectBuffer = this.device.createBuffer({
      size: 256 * 1024,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    this.depthTexture = this.device.createTexture({
      size: [this.canvas.width, this.canvas.height, 1],
      format: "depth24plus",
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    const texture = await Texture.load("/test.png");
    this.defaultMaterial = new Material().init(texture, texture);
  }

  async #initDevice() {
    this.adapter = await navigator.gpu.requestAdapter();
    this.device = await this.adapter.requestDevice();

    this.objectStride = Math.ceil(this.objectSize / this.device.limits.minStorageBufferOffsetAlignment) * this.device.limits.minStorageBufferOffsetAlignment;
    Renderer.device = this.device;
  }

  async #initRenderPipeline() {
    this.shadowRenderPass = await new ShadowRenderPass(this.device).init();
    this.mainRenderPass = await new MainRenderPass(this.device, this.context)
      .initShadowBindGroup(this.shadowRenderPass.depthTextureView, this.shadowRenderPass.depthTextureSampler)
      .init();

    this.envRenderPass = await new EnvironmentRenderPass(this.device, this.context)
      .init();
  }

  #initBindGroup() {
    /** @param { GPUBuffer } uniformBuffer */
    const createBindGroup = (uniformBuffer) => this.device.createBindGroup({
      label: "Renderer Bind Group",
      layout: Layouts.geometryLayout,
      entries: [
        {
          binding: 0,
          resource: {
            buffer: uniformBuffer,
          }
        },
        {
          binding: 1,
          resource: {
            buffer: this.objectBuffer,
            offset: 0,
            size: 64,
          }
        },
      ],
    });

    this.bindGroup = createBindGroup(this.mainRenderPass.uniformBuffer);
    this.shadowBindGroup = createBindGroup(this.shadowRenderPass.uniformBuffer);
  }

  /** @param { Camera3D } camera */
  render(camera = Camera3D.current) {
    if (!camera) {
      console.warn("No camera provided for rendering. Skipping render.");
      return;
    }

    const commandEncoder = this.device.createCommandEncoder();

    if (Environment.current) {
      this.envRenderPass.updateViewTexture();
      const envPass = commandEncoder.beginRenderPass(this.envRenderPass.renderPassDescriptor);
      camera.writeToBuffer(this.envRenderPass.uniformBuffer);
      envPass.setPipeline(this.envRenderPass.pipeline);
      envPass.setBindGroup(0, Environment.current.bindGroup);
      envPass.draw(4, 1, 0, 0);
      envPass.end();
    }


    if (DirectionalLight.current) {
      const shadowPass = commandEncoder.beginRenderPass(this.shadowRenderPass.renderPassDescriptor);

      DirectionalLight.current.writeToBuffer(this.shadowRenderPass.uniformBuffer);
      shadowPass.setPipeline(this.shadowRenderPass.pipeline);
      this.#processRenderQueue(shadowPass, this.shadowBindGroup);
      shadowPass.end();
    }

    camera.writeToBuffer(this.mainRenderPass.uniformBuffer);

    if (DirectionalLight.current) {
      DirectionalLight.current.writeLightDataToBuffer(this.mainRenderPass.uniformBuffer, 64 * 3);
    }

    this.mainRenderPass.updateViewTexture();
    const mainPass = commandEncoder.beginRenderPass(this.mainRenderPass.renderPassDescriptor);

    mainPass.setPipeline(this.mainRenderPass.pipeline);
    mainPass.setBindGroup(2, this.mainRenderPass.shadowBindGroup);
    if (Environment.current) {
      mainPass.setBindGroup(3, Environment.current.bindGroup);
    }
    this.#processRenderQueue(mainPass);
    mainPass.end();

    this.device.queue.submit([ commandEncoder.finish() ]);
    this.clearRenderQueue();
  }

  /** @param { GPURenderPassEncoder } rp */
  #processRenderQueue(rp, bindGroup = this.bindGroup) {
    this.renderQueue.forEach((info, index) => {
      const offset = this.objectStride * index;
      this.device.queue.writeBuffer(this.objectBuffer, offset, info.transform);
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
