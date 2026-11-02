/** @typedef { number } PassNumber */

/** @typedef PassInputData
  *
  * @property { GPUBindGroup } bindGroup
  * @property { GPUTextureView } inputTexture
  * @property { GPUTextureView } outputTexture
  * @property { GPUBuffer } uniformBuffer
  */

import { Texture } from "@core/resources";
import { ShaderManager } from "../shaderManager.js";

const MAX_PASSES = 8;

export const KawaseBlur = new class KawaseBlur {
  /** @type { Map<PassNumber, PassInputData> } */
  bindGroupCache = new Map();

  /** @type { Map<string, GPUTextureView> } */
  internalTextureCache = new Map();

  /** @type { [number, number] } */
  size = [512, 512];

  /** @type { GPURenderPipeline } */
  pipeline;

  /** @type { GPUBindGroup[] } */
  bindGroups;

  /** @type { GPUBuffer[] } */
  uniformBuffers;

  /** @type { GPUDevice } */
  device;

  /** @type { GPUTextureView } */
  get pingTextureView() {
    return this.#getInternalTexture("ping")
  }

  /** @type { GPUTextureView } */
  get pongTextureView() {
    return this.#getInternalTexture("pong")
  }

  /** @type { GPUSampler } */
  defaultSampler;

  /** @type { GPURenderPassDescriptor } */
  renderPassDescriptor = {
    colorAttachments: [
      {
        view: null,
        loadOp: "clear",
        storeOp: "store",
        clearValue: { r: 0, g: 0, b: 0, a: 0 }
      }
    ]
  }

  /** @param { GPUDevice } device*/
  async init(device) {
    this.device = device;

    await this.#initPipeline();
  }

  async #initPipeline() {
    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          texture: {}
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: {}
        },
        {
          binding: 2,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: {}
        }
      ]
    });

    const fullScreenTriangleModule = await ShaderManager.createModule("src/core/shaders/fullscreenTriangle", this.device);
    const module = await ShaderManager.createModule("src/core/shaders/kawaseBlur", this.device);

    this.pipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout]
      }),
      vertex: {
        module: fullScreenTriangleModule,
        entryPoint: "vertex_main"
      },
      fragment: {
        module,
        entryPoint: "fragment_main",
        targets: [{ format: "rgba16float" }]
      }
    })
  }

  /** @param { string } postfix */
  #getInternalTexture(postfix) {
    const hash = this.size.join("_") + postfix;

    if (this.internalTextureCache.has(hash)) return this.internalTextureCache.get(hash)

    const tex = this.device.createTexture({
      size: this.size,
      format: 'rgba16float',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    })

    const view = tex.createView()
    this.internalTextureCache.set(hash, view);

    return view;
  }

  /**
    * @param { PassNumber } pass
    * @param { GPUTextureView } inoutTextureView
    */
  #getInputBindGroup(pass = 0, inoutTextureView) {
    const isLastPass = pass === MAX_PASSES - 1;

    if (this.bindGroupCache.has(pass)) {
      return this.bindGroupCache.get(pass);
    }

    const inputTexture = pass === 0
      ? inoutTextureView
      : pass % 2 === 1
        ? this.pingTextureView
        : this.pongTextureView;

    const outputTexture = isLastPass
      ? inoutTextureView
      : pass % 2 === 0
        ? this.pingTextureView
        : this.pongTextureView;

    const uniformBufferData = new Uint32Array([ pass ]);
    const uniformBuffer = this.device.createBuffer({
      size: 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    const bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: inputTexture
        },
        {
          binding: 1,
          resource: Texture.DEFAULT_SAMPLER,
        },
        {
          binding: 2,
          resource: uniformBuffer,
        }
      ]
    });

    const passInputData = {
      bindGroup,
      uniformBuffer,
      inputTexture,
      outputTexture,
    }

    this.device.queue.writeBuffer(uniformBuffer, 0, uniformBufferData)
    this.bindGroupCache.set(pass, passInputData);

    return passInputData;
  }

  #cleanupCache() {
    for (const pass of this.bindGroupCache.keys()) {
      const { uniformBuffer } = this.bindGroupCache.get(pass);
      uniformBuffer.destroy()
    }

    this.bindGroupCache.clear();
  }

  /**
   * @param { number } width
   * @param { number } height
   */
  setTextureSize(width, height) {
    if (this.size[0] === width && this.size[1] === height) return;

    this.size = [width, height]
    this.#cleanupCache();
  }

  /**
   * @param { GPUCommandEncoder } commandEncoder
   * @param { GPUTextureView } inoutTextureView
   * @param { PassNumber } pass
   */
  processTexture(commandEncoder, inoutTextureView, pass = 0) {
    const isLastPass = pass === MAX_PASSES - 1;

    const { outputTexture, bindGroup } = this.#getInputBindGroup(pass, inoutTextureView);

    this.renderPassDescriptor.colorAttachments[0].view = isLastPass
      ? inoutTextureView
      : outputTexture;

    const rp = commandEncoder.beginRenderPass(this.renderPassDescriptor);
    rp.setPipeline(this.pipeline);
    rp.setBindGroup(0, bindGroup)
    rp.draw(3);
    rp.end();

    if (isLastPass) return;

    return this.processTexture(commandEncoder, inoutTextureView, pass + 1)
  }
}
