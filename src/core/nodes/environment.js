import { EnvironmentRenderPass } from "../rendering/environmentRenderPass.js";
import { Texture } from "../resources/texture.js";
import { Layouts } from "../rendering/layouts.js";
import { IrradianceMapGenerator } from "../utils/irradianceMapGenerator.js";
import { Entity3D } from "./entity3d.js";

export class Environment extends Entity3D {
  /** @type { Environment | null } */
  static current;

  /** @type { Texture } */
  panoramaTexture;

  /** @type { GPUTextureView } */
  irradianceMapView;

  /** @type { GPUTexture } */
  irradianceMap;

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
    super();

    this.panoramaTexture = panoramaTexture;
    this.energy = this.#energy;
    this.#initIrradianceMap();
    this.#initBindGroup();
  }

  /**
    * Creates an Environment instance from a texture path.
    *
    * @param { string } path
    * @returns { Promise<Environment> }
    */
  static async createFromTexture(path) {
    return Texture.load(path).then(texture => new Environment(texture));
  }

  enterTree() {
    Environment.current = this;
  }

  #initIrradianceMap() {
    this.irradianceMap = IrradianceMapGenerator.generate(this.panoramaTexture.texture.createView());
    this.irradianceMapView = this.irradianceMap.createView();
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
          resource: EnvironmentRenderPass.instance.device.createSampler({
            addressModeU: 'repeat',
            addressModeV: 'clamp-to-edge',
            magFilter: 'linear',
            minFilter: 'linear',
            mipmapFilter: 'linear',
          })
        },
        {
          binding: 2,
          resource: this.irradianceMapView,
        },
        {
          binding: 3,
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
