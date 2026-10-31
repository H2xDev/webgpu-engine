import { Entity3D } from "@core/nodes";

export class LevelGenerator extends Entity3D {
  width = 10;
  depth = 10;

  /**
   * Generates a grid of column heights: walls on the border, a few pillars inside.
   * @param { number } maxHeight
   * @param { number } pillarChance
   */
  generate(maxHeight = 4, pillarChance = 0.08) {
    const { width, depth } = this;
    const result = new Array(width * depth).fill(0);

    for (let z = 0; z < depth; z++)
    for (let x = 0; x < width; x++) {
      const isBorder = false
        || x === 0
        || z === 0
        || x === width - 1
        || z === depth - 1;

      if (isBorder) {
        result[z * width + x] = Math.random() < 0.7 ? 1 : 1 + Math.floor(Math.random() * maxHeight);
      } else if (Math.random() < pillarChance) {
        result[z * width + x] = 1 + Math.floor(Math.random() * 2);
      }
    }

    return result;
  }
}
