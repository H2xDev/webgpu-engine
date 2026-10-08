import { Renderer } from "../renderer.js";
import { Texture } from "./texture.js";

export class Material {
  /** @type { Texture } */
  albedo;

  /** @type { GPUBindGroup } */
  bindGroup;

  /** @param { Texture } texture */
  init(texture) {
    this.albedo = texture;

    this.bindGroup = Renderer.device.createBindGroup({
      layout: Renderer.materialBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: this.albedo.texture.createView(),
        },
        {
          binding: 1,
          resource: this.albedo.sampler,
        }
      ]
    });

    return this;
  }
}
