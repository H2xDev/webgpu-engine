export const ShaderManager = new class ShaderManager {
  /** @type { Map<string, Promise<String>> } */
  cache = new Map()

  /** @type { Map<string, Promise<GPUShaderModule>> } */
  moduleCache = new Map()

  /**
    * Imports a shader source code
    *
    * @param { String } path */
  async import(path) {
    if (this.cache.has(path)) {
      return this.cache.get(path)
    }

    const promise = fetch("/src/" + path + ".wgsl")
      .then(type => type.text())

    this.cache.set(path, promise);

    return promise;
  }

  /**
    * Creates a shader module from the path
    *
    * @param { String } path
    * @param { GPUDevice } device
    */
  async createModule(path, device) {
    if (this.moduleCache.has(path)) {
      return this.moduleCache.get(path)
    }

    const promise = this
      .import(path)
      .then(code => device.createShaderModule({ code }))

    this.moduleCache.set(path, promise);

    return promise;
  }
}
