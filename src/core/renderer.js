import { mat4 } from "./gl-matrix/index.js";

import { ShaderManager } from "./shaderManager.js";
import { assert } from "./utils.js";
import { Material } from "./resources/material.js";
import { Texture } from "./resources/texture.js";
import { RenderInfo } from "./resources/renderInfo.js";
import { Camera3D } from "./nodes/camera.js";
import { DirectionalLight } from "./nodes/directionalLight.js";
import { MainRenderPass } from "./rendering/mainRenderPass.js";
import { ShadowRenderPass } from "./rendering/shadowRenderPass.js";

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


  /** @type { GPUBindGroupLayout } */
  shadowsBindGroupLayout;

  /** @type { GPUBindGroup } */
  shadowsBindGroup;

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

  /** @type { GPUTextureView } */
  depthTextureView = null;

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

    this.materialBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        { // Albedo texture
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          texture: {},
        },
        { // Albedo sampler
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: {},
        },
        { // Normal map texture
          binding: 2,
          visibility: GPUShaderStage.FRAGMENT,
          texture: {},
        },
        { // Normal map sampler
          binding: 3,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: {},
        },
        { // Material properties
          binding: 4,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: {},
        },
      ]
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
    this.shaderModule = await ShaderManager.createModule("core/shaders/main", this.device);
    /** @type { GPUVertexState } */
    const vertexState = {
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
    }
    this.pipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [
          this.bindGroupLayout,
          this.materialBindGroupLayout,
          this.shadowsBindGroupLayout,
        ],
      }),
      vertex: vertexState,
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

    this.shadowPassPipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [
          this.bindGroupLayout,
        ],
      }),
      vertex: vertexState,
      primitive: {
        topology: "triangle-list",
        cullMode: "back",
      },
      depthStencil: {
        format: "depth32float",
        depthWriteEnabled: true,
        depthCompare: "less",
      },
    });
  }

  #initBindGroup() {
    this.uniformBuffer = this.device.createBuffer({
      // 2 mat4 + 2 vec3 + 1 float32
      size: 64 * 4 + 16 + 16,
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

    // queue.writeBuffer runs before submit, so the shadow pass needs its own uniforms
    this.shadowUniformBuffer = this.device.createBuffer({
      size: 64 * 4 + 16 + 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const createBindGroup = (uniformBuffer) => this.device.createBindGroup({
      layout: this.bindGroupLayout,
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

    this.bindGroup = createBindGroup(this.uniformBuffer);
    this.shadowBindGroup = createBindGroup(this.shadowUniformBuffer);

    this.shadowsBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          texture: {
            sampleType: "depth",
          },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: {
            type: "comparison",
          },
        }
      ],
    })

    this.shadowsBindGroup = this.device.createBindGroup({
      layout: this.shadowsBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: new ShadowRenderPass(this.device).depthTextureView,
        },
        {
          binding: 1,
          resource: this.device.createSampler({
            compare: "less",
          }),
        }
      ]
    })
  }

  /** @param { Camera3D } camera */
  render(camera = Camera3D.current) {
    if (!camera) {
      console.warn("No camera provided for rendering. Skipping render.");
      return;
    }

    const commandEncoder = this.device.createCommandEncoder();

    if (DirectionalLight.current) {
      const shadowRenderPass = new ShadowRenderPass(this.device);
      const shadowPass = commandEncoder.beginRenderPass(shadowRenderPass.descriptor);

      this.#writeCameraDataToBuffer(DirectionalLight.current, this.shadowUniformBuffer);
      shadowPass.setPipeline(this.shadowPassPipeline);
      this.#processRenderQueue(shadowPass, this.shadowBindGroup);
      shadowPass.end();
    }

    this.#writeCameraDataToBuffer(camera);
    const mainRenderPass = new MainRenderPass(this.device, this.context);
    mainRenderPass.descriptor.colorAttachments[0].view = this.context.getCurrentTexture().createView();
    const mainPass = commandEncoder.beginRenderPass(mainRenderPass.descriptor);

    mainPass.setPipeline(this.pipeline);
    mainPass.setBindGroup(2, this.shadowsBindGroup);
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

  /** @param { Camera3D } camera */
  #writeCameraDataToBuffer(camera, buffer = this.uniformBuffer) {
    this.device.queue.writeBuffer(buffer, 0, mat4.invert(mat4.create(), camera.transform));
    this.device.queue.writeBuffer(buffer, 64, camera.projection);

    if (DirectionalLight.current) {
      this.device.queue.writeBuffer(buffer, 128, mat4.invert(mat4.create(), DirectionalLight.current.transform));
      this.device.queue.writeBuffer(buffer, 192, DirectionalLight.current.projection);
      this.device.queue.writeBuffer(buffer, 256, new Float32Array(DirectionalLight.current.color));
    }

    this.device.queue.writeBuffer(buffer, 268, new Float32Array([ (performance.now() - this.time) / 1000 ]));
  }

  clearRenderQueue() {
    this.renderQueue = [];
  }

  /** @param { RenderInfo } renderInfo */
  queueRender(renderInfo) {
    this.renderQueue.push(renderInfo);
  }
}
