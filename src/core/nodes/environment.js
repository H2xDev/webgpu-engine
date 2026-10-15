import { EnvironmentRenderPass } from "../rendering/environmentRenderPass.js";
import { Texture } from "../resources/texture.js";
import { Layouts } from "../rendering/layouts.js";

export class Environment {
  /** @type { Environment | null } */
  static current;

  /** @type { Texture } */
  panoramaTexture;
  #energy = 1.0;

  get energy() {
    return this.#energy;
  }

  set energy(value) {
    this.#energy = value;
    EnvironmentRenderPass.instance.device.queue.writeBuffer(
      EnvironmentRenderPass.instance.uniformBuffer,
      192,
      new Float32Array([value])
    );
  }

  /** @type { GPUBindGroup | null } */
  bindGroup = null;

  /** @param { Texture } panoramaTexture */
  constructor(panoramaTexture) {
    if (!Environment.current) {
      Environment.current = this;
    }

    this.panoramaTexture = panoramaTexture;
    this.#initBindGroup();
    this.energy = 1.0;
  }

  #initBindGroup() {
    this.bindGroup = EnvironmentRenderPass.instance.device.createBindGroup({
      layout: Layouts.environmentLayout,
      entries: [
        {
          binding: 0,
          resource: this.panoramaTexture.texture.createView(),
        },
        {
          binding: 1,
          resource: this.panoramaTexture.sampler,
        },
        {
          binding: 2,
          resource: {
            buffer: EnvironmentRenderPass.instance.uniformBuffer,
            offset: 0,
            size: EnvironmentRenderPass.instance.uniformBuffer.size
          },
        },
      ],
    });
  }
}
