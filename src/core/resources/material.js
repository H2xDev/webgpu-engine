import { Renderer } from "../renderer.js";
import { Layouts } from "../rendering/layouts.js";
import { Texture } from "./texture.js";

// TODO: Add UV scale and offset
// TODO: Add triplanar mapping support

/**
  * @typedef {Object} MaterialOptions
  * @property { Texture } albedo - The albedo texture of the material.
  * @property { Texture } normalMap - The normal map texture of the material.
  * @property { Texture } ormMap - The ORM (Occlusion, Roughness, Metallic) texture of the material.
  * @property { Texture } emissionMap - The emission texture of the material.
  * @property { number } normalScale - The scale factor for the normal map.
  * @property { number } metallic - The metallic property of the material.
  * @property { number } roughness - The roughness property of the material.
  * @property { Array<number> } albedoTint - The albedo tint color of the material.
  * @property { Array<number> } emissionTint - The emission tint color of the material.
  * @property { number } emissionEnergy - The emission energy of the material.
  * @property { number } [uvScale=1.0] - The scale factor for the UV coordinates of the material.
  * @property { Array<number> } [uvOffset=[0.0, 0.0]] - The offset for the UV coordinates of the material.
  * @property { number } flags - The flags for the material, used for various rendering options.
  */


export class Material {

  /** @type { Material } */
  static FALLBACK_MATERIAL

  /** @type { MaterialOptions } */
  static DEFAULT_MATERIAL_OPTIONS = {
    albedo: null,
    normalMap: null,
    ormMap: null,
    emissionMap: null,
    normalScale: 1.0,
    metallic: 0.0,
    roughness: 0.5,
    albedoTint: [1.0, 1.0, 1.0],
    emissionTint: [0.0, 0.0, 0.0],
    emissionEnergy: 1.0,
    flags: 0,
  };

  static Flags = {
    TRIPLANAR_MAPPING: 1 << 0,
    TRANSPARENT: 1 << 1,
  };

  /** @type { GPUDevice } */
  static device;

  /** @type { Texture } */
  albedo;

  /** @type { Texture } */
  normalMap;

  /** @type { Texture } */
  ormMap;

  /** @type { Texture } */
  emissionMap;

  /** @type { GPUBindGroup } */
  bindGroup;


  /** @type { GPUBuffer } */
  #uniformBuffer;

  #normalScale = 1.0;
  #metallic = 0.0;
  #roughness = 0.5;
  #albedoTint = [1.0, 1.0, 1.0];
  #emissionTint = [0.0, 0.0, 0.0];
  #emissionEnergy = 1.0;
  #uvScale = 1.0;
  #uvOffset = [0.0, 0.0];
  #flags = 0;

  get normalScale() {
    return this.#normalScale;
  }

