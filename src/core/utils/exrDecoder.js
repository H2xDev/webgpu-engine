/**
 * Minimal OpenEXR decoder: single-part scanline images with HALF/FLOAT/UINT channels
 * and NONE, RLE, ZIPS, ZIP or PIZ compression. Output is RGBA half-float data.
 */

const EXR_MAGIC = 20000630;

const Compression = { NONE: 0, RLE: 1, ZIPS: 2, ZIP: 3, PIZ: 4 };
const LINES_PER_BLOCK = { [Compression.NONE]: 1, [Compression.RLE]: 1, [Compression.ZIPS]: 1, [Compression.ZIP]: 16, [Compression.PIZ]: 32 };

const PixelType = { UINT: 0, HALF: 1, FLOAT: 2 };
const BYTES_PER_SAMPLE = { [PixelType.UINT]: 4, [PixelType.HALF]: 2, [PixelType.FLOAT]: 4 };

const HALF_ONE = 0x3c00;

const f32 = new Float32Array(1);
const u32 = new Uint32Array(f32.buffer);

/** @param { number } value */
const toHalf = (value) => {
  f32[0] = value;
  const x = u32[0];
  const sign = (x >>> 16) & 0x8000;
  const exp32 = (x >>> 23) & 0xff;
  let mantissa = x & 0x7fffff;

  if (exp32 === 0xff) return sign | 0x7c00 | (mantissa ? 0x200 : 0);

  const exp = exp32 - 127 + 15;
  if (exp >= 31) return sign | 0x7c00;

  if (exp <= 0) {
    if (exp < -10) return sign;
    mantissa |= 0x800000;
    const shift = 14 - exp;
    let half = mantissa >>> shift;
    if ((mantissa >>> (shift - 1)) & 1) half++;
    return sign | half;
  }

  let half = sign | (exp << 10) | (mantissa >>> 13);
  if (mantissa & 0x1000) half++;
  return half;
};

