import { Entity3D, MeshInstance, Camera3D, Tween } from '@core';
import { BoxMesh } from '../core/resources/boxMesh.js';
import { InputController } from '../core/inputController.js';
import { MaterialManager } from './materialManager.js';

const ROLL_DURATION = 0.3;

// Camera-relative screen direction snapped to a grid axis, as [x, z].
function snapToAxis(v) {
  if (Math.abs(v[0]) >= Math.abs(v[2])) return [Math.sign(v[0]), 0];
  return [0, Math.sign(v[2])];
}

export class Player extends Entity3D {
  meshInstance;

  /** @type { [number, number] } */
  cell = [0, 0];

  baseY = 0;

  /** @type { { cells: number[], width: number, depth: number } | null } */
  level = null;

  /** @type { { target: [number, number], pivot: number[], axis: number[], elapsed: number, startTransform: Transform } | null } */
  roll = null;

  ready = false;

  constructor() {
    super()
    this.meshInstance = this.addChild(new MeshInstance(
      new BoxMesh({
        size: [1, 1, 1],
        bevel: 0.05,
        bevelSegments: 0,
        material: MaterialManager.get("ground-notrip"),
      })
    ));

    // The mesh is centered on the entity; the entity sits at the cube's center while rolling.
    this.meshInstance.transform.origin = [0, 10, 0];

    Tween
      .property(this.meshInstance.transform, "origin", [0.0, 0.0, 0.0], 3000, "easeOutCirc")
      .then(() => this.ready = true);


    this.placeAt(0, 0, 0);
  }

  /**
   * @param { number[] } cells
   * @param { number } width
   * @param { number } depth
   */
  setLevel(cells, width, depth) {
    this.level = { cells, width, depth };
  }

  /**
   * @param { number } x
   * @param { number } z
   * @param { number } y  Floor height the cube rests on.
   */
  placeAt(x, z, y) {
    this.baseY = y;
    this.cell = [x, z];
    this.roll = null;
    this.transform.origin = [x + 0.5, y + 0.5, z + 0.5];
  }

  /**
   * @param { [number, number] } cell
   */
  isWalkable([x, z]) {
    if (!this.level) return true;

    const { cells, width, depth } = this.level;
    if (x < 0 || z < 0 || x >= width || z >= depth) return false;
    return cells[z * width + x] === 0;
  }

  /**
   * Grid directions for W/A/S/D, relative to the camera's view.
   * @returns { { key: string, dir: [number, number] }[] }
   */
  getKeyDirections() {
    const camera = Camera3D.current;
    const f = camera ? [...camera.globalTransform.forward] : [0, 0, -1];
    f[1] = 0;

    const forward = snapToAxis(f);
    const right = [-forward[1], forward[0]];

    return [
      { key: 'KeyW', dir: forward },
      { key: 'KeyS', dir: [-forward[0], -forward[1]] },
      { key: 'KeyD', dir: right },
      { key: 'KeyA', dir: [-right[0], -right[1]] },
    ];
  }

  /**
   * Starts rolling the cube one tile in direction [dx, dz] around its bottom edge.
   * @param { [number, number] } dir
   */
  startRoll([dx, dz]) {
    const [cx, cz] = this.cell;

    this.roll = {
      target: [cx + dx, cz + dz],
      pivot: [cx + 0.5 + dx * 0.5, this.baseY, cz + 0.5 + dz * 0.5],
      axis: [dz, 0, -dx],
      elapsed: 0,
      startTransform: this.transform.duplicate(),
    };

    this.applyRoll(0);
  }

  /**
   * @param { number } t  Roll progress in [0, 1].
   */
  applyRoll(t) {
    const { startTransform, pivot, axis } = this.roll;
    this.transform.copy(startTransform).rotateAround(pivot, axis, t * Math.PI / 2);
  }

  /**
   * @param { number } dt
   */
  update(dt) {
    if (!this.ready) return super.update(dt);

    if (this.roll) {
      this.roll.elapsed += dt;
      const t = this.roll.elapsed / ROLL_DURATION;

      if (t < 1) {
        this.applyRoll(t);
      } else {
        this.applyRoll(1);
        this.cell = this.roll.target;
        this.roll = null;
        this.placeAt(this.cell[0], this.cell[1], this.baseY);
      }
    }

    if (!this.roll) {
      for (const { key, dir } of this.getKeyDirections()) {
        if (!InputController.is_key_pressed(key)) continue;

        const target = [this.cell[0] + dir[0], this.cell[1] + dir[1]];
        if (!this.isWalkable(target)) continue;

        this.startRoll(dir);
        break;
      }
    }
  }
}
