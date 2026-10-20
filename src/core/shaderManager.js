import { getFolderPath, joinPaths } from "./utils.js";

const INCLUDE_REGEX = /#include\s+"(.+)"/i;

class ShaderPreprocessorError extends Error {
  constructor(message, lineNumber) {
    super(`Shader Preprocessor Error (Line ${lineNumber}): ${message}`);
    this.name = "ShaderPreprocessorError";
  }
}

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

    const sourcePath = joinPaths("/", path + ".wgsl")

    const promise = fetch(sourcePath)
      .then(type => type.text())
      .then(this.#processShaderSource.bind(this, getFolderPath(sourcePath)));

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

  /**
   * Does a pre-processing pass on the shader source code to handle directives.
   * Directives supported:
   * - #include "/path/to/shader" or #include "relative/path/to/shader"
   *
   * @param { String } basePath - The base path to resolve relative includes against.
   * @param { String } source - The shader source code to process.
   */
  async #processShaderSource(basePath = "", source) {
    const lines = source.split("\n");
    const processedLines = [];
    let lineNumber = 0;

    if (!source.includes("#include")) {
      return source;
    }

    for (let line of lines) {
      const trimmedLine = line.trim();
      lineNumber += 1;

      if (line.startsWith("#include")) {
        let includePath = trimmedLine.match(INCLUDE_REGEX)?.[1];

        if (!includePath) {
          throw new ShaderPreprocessorError(`Invalid #include directive: ${line}`, lineNumber);
        }

        const isAbsolutePath = includePath.startsWith("/");
        includePath = isAbsolutePath
          ? includePath
          : joinPaths(basePath, includePath);

        const includeSource = await this.import(includePath);
        processedLines.push(includeSource);
      } else {
        processedLines.push(line);
      }
    }

    return processedLines.join("\n");
  }
}