/** zlib stream inflate via the browser's DecompressionStream. */
const inflate = async (bytes) => {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

const rleDecode = (src, expected) => {
  const out = new Uint8Array(expected);
  let i = 0;
  let o = 0;
  while (i < src.length && o < expected) {
    const n = (src[i++] << 24) >> 24;
    if (n < 0) {
      for (let k = 0; k < -n; k++) out[o++] = src[i++];
    } else {
      const v = src[i++];
      for (let k = 0; k <= n; k++) out[o++] = v;
    }
  }
  return out;
};

/** Undoes the delta predictor and the even/odd byte split used by ZIP and RLE. */
const undoPredictor = (src) => {
  const n = src.length;
  for (let i = 1; i < n; i++) src[i] = src[i - 1] + src[i] - 128;

  const out = new Uint8Array(n);
  let t1 = 0;
  let t2 = (n + 1) >> 1;
  for (let s = 0; s < n;) {
    out[s++] = src[t1++];
    if (s < n) out[s++] = src[t2++];
  }
  return out;
};

const HUF_ENCSIZE = (1 << 16) + 1;
const HUF_DECBITS = 14;
const HUF_DECSIZE = 1 << HUF_DECBITS;
const HUF_DECMASK = HUF_DECSIZE - 1;

/**
 * @param { Uint8Array } src
 * @param { number } nRaw number of 16-bit values to decode
 */
const huffUncompress = (src, nRaw) => {
  const view = new DataView(src.buffer, src.byteOffset, src.byteLength);
  const im = view.getUint32(0, true);
  const iM = view.getUint32(4, true);
  const nBits = view.getUint32(12, true);
  let p = 20;

  if (im >= HUF_ENCSIZE || iM >= HUF_ENCSIZE) throw new Error('EXR: corrupt PIZ table');

  const lens = new Uint8Array(HUF_ENCSIZE);
  const codes = new Uint32Array(HUF_ENCSIZE);

  let c = 0;
  let lc = 0;
  const getBits = (n) => {
    while (lc < n) {
      c = (c << 8) | src[p++];
      lc += 8;
    }
    lc -= n;
    return (c >>> lc) & ((1 << n) - 1);
  };

  for (let i = im; i <= iM; i++) {
    const l = getBits(6);
    lens[i] = l;
    if (l >= 59) {
      let run = l === 63 ? getBits(8) + 6 : l - 59 + 2;
      if (i + run > iM + 1) throw new Error('EXR: corrupt PIZ table');
      while (run--) lens[i++] = 0;
      i--;
    }
  }

  // Canonical codes
  const n = new Array(59).fill(0);
  for (let i = 0; i < HUF_ENCSIZE; i++) n[lens[i]]++;
  let cc = 0;
  for (let i = 58; i >= 0; i--) {
    const nc = (cc + n[i]) >> 1;
    n[i] = cc;
    cc = nc;
  }
  for (let i = 0; i < HUF_ENCSIZE; i++) {
    if (lens[i] > 0) codes[i] = n[lens[i]]++;
  }

  // Decoding table: short codes by direct lookup, long codes by candidate list
  const decLen = new Uint8Array(HUF_DECSIZE);
  const decSym = new Int32Array(HUF_DECSIZE);
  const decLong = [];
  for (let i = im; i <= iM; i++) {
    const l = lens[i];
    const code = codes[i];
    if (l === 0) continue;
    if (code >>> l) throw new Error('EXR: corrupt PIZ table');

    if (l > HUF_DECBITS) {
      (decLong[code >>> (l - HUF_DECBITS)] ??= []).push(i);
    } else {
      const start = code << (HUF_DECBITS - l);
      const count = 1 << (HUF_DECBITS - l);
      for (let k = 0; k < count; k++) {
        decLen[start + k] = l;
        decSym[start + k] = i;
      }
    }
  }

  const out = new Uint16Array(nRaw);
  let o = 0;
  c = 0;
  lc = 0;
  const ie = p + ((nBits + 7) >> 3);

  const emit = (sym) => {
    if (sym === iM) {
      if (lc < 8) {
        c = (c << 8) | src[p++];
        lc += 8;
      }
      lc -= 8;
      const count = (c >>> lc) & 0xff;
      if (o + count > nRaw || o === 0) throw new Error('EXR: corrupt PIZ data');
      const prev = out[o - 1];
      for (let k = 0; k < count; k++) out[o++] = prev;
    } else if (o < nRaw) {
      out[o++] = sym;
    } else {
      throw new Error('EXR: corrupt PIZ data');
    }
  };

  while (p < ie) {
    c = (c << 8) | src[p++];
    lc += 8;

    while (lc >= HUF_DECBITS) {
      const idx = (c >>> (lc - HUF_DECBITS)) & HUF_DECMASK;
      if (decLen[idx]) {
        lc -= decLen[idx];
        emit(decSym[idx]);
        continue;
      }

      const candidates = decLong[idx];
      if (!candidates) throw new Error('EXR: corrupt PIZ data');
      let found = false;
      for (const sym of candidates) {
        const l = lens[sym];
        while (lc < l && p < ie) {
          c = (c << 8) | src[p++];
          lc += 8;
        }
        if (lc >= l && codes[sym] === ((c >>> (lc - l)) & ((1 << l) - 1))) {
          lc -= l;
          emit(sym);
          found = true;
          break;
        }
      }
      if (!found) throw new Error('EXR: corrupt PIZ data');
    }
  }

  const drop = (8 - nBits) & 7;
  c >>>= drop;
  lc -= drop;
  while (lc > 0) {
    const idx = (c << (HUF_DECBITS - lc)) & HUF_DECMASK;
    if (!decLen[idx]) throw new Error('EXR: corrupt PIZ data');
    lc -= decLen[idx];
    emit(decSym[idx]);
  }

  return out;
};

/** Applies a single inverse wavelet step to the pair (i, j) in place. */
const wdec = (buf, i, j, w14) => {
  const l = buf[i];
  const h = buf[j];
  if (w14) {
    const ls = (l << 16) >> 16;
    const hs = (h << 16) >> 16;
    const ai = ls + (hs & 1) + (hs >> 1);
    buf[i] = ai;
    buf[j] = ai - hs;
  } else {
    const bb = (l - (h >> 1)) & 0xffff;
    buf[j] = bb;
    buf[i] = (h + bb - 32768) & 0xffff;
  }
};

/** 2D inverse wavelet over a strided region starting at `base`. */
const wav2Decode = (buf, base, nx, ox, ny, oy, mx) => {
  const w14 = mx < (1 << 14);
  const n = Math.min(nx, ny);
  let p = 1;
  while (p <= n) p <<= 1;
  p >>= 1;
  let p2 = p;
  p >>= 1;

  while (p >= 1) {
    let py = base;
    const ey = base + oy * (ny - p2);
    const oy1 = oy * p;
    const oy2 = oy * p2;
    const ox1 = ox * p;
    const ox2 = ox * p2;

    for (; py <= ey; py += oy2) {
      let px = py;
      const ex = py + ox * (nx - p2);

      for (; px <= ex; px += ox2) {
        const p01 = px + ox1;
        const p10 = px + oy1;
        const p11 = p10 + ox1;

        wdec(buf, px, p10, w14);
        wdec(buf, p01, p11, w14);
        wdec(buf, px, p01, w14);
        wdec(buf, p10, p11, w14);
      }

      if (nx & p) wdec(buf, px, px + oy1, w14);
    }

    if (ny & p) {
      let px = py;
      const ex = py + ox * (nx - p2);
      for (; px <= ex; px += ox2) wdec(buf, px, px + ox1, w14);
    }

    p2 = p;
    p >>= 1;
  }
};

/**
 * @param { Uint8Array } src
 * @param { { pixelType: number }[] } channels
 * @param { number } width
 * @param { number } lines
 */
const pizDecode = (src, channels, width, lines) => {
  const view = new DataView(src.buffer, src.byteOffset, src.byteLength);
  let pos = 0;

  const minNonZero = view.getUint16(pos, true);
  const maxNonZero = view.getUint16(pos + 2, true);
  pos += 4;

  const bitmap = new Uint8Array(8192);
  if (minNonZero <= maxNonZero) {
    const size = maxNonZero - minNonZero + 1;
    bitmap.set(src.subarray(pos, pos + size), minNonZero);
    pos += size;
  }

  const lut = new Uint16Array(65536);
  let k = 0;
  for (let i = 0; i < 65536; i++) {
    if (i === 0 || (bitmap[i >> 3] & (1 << (i & 7)))) lut[k++] = i;
  }
  const maxValue = k - 1;

  const length = view.getUint32(pos, true);
  pos += 4;

  const layout = [];
  let total = 0;
  for (const channel of channels) {
    const size = channel.pixelType === PixelType.HALF ? 1 : 2;
    layout.push({ start: total, size });
    total += width * lines * size;
  }

  const tmp = huffUncompress(src.subarray(pos, pos + length), total);

  for (const { start, size } of layout) {
    for (let j = 0; j < size; j++) {
      wav2Decode(tmp, start + j, width, size, lines, width * size, maxValue);
    }
  }

  for (let i = 0; i < total; i++) tmp[i] = lut[tmp[i]];

  const out = new Uint16Array(total);
  const cursors = layout.map((l) => l.start);
  let o = 0;
  for (let y = 0; y < lines; y++) {
    for (let c = 0; c < layout.length; c++) {
      const n = width * layout[c].size;
      out.set(tmp.subarray(cursors[c], cursors[c] + n), o);
      cursors[c] += n;
      o += n;
    }
  }

  return new Uint8Array(out.buffer);
};

/**
 * @param { ArrayBuffer } buffer
 * @returns { Promise<{ width: number, height: number, data: Uint16Array }> } RGBA half-float pixels
 */
export const decodeExr = async (buffer) => {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  if (bytes.length < 8 || view.getUint32(0, true) !== EXR_MAGIC) throw new Error('Not a valid EXR file');

  const flags = view.getUint32(4, true);
  if (flags & 0x200) throw new Error('EXR: tiled images are not supported');
  if (flags & 0x800) throw new Error('EXR: deep images are not supported');
  if (flags & 0x1000) throw new Error('EXR: multipart files are not supported');

  let pos = 8;
  const readString = () => {
    let s = '';
    while (bytes[pos] !== 0) s += String.fromCharCode(bytes[pos++]);
    pos++;
    return s;
  };

  let channels = null;
  let compression = null;
  let window = null;

  while (true) {
    const name = readString();
    if (!name) break;
    readString();
    const size = view.getInt32(pos, true);
    pos += 4;
    const end = pos + size;

    if (name === 'channels') {
      channels = [];
      while (true) {
        const channelName = readString();
        if (!channelName) break;
        const pixelType = view.getInt32(pos, true);
        const xSampling = view.getInt32(pos + 8, true);
        const ySampling = view.getInt32(pos + 12, true);
        pos += 16;
        if (xSampling !== 1 || ySampling !== 1) throw new Error('EXR: subsampled channels are not supported');
        channels.push({ name: channelName, pixelType });
      }
    } else if (name === 'compression') {
      compression = bytes[pos];
    } else if (name === 'dataWindow') {
      window = [view.getInt32(pos, true), view.getInt32(pos + 4, true), view.getInt32(pos + 8, true), view.getInt32(pos + 12, true)];
    }

    pos = end;
  }

  if (!channels || compression === null || !window) throw new Error('EXR: missing required header attributes');
  if (!(compression in LINES_PER_BLOCK)) throw new Error(`EXR: unsupported compression type ${compression}`);

  const [xMin, yMin, xMax, yMax] = window;
  const width = xMax - xMin + 1;
  const height = yMax - yMin + 1;
  const linesPerBlock = LINES_PER_BLOCK[compression];
  const blockCount = Math.ceil(height / linesPerBlock);

  const channelOffsets = [];
  let lineBytes = 0;
  for (const channel of channels) {
    channelOffsets.push(lineBytes);
    lineBytes += width * BYTES_PER_SAMPLE[channel.pixelType];
  }

  // Map output components to channel indices; the last name segment handles "layer.R" style names.
  const find = (name) => channels.findIndex((c) => c.name.split('.').pop() === name);
  const luminance = find('Y');
  const components = ['R', 'G', 'B', 'A'].map((name, i) => {
    const index = find(name);
    return index >= 0 ? index : (i < 3 ? luminance : -1);
  });
  if (components.slice(0, 3).some((index) => index < 0)) throw new Error('EXR: no RGB or luminance channels found');

  const data = new Uint16Array(width * height * 4);
  for (let i = 3; i < data.length; i += 4) data[i] = HALF_ONE;

  const tableStart = pos;
  for (let b = 0; b < blockCount; b++) {
    const offset = view.getUint32(tableStart + b * 8, true);
    const y = view.getInt32(offset, true);
    const size = view.getUint32(offset + 4, true);
    const lines = Math.min(linesPerBlock, yMax - y + 1);
    const expected = lines * lineBytes;
    const raw = bytes.subarray(offset + 8, offset + 8 + size);

    let block;
    if (size === expected) {
      block = raw;
    } else if (compression === Compression.RLE) {
      block = undoPredictor(rleDecode(raw, expected));
    } else if (compression === Compression.ZIP || compression === Compression.ZIPS) {
      block = undoPredictor(await inflate(raw));
    } else {
      block = pizDecode(raw, channels, width, lines);
    }

    const blockView = new DataView(block.buffer, block.byteOffset, block.byteLength);
    for (let l = 0; l < lines; l++) {
      const rowStart = l * lineBytes;
      const outRow = (y - yMin + l) * width * 4;

      for (let comp = 0; comp < 4; comp++) {
        const ci = components[comp];
        if (ci < 0) continue;

        const { pixelType } = channels[ci];
        const base = rowStart + channelOffsets[ci];
        for (let x = 0; x < width; x++) {
          let value;
          if (pixelType === PixelType.HALF) value = blockView.getUint16(base + x * 2, true);
          else if (pixelType === PixelType.FLOAT) value = toHalf(blockView.getFloat32(base + x * 4, true));
          else value = toHalf(blockView.getUint32(base + x * 4, true));
          data[outRow + x * 4 + comp] = value;
        }
      }
    }
  }

  return { width, height, data };
};
