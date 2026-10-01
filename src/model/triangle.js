import { mat4 } from '../gl-matrix/index.js';
import { Entity3D } from './entity_3d.js';

export class Triangle extends Entity3D {
  constructor() {
    super();
    mat4.scale(this.transform, this.transform, [4, 4, 4]);
  }
}
