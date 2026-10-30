export class AABB {
  min = [Infinity, Infinity, Infinity]
  max = [-Infinity, -Infinity, -Infinity];

  /**
   * Expands the AABB to include the given point.
   * @param { [number, number, number] } point
   */
  expand(point) {
    for (let i = 0; i < 3; i++) {
      this.min[i] = Math.min(this.min[i], point[i]);
      this.max[i] = Math.max(this.max[i], point[i]);
    }
  }

  getCenter() {
    return [
      (this.min[0] + this.max[0]) / 2,
      (this.min[1] + this.max[1]) / 2,
      (this.min[2] + this.max[2]) / 2,
    ];
  }

  getSize() {
    return [
      this.max[0] - this.min[0],
      this.max[1] - this.min[1],
      this.max[2] - this.min[2],
    ];
  }
}
