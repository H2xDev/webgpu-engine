import { Entity3D, MeshInstance, Material, Tween } from '@core';
import { BoxMesh } from '../core/resources/boxMesh.js';
import { Sfx } from './sfx.js';

const FREE = 0;
const WALL = 1;
const DOOR = 2;
const LOCK = 3;
const PIT = 4;

/*
 * '#' wall        'S' start       'G' goal
 * 'k' key         'L' lock (consumes one key when you roll into it)
 * 'o' crate       (pushed by rolling into it; needs a free cell behind it)
 * 'p' 'q' 'r' plates   'P' 'Q' 'R' doors open only while a crate or the cube stands on the matching plate
 * '~' crumbling tile (collapses into a pit once you step off it)
 * '1'-'9' teleporter pairs (two pads sharing a digit are linked)
 * Press R to restart.
 */
export const FIRST_LAYOUT = [
  '#################',
  '#S...#.....P~~~1#',
  '#....#.....######',
  '#....#..o..######',
  '#....L.....#1...#',
  '#....#.....#....#',
  '#....#.....#....#',
  '#k...#..p..#...G#',
  '#################',
];

const WALL_HEIGHT = 1.5;
const DOOR_MS = 600;
const PUSH_MS = 220;
const NEXT_LEVEL_DELAY_MS = 1800;

export class PuzzleLevel extends Entity3D {
  /** Collision grid shared with the player: 0 = free, non-zero = blocked. */
  cells = [];
  width = 0;
  depth = 0;

  /** Called once, shortly after the goal is reached. */
  onSolved = null;

  start = [1, 1];
  goal = [0, 0];
  solved = false;
  keys = 0;
  lastCell = null;

  /** @type { Map<string, MeshInstance> } crates by "x,z" */
  crates = new Map();

  /** @type { Map<string, MeshInstance> } uncollected keys by "x,z" */
  keyItems = new Map();

  /** @type { Map<string, MeshInstance> } locks by "x,z" */
  locks = new Map();

  /** @type { Map<string, MeshInstance> } crumbling tiles by "x,z" */
  crumbles = new Map();

  /** @type { Record<string, number[][]> } teleporter pads by digit */
  teleporters = {};

  /** @type { { cell: number[], key: string }[] } */
  plates = [];

  /** @type { { cell: number[], key: string, mesh: MeshInstance, open: boolean }[] } */
  plateDoors = [];

  /** Cells a crate must never be pushed onto. */
  special = new Set();

