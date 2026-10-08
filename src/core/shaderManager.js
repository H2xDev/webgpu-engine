export const ShaderManager = new class ShaderManager {
  /** @type { Map<string, Promise<String>> } */
  cache = new Map()

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
    return this
      .import(path)
      .then(code => device.createShaderModule({ code }))
  }
}