  set normalScale(value) {
    this.#normalScale = value;
    Renderer.device.queue.writeBuffer(this.#uniformBuffer, 0, new Float32Array([value]));
  }

  get albedoTint() {
    return this.#albedoTint;
  }

  set albedoTint(value) {
    this.#albedoTint = value;
    Renderer.device.queue.writeBuffer(this.#uniformBuffer, 16, new Float32Array(value));
  }

  get metallic() {
    return this.#metallic;
  }

  set metallic(value) {
    this.#metallic = value;
    Renderer.device.queue.writeBuffer(this.#uniformBuffer, 28, new Float32Array([value]));
  }

  get roughness() {
    return this.#roughness;
  }

  set roughness(value) {
    this.#roughness = value;
    Renderer.device.queue.writeBuffer(this.#uniformBuffer, 32, new Float32Array([value]));
  }

  get emissionTint() {
    return this.#emissionTint;
  }

  set emissionTint(value) {
    this.#emissionTint = value;
    Renderer.device.queue.writeBuffer(this.#uniformBuffer, 48, new Float32Array(value));
  }

  get emissionEnergy() {
    return this.#emissionEnergy;
  }

  set emissionEnergy(value) {
    this.#emissionEnergy = value;
    Renderer.device.queue.writeBuffer(this.#uniformBuffer, 60, new Float32Array([value]));
  }

  get uvScale() {
    return this.#uvScale;
  }

  set uvScale(value) {
    this.#uvScale = value;
    Renderer.device.queue.writeBuffer(this.#uniformBuffer, 64, new Float32Array([value]));
  }

  get uvOffset() {
    return this.#uvOffset;
  }

  set uvOffset(value) {
    this.#uvOffset = value;
    Renderer.device.queue.writeBuffer(this.#uniformBuffer, 72, new Float32Array(value));
  }

  get flags() {
    return this.#flags;
  }

  set flags(value) {
    this.#flags = value;
    Renderer.device.queue.writeBuffer(this.#uniformBuffer, 80, new Uint32Array([value]));
  }

  /**
    * Initializes the fallback material for use when a material is missing or fails to load.
    *
    * @param { GPUDevice } device
    */
  static init(device) {
    Material.device = device;
    Material.FALLBACK_MATERIAL = new Material();
  }

  /**
    * @param { Partial<MaterialOptions> } options
    */
  constructor(options = {}) {
    const actualOptions = Object.assign({}, Material.DEFAULT_MATERIAL_OPTIONS, options);

    this.#validateOptions(actualOptions);
    this.#assignOptions(actualOptions);
    this.#initUniformBuffer();
    this.#initBindGroup();
  }


  duplicate() {
    return Object.assign(new Material(), {
      bindGroup: this.bindGroup,
      albedo: this.albedo,
      normalMap: this.normalMap,
      ormMap: this.ormMap,
      emissionMap: this.emissionMap,
      normalScale: this.#normalScale,
      metallic: this.#metallic,
      roughness: this.#roughness,
      albedoTint: [...this.#albedoTint],
      emissionTint: [...this.#emissionTint],
      emissionEnergy: this.#emissionEnergy,
    })
  }

  /**
    * Validates the provided material options and throws an error if any of the options are invalid.
    *
    * @param { Partial<MaterialOptions> } options
    */
  #validateOptions(options) {
    if (options.normalScale !== undefined && (typeof options.normalScale !== 'number' || options.normalScale < 0)) {
      throw new Error("Invalid normalScale value. It must be a non-negative number.");
    }

    if (options.metallic !== undefined && (typeof options.metallic !== 'number' || options.metallic < 0 || options.metallic > 1)) {
      throw new Error("Invalid metallic value. It must be a number between 0 and 1.");
    }

    if (options.roughness !== undefined && (typeof options.roughness !== 'number' || options.roughness < 0 || options.roughness > 1)) {
      throw new Error("Invalid roughness value. It must be a number between 0 and 1.");
    }

    if (options.albedoTint !== undefined && (!Array.isArray(options.albedoTint) || options.albedoTint.length !== 3 || !options.albedoTint.every(c => typeof c === 'number' && c >= 0 && c <= 1))) {
      throw new Error("Invalid albedoTint value. It must be an array of three numbers between 0 and 1.");
    }

    if (options.emissionTint !== undefined && (!Array.isArray(options.emissionTint) || options.emissionTint.length !== 3 || !options.emissionTint.every(c => typeof c === 'number' && c >= 0 && c <= 1))) {
      throw new Error("Invalid emissionTint value. It must be an array of three numbers between 0 and 1.");
    }

    if (options.emissionEnergy !== undefined && (typeof options.emissionEnergy !== 'number' || options.emissionEnergy < 0)) {
      throw new Error("Invalid emissionEnergy value. It must be a non-negative number.");
    }
  }

  /**
    * Assigns the provided material options to the material instance.
    *
    * @param { Partial<MaterialOptions> } options
    */
  #assignOptions(options) {
    if (options.albedo) this.albedo = options.albedo;
    if (options.normalMap) this.normalMap = options.normalMap;
    if (options.ormMap) this.ormMap = options.ormMap;
    if (options.emissionMap) this.emissionMap = options.emissionMap;
    if (options.normalScale !== undefined) this.#normalScale = options.normalScale;
    if (options.metallic !== undefined) this.#metallic = options.metallic;
    if (options.roughness !== undefined) this.#roughness = options.roughness;
    if (options.albedoTint !== undefined) this.#albedoTint = options.albedoTint;
    if (options.emissionTint !== undefined) this.#emissionTint = options.emissionTint;
    if (options.emissionEnergy !== undefined) this.#emissionEnergy = options.emissionEnergy;
    if (options.uvScale !== undefined) this.#uvScale = options.uvScale;
    if (options.uvOffset !== undefined) this.#uvOffset = options.uvOffset;
    if (options.flags !== undefined) this.#flags = options.flags;
  }

  #initBindGroup() {
    this.bindGroup = Material.device.createBindGroup({
      layout: Layouts.materialLayout,
      entries: [
        {
          binding: 0,
          resource: this.albedo
            ? this.albedo.sampler
            : Texture.DEFAULT_SAMPLER,
        },
        {
          binding: 1,
          resource: this.albedo
            ? this.albedo.view
            : Texture.WHITE_TEXTURE,
        },
        {
          binding: 2,
          resource: this.normalMap
            ? this.normalMap.view
            : Texture.NORMAL_TEXTURE,
        },
        {
          binding: 3,
          resource: this.ormMap
            ? this.ormMap.view
            : Texture.WHITE_TEXTURE,
        },
        {
          binding: 4,
          resource: this.emissionMap
            ? this.emissionMap.view
            : Texture.BLACK_TEXTURE,
        },
        {
          binding: 5,
          resource: {
            buffer: this.#uniformBuffer,
            offset: 0,
          },
        },
      ]
    });
  }

  #initUniformBuffer() {
    this.#uniformBuffer = Material.device.createBuffer({
      size: 128,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });


    Material.device.queue.writeBuffer(this.#uniformBuffer, 0, new Float32Array([this.#normalScale]));
    Material.device.queue.writeBuffer(this.#uniformBuffer, 16, new Float32Array(this.#albedoTint));
    Material.device.queue.writeBuffer(this.#uniformBuffer, 28, new Float32Array([this.#metallic]));
    Material.device.queue.writeBuffer(this.#uniformBuffer, 32, new Float32Array([this.#roughness]));
    Material.device.queue.writeBuffer(this.#uniformBuffer, 48, new Float32Array(this.#emissionTint));
    Material.device.queue.writeBuffer(this.#uniformBuffer, 60, new Float32Array([this.#emissionEnergy]));
    Material.device.queue.writeBuffer(this.#uniformBuffer, 64, new Float32Array([this.#uvScale]));
    Material.device.queue.writeBuffer(this.#uniformBuffer, 72, new Float32Array(this.#uvOffset));
    Material.device.queue.writeBuffer(this.#uniformBuffer, 80, new Uint32Array([this.#flags]));

    return this;
  }
}