  /**
   * @param { import('./player.js').Player } player
   * @param { string[] } layout
   */
  constructor(player, layout = FIRST_LAYOUT) {
    super();
    this.player = player;
    this.width = layout[0].length;
    this.depth = layout.length;
    this.cells = new Array(this.width * this.depth).fill(FREE);

    const mat = (albedoTint) => new Material({ albedoTint, roughness: 0.7, metallic: 0.0 });
    const wallMaterial = mat([0.55, 0.55, 0.6]);
    const goalMaterial = mat([0.3, 0.9, 0.4]);
    const crateMaterial = mat([0.6, 0.4, 0.2]);
    const keyMaterial = mat([1.0, 0.9, 0.2]);
    const lockMaterial = mat([0.8, 0.7, 0.1]);
    const plateMaterial = mat([0.2, 0.6, 0.9]);
    const plateDoorMaterial = mat([0.2, 0.45, 0.8]);
    const crumbleMaterial = mat([0.75, 0.65, 0.5]);
    const teleMaterial = mat([0.8, 0.3, 0.9]);

    for (let z = 0; z < this.depth; z++) {
      for (let x = 0; x < this.width; x++) {
        const ch = layout[z][x];
        const index = z * this.width + x;
        const id = `${x},${z}`;
        const tall = [1, WALL_HEIGHT, 1];

        switch (ch) {
          case '#':
            this.cells[index] = WALL;
            const mi = this.#box(x, z, tall, 0.125, wallMaterial);
            mi.transform.scale = [1, 0.25, 1];
            break;
          case 'S': this.start = [x, z]; break;
          case 'G':
            this.goal = [x, z];
            this.#box(x, z, [0.8, 0.1, 0.8], 0.05, goalMaterial);
            break;
          case 'o':
            this.crates.set(id, this.#box(x, z, [0.9, 0.9, 0.9], 0.45, crateMaterial));
            break;
          case 'k':
            this.special.add(id);
            this.keyItems.set(id, this.#box(x, z, [0.3, 0.3, 0.3], 0.5, keyMaterial));
            break;
          case 'L':
            this.cells[index] = LOCK;
            this.special.add(id);
            this.locks.set(id, this.#box(x, z, tall, WALL_HEIGHT / 2, lockMaterial));
            break;
          case 'p': case 'q': case 'r':
            this.plates.push({ cell: [x, z], key: ch });
            this.#box(x, z, [0.8, 0.1, 0.8], 0.05, plateMaterial);
            break;
          case 'P': case 'Q': case 'R':
            this.cells[index] = DOOR;
            this.special.add(id);
            this.plateDoors.push({ cell: [x, z], key: ch.toLowerCase(), open: false, mesh: this.#box(x, z, tall, WALL_HEIGHT / 2, plateDoorMaterial) });
            break;
          case '~':
            this.special.add(id);
            this.crumbles.set(id, this.#box(x, z, [0.95, 0.1, 0.95], 0.05, crumbleMaterial));
            break;
          default:
            if (ch >= '1' && ch <= '9') {
              this.special.add(id);
              (this.teleporters[ch] ??= []).push([x, z]);
              this.#box(x, z, [0.8, 0.1, 0.8], 0.05, teleMaterial);
            }
            break;
        }
      }
    }

    player.setLevel(this.cells, this.width, this.depth);
    player.placeAt(this.start[0], this.start[1], 0);
    player.canMove = (target, dir) => this.#canMove(target, dir);
    player.onLand = () => this.#settle();
  }

  #box(x, z, size, y, material) {
    const mesh = this.addChild(new MeshInstance(new BoxMesh({ size, material, bevel: 0.05 })));
    mesh.transform.origin = [x + 0.5, y, z + 0.5];
    return mesh;
  }

  #slide(mesh, x, y, z, ms) {
    Tween.property(mesh.transform, 'origin', [x + 0.5, y, z + 0.5], ms, 'easeOutCirc');
  }

  #canMove(target, dir) {
    const [x, z] = target;
    const id = `${x},${z}`;
    const index = z * this.width + x;

    if (this.cells[index] === LOCK) {
      if (this.keys <= 0) return false;
      this.keys--;
      this.cells[index] = FREE;
      this.#slide(this.locks.get(id), x, -WALL_HEIGHT / 2 - 0.01, z, DOOR_MS);
      Sfx.unlock();
      return true;
    }

    if (!this.player.isWalkable(target)) return false;

    const crate = this.crates.get(id);
    if (crate) {
      const bx = x + dir[0];
      const bz = z + dir[1];
      const behind = `${bx},${bz}`;

      if (!this.player.isWalkable([bx, bz]) || this.crates.has(behind) || this.special.has(behind)) return false;

      this.crates.delete(id);
      this.crates.set(behind, crate);
      this.#slide(crate, bx, 0.45, bz, PUSH_MS);
      Sfx.push();
    }

    return true;
  }

  #setDoor(door, open) {
    door.open = open;
    const [x, z] = door.cell;
    this.cells[z * this.width + x] = open ? FREE : DOOR;
    this.#slide(door.mesh, x, open ? -WALL_HEIGHT / 2 - 0.01 : WALL_HEIGHT / 2, z, DOOR_MS);
    Sfx.plate();
    open ? Sfx.doorOpen() : Sfx.doorClose();
  }

  #updatePlates() {
    const [px, pz] = this.player.cell;
    const pressedKeys = new Set(
      this.plates
        .filter(({ cell: [x, z] }) => this.crates.has(`${x},${z}`) || (x === px && z === pz))
        .map(({ key }) => key));

    for (const door of this.plateDoors) {
      const pressed = pressedKeys.has(door.key);
      if (door.open !== pressed) this.#setDoor(door, pressed);
    }
  }

  #onEnterCell(px, pz, prev) {
    const id = `${px},${pz}`;

    if (prev) {
      const prevId = `${prev[0]},${prev[1]}`;
      const tile = this.crumbles.get(prevId);
      if (tile) {
        this.crumbles.delete(prevId);
        this.cells[prev[1] * this.width + prev[0]] = PIT;
        this.#slide(tile, prev[0], -0.4, prev[1], DOOR_MS);
        Sfx.crumble();
      }
    }

    const keyItem = this.keyItems.get(id);
    if (keyItem) {
      this.keyItems.delete(id);
      this.keys++;
      this.#slide(keyItem, px, -1, pz, 300);
      Sfx.pickup();
    }

    for (const pads of Object.values(this.teleporters)) {
      const i = pads.findIndex(([x, z]) => x === px && z === pz);
      if (i < 0) continue;

      const [dx, dz] = pads[(i + 1) % pads.length];
      this.player.placeAt(dx, dz, 0);
      this.lastCell = [dx, dz];
      Sfx.teleport();
      return;
    }
  }

  /** @param { number } _dt */
  update(_dt) {
    const { player } = this;
    if (!player.ready) return;

    this.#updatePlates();
    if (!player.roll) this.#settle();
  }

  /** Handles the cube arriving on a new cell (guarded, so it runs once per cell). */
  #settle() {
    const { player } = this;
    const [px, pz] = player.cell;
    if (this.lastCell && this.lastCell[0] === px && this.lastCell[1] === pz) return;

    const prev = this.lastCell;
    this.lastCell = [px, pz];
    Sfx.step();
    this.#onEnterCell(px, pz, prev);

    const [cx, cz] = player.cell;
    if (!this.solved && cx === this.goal[0] && cz === this.goal[1]) {
      this.solved = true;
      Sfx.win();
      console.info('Puzzle solved!');
      setTimeout(() => {
        if (this.isInsideTree) this.onSolved?.();
      }, NEXT_LEVEL_DELAY_MS);
    }
  }
}
