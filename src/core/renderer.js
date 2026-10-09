import { mat4 } from "./gl-matrix/index.js";

import { ShaderManager } from "./shaderManager.js";
import { assert } from "./utils.js";
import { Material } from "./resources/material.js";
import { Texture } from "./resources/texture.js";
import { RenderInfo } from "./resources/renderInfo.js";
import { Camera3D } from "./nodes/camera.js";

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

  /** @type { GPUBindGroupLayout } */
  bindGroupLayout;

  /** @type { GPUBindGroupLayout } */
  materialBindGroupLayout;

  /** @type { GPUBuffer } */
  uniformBuffer;

  /** @type { GPUBuffer } */
  objectBuffer;

  /** @type { RenderInfo[] } */
  renderQueue = [];

  /** @type { Material } */
  defaultMaterial;

  objectSize = 64;
  objectStride = 256;

  /** @type { GPUTexture } */
  depthTexture = null;
  time = performance.now();

  async init() {
    document.body.appendChild(this.canvas);
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;

    window.addEventListener("resize", this.#updateViewportSize.bind(this));

    await this.#initDevice()
    assert(this.adapter, "The adapter is not initialized");
    assert(this.device, "The device is not initialized")

    await this.#defineAssets()
    this.context.configure({ device: this.device, format: this.format });

    this.#initBindGroup();
    await this.#initRenderPipeline();
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

    this.materialBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          texture: {},
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: {},
        }
      ]
    });

    const texture = await Texture.load("/test.png")
    this.defaultMaterial = new Material().init(texture);
  }

  async #initDevice() {
    this.adapter = await navigator.gpu.requestAdapter();
    this.device = await this.adapter.requestDevice();

    this.objectStride = Math.ceil(this.objectSize / this.device.limits.minStorageBufferOffsetAlignment) * this.device.limits.minStorageBufferOffsetAlignment;
    Renderer.device = this.device;
  }

  async #initRenderPipeline() {
    this.shaderModule = await ShaderManager.createModule("core/shaders/main", this.device);
    this.pipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [
          this.bindGroupLayout,
          this.materialBindGroupLayout
        ],
      }),
      vertex: {
        module: this.shaderModule,
        entryPoint: "vertex_main",
        buffers: [{
          arrayStride: 32, // position, normal, and UV per vertex
          attributes: [
            {
              shaderLocation: 0,
              format: 'float32x3',
              offset: 0,
            },
            {
              shaderLocation: 1,
              format: 'float32x3',
              offset: 12,
            },
            {
              shaderLocation: 2,
              format: 'float32x2',
              offset: 24,
            }
          ]
        }],
      },
      fragment: {
        module: this.shaderModule,
        entryPoint: "fragment_main",
        targets: [{ format: this.format }]
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "back",
      },
      depthStencil: {
        format: "depth24plus",
        depthWriteEnabled: true,
        depthCompare: "less",
      },
    });
  }

  #initBindGroup() {
    this.uniformBuffer = this.device.createBuffer({
      size: 64 * 2 + 16, // 2 mat4 + 1 float
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: {},
        },
        {
          binding: 1,
          visibility: GPUShaderStage.VERTEX,
          buffer: {
            type: "read-only-storage",
            hasDynamicOffset: true,
          },
        },
      ]
    })

    this.bindGroup = this.device.createBindGroup({
      layout: this.bindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this.uniformBuffer,
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
    })
  }

  /** @param { Camera3D } camera */
  async render(camera = Camera3D.current) {
    if (!camera) {
      console.warn("No camera provided for rendering. Skipping render.");
      return;
    }

    this.#writeCameraDataToBuffer(camera);
    const { commandEncoder: ce, renderPass: rp } = this.#prepareRender();

    rp.setPipeline(this.pipeline);

    // NOTE: At this point we have to filter out non-visible objects, but for now we will just render everything in the queue

    this.renderQueue.forEach((info, index) => {
      const offset = this.objectStride * index;
      this.device.queue.writeBuffer(this.objectBuffer, offset, info.transform);
      rp.setVertexBuffer(0, info.vertices);
      rp.setBindGroup(0, this.bindGroup, [ offset ]);

      const material = info.material || this.defaultMaterial;
      rp.setBindGroup(1, material.bindGroup);

      rp.draw(info.vertexCount);
    });

    rp.end();

    this.device.queue.submit([ ce.finish() ]);
    this.clearRenderQueue();
  }

  #prepareRender() {
    const commandEncoder = this.device.createCommandEncoder();
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: this.context.getCurrentTexture().createView(),
        clearValue: { r: 0.0, g: 0.0, b: 0.25, a: 1.0 },
        loadOp: "clear",
        storeOp: "store",
      }],
      depthStencilAttachment: {
        view: this.depthTexture.createView(),
        depthClearValue: 1.0,
        depthLoadOp: "clear",
        depthStoreOp: "discard",
      },
    });

    return { commandEncoder, renderPass };
  }

  /** @param { Camera3D } camera */
  #writeCameraDataToBuffer(camera) {
    this.device.queue.writeBuffer(this.uniformBuffer, 0, mat4.invert(mat4.create(), camera.transform));
    this.device.queue.writeBuffer(this.uniformBuffer, 64, camera.projection);
    this.device.queue.writeBuffer(this.uniformBuffer, 128, new Float32Array([ (performance.now() - this.time) / 1000 ]));
  }

  clearRenderQueue() {
    this.renderQueue = [];
  }

  /** @param { RenderInfo } renderInfo */
  queueRender(renderInfo) {
    this.renderQueue.push(renderInfo);
  }
}
