/**
  * @param { unknown } condition
  * @param { String } message
  */
export const assert = (condition, message) => {
	if (!condition) throw new Error(message)
}

/**
 * Joins multiple paths into a single path, normalizing slashes and resolving relative segments.
 *
 * @param  { ...string } paths
 * @returns { string }
 */
export const joinPaths = (...paths) => {
  return paths.join("/").replace(/\/+/g, "/").replace(/\/\.\//g, "/").replace(/\/[^/]+\/\.\./g, "/");
}

/**
 * Gets the folder path from a given file path.
 * @param { string } path
 */
export const getFolderPath = (path) => {
  const lastSlashIndex = path.lastIndexOf("/");
  if (lastSlashIndex === -1) {
    return "";
  }
  return path.substring(0, lastSlashIndex);
}

export const TO_RAD = 1 / 180 * Math.PI;
export const TO_DEG = 1 * 180 / Math.PI;
