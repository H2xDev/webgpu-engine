const HEIGHT = 9; // rows 0 and 8 are border, 1..7 are playable
const TOP = 1;
const BOTTOM = HEIGHT - 2;
const PLATE_KEYS = ['p', 'q', 'r'];

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Builds a chain of rooms. Every room ends in a divider wall with one gate that needs an element solved
 * inside that room, so the level is always completable by going left to right:
 *  - lock:    pick up a key in the room, then roll into the lock.
 *  - plate:   push a crate down its column onto the plate to open the door.
 *  - crumble: the gap is a crumbling tile (one-way, nothing needed behind it).
 *  - tele:    the divider is solid; step on a pad to appear on the matching pad in the next room.
 *
 * @param { number } seed
 * @param { number } rooms
 * @returns { string[] } Layout rows, using the characters documented in puzzleLevel.js.
 */
export function generateLayout(seed, rooms) {
  const rng = mulberry32(seed);
  const int = (a, b) => a + Math.floor(rng() * (b - a + 1));

  const widths = Array.from({ length: rooms }, () => int(4, 6));
  const xs = [];
  let width = 1;
  for (const w of widths) {
    xs.push(width);
    width += w + 1;
  }

  const grid = Array.from({ length: HEIGHT }, () => new Array(width).fill('#'));
  widths.forEach((w, i) => {
    for (let z = TOP; z <= BOTTOM; z++)
    for (let x = xs[i]; x < xs[i] + w; x++) grid[z][x] = '.';
  });

  let plateCount = 0;
  let teleCount = 0;
  const gateTypes = [];
  for (let i = 0; i < rooms - 1; i++) {
    const options = ['lock', 'crumble', 'tele'];
    if (plateCount < PLATE_KEYS.length) options.push('plate', 'plate');
    const type = options[int(0, options.length - 1)];

    if (type === 'plate') plateCount++;
    gateTypes.push(type);
  }

  const used = new Set();
  const mark = (x, z) => used.add(`${x},${z}`);
  const isUsed = (x, z) => used.has(`${x},${z}`);

  const freeCell = (i) => {
    const cells = [];
    for (let z = TOP; z <= BOTTOM; z++)
    for (let x = xs[i]; x < xs[i] + widths[i]; x++) if (!isUsed(x, z)) cells.push([x, z]);
    return cells[int(0, cells.length - 1)];
  };

  let entry = [xs[0], int(TOP, BOTTOM)];
  let plateIndex = 0;
  let teleDigit = 1;

  for (let i = 0; i < rooms; i++) {
    const x0 = xs[i];
    const xe = x0 + widths[i];
    mark(...entry);

    if (i === 0) grid[entry[1]][entry[0]] = 'S';

    if (i === rooms - 1) {
      // Goal on the far side of the last room.
      const candidates = [];
      for (let z = TOP; z <= BOTTOM; z++) if (!isUsed(xe - 1, z)) candidates.push(z);
      grid[candidates[int(0, candidates.length - 1)]][xe - 1] = 'G';
      break;
    }

    const type = gateTypes[i];
    const gateRow = int(TOP, BOTTOM);
    mark(xe - 1, gateRow);

    let nextEntry = [xs[i + 1], gateRow];

    if (type === 'lock') {
      grid[gateRow][xe] = 'L';
      const [kx, kz] = freeCell(i);
      grid[kz][kx] = 'k';
    } else if (type === 'crumble') {
      grid[gateRow][xe] = '~';
    } else if (type === 'plate') {
      const key = PLATE_KEYS[plateIndex++];
      grid[gateRow][xe] = key.toUpperCase();

      // Crate column keeps its whole push path clear and never touches the entry or gate approach.
      let cx, cr;
      do {
        cx = int(x0 + 1, xe - 2);
        cr = int(TOP + 1, BOTTOM - 2);
      } while (entry[0] === cx && entry[1] >= cr - 1);

      for (let z = cr - 1; z <= BOTTOM; z++) mark(cx, z);
      grid[cr][cx] = 'o';
      grid[BOTTOM][cx] = key;
    } else {
      const digit = String(teleDigit++);
      const [ax, az] = freeCell(i);
      grid[az][ax] = digit;

      // The next room is entered by teleporting, so the divider stays solid.
      const next = i + 1;
      const bx = int(xs[next], xs[next] + widths[next] - 1);
      const bz = int(TOP, BOTTOM);
      grid[bz][bx] = digit;
      nextEntry = [bx, bz];
    }

    entry = nextEntry;
  }

  return grid.map((row) => row.join(''));
}
