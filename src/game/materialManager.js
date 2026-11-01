import { Material } from '@core';


/**
  * @typedef { Array } Textures
  * @property { Texture } albedo - The albedo texture of the material.
  * @property { Texture } normal - The normal map texture of the material.
  * @property { Texture } metallicRoughness - The metallic-roughness texture of the material.
  * @property { Texture } emissive - The emissive texture of the material.
  */

export const MaterialManager = new class MaterialManager {
  #materials = new Map();

  /** @type { Material } */
  static fallbackMaterial;

  static init() {
    if (!MaterialManager.fallbackMaterial) {
      MaterialManager.fallbackMaterial = new Material({
        albedoTint: [1.0, 1.0, 1.0],
        metallic: 0.0,
        roughness: 1.0,
      });
    }
  }

  /**
    * Creates a new material with the given properties.
    * If a material with the same properties already exists, it returns the existing one.
    *
    * @param { string } name - The name of the material.
    * @param { ConstructorParameters<typeof Material>[0] } properties - The properties of the material.
    * @returns { Material } - The created or existing material.
    */
  createMaterial(name, properties) {
    if (this.#materials.has(name)) {
      return this.#materials.get(name);
    }

    const material = new Material(properties);
    this.#materials.set(name, material);
    return material;
  }

  /**
   * Retrieves a material by its name.
   *
   * @param { string } name - The name of the material to retrieve.
   * @returns { Material | undefined } - The material with the given name, or undefined if not found.
   */
  get(name) {
    return this.#materials.get(name) ?? MaterialManager.fallbackMaterial;
  }
};
