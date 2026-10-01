import { mat4 } from "../gl-matrix/index.js";

import { Mesh } from "./mesh.js";
import { ShaderManager } from "../controller/shaderManager.js";
import { assert } from "../utils.js";
import { Material } from "./material.js";
import { Scene } from "../model/scene.js";

export class Renderer {
  canvas = document.createElement("canvas");

  /** @type { GPUCanvasContext } */
  context = this.canvas.getContext("webgpu");

  format = navigator.gpu.getPreferredCanvasFormat();

  /** @type { GPUAdapter } */
  adapter;

  /** @type { GPUDevice } */
  device;

  /** @type { GPUShaderModule } */
  shaderModule;

  /** @type { GPURenderPipeline } */
  pipeline;

  /** @type { GPUCommandEncoder } */
  commandEncoder;

  /** @type { GPURenderPassEncoder } */
  renderPass;

  /** @type { GPUBindGroup } */
  bindGroup;

  /** @type { GPUBindGroupLayout } */
  bindGroupLayout;

  /** @type { GPUBuffer } */
  uniformBuffer;

  /** @type { Mesh } */
  mesh;

  /** @type { Material } */
  material;

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
  }

  async #defineAssets() {
    this.mesh = new Mesh(this.device);
    this.material = await new Material().init(this.device, "./test.png")
  }

  async #initDevice() {
    this.adapter = await navigator.gpu.requestAdapter();
    this.device = await this.adapter.requestDevice();
  }

  async #initRenderPipeline() {
    this.shaderModule = await ShaderManager.createModule("shader", this.device);
    this.pipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [this.bindGroupLayout],
      }),
      vertex: {
        module: this.shaderModule,
        entryPoint: "vertex_main",
        buffers: [this.mesh.bufferLayout],
      },
      fragment: {
        module: this.shaderModule,
        entryPoint: "fragment_main",
        targets: [{ format: this.format }]
      },
      primitive: {
        topology: "triangle-strip",
      }
    });
  }

  #initBindGroup() {
    this.uniformBuffer = this.device.createBuffer({
      size: 64 * 3,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: {},
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          texture: {},
        },
        {
          binding: 2,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: {},
        }
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
          resource: this.material.view,
        },
        {
          binding: 2,
          resource: this.material.sampler,
        }
      ],
    });
  }

  previousTimestamp = 0.0;
  /**
    * @param { Scene } scene
    * @param { number } timestamp
    */
  async render(scene, timestamp = 0.0) {
    const dt = (timestamp - this.previousTimestamp) / 1000;
    this.previousTimestamp = timestamp;

    scene.update(dt);

    this.device.queue.writeBuffer(this.uniformBuffer, 64, mat4.invert(mat4.create(), scene.camera.transform));
    this.device.queue.writeBuffer(this.uniformBuffer, 128, scene.camera.projection);

    // Should be called on each render and could not be cached
    const textureView = this.context.getCurrentTexture().createView();

    const commandEncoder = this.device.createCommandEncoder();
    const rp = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: textureView,
        clearValue: { r: 0.0, g: 0.0, b: 0.25, a: 1.0 },
        loadOp: "clear",
        storeOp: "store",
      }],
    });

    rp.setPipeline(this.pipeline);
    rp.setVertexBuffer(0, this.mesh.buffer);

    scene.triangles.forEach((triangle, _index) => {
      this.device.queue.writeBuffer(this.uniformBuffer, 0, triangle.transform);
      rp.setBindGroup(0, this.bindGroup);
      rp.draw(4, 1, 0, 0);
    });
    rp.end();

    this.device.queue.submit([ commandEncoder.finish() ]);

    requestAnimationFrame(this.render.bind(this, scene));
  }
}
