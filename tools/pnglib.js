'use strict';
/**
 * Minimal dependency-free PNG decoder/encoder.
 * Decodes to RGBA8 (8 bits per channel, non-premultiplied).
 * Supports colour types 0/2/3/4/6 at bit depths 8/16 (and 1/2/4 for grey/palette).
 */
const fs = require('fs');
const zlib = require('zlib');

/* ---------------- CRC32 ---------------- */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/* ---------------- decode ---------------- */
const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function readChunks(buf) {
  if (buf.length < 8) throw new Error('not a png: too short');
  if (buf.readUInt32BE(0) !== 0x89504e47 || buf.readUInt32BE(4) !== 0x0d0a1a0a) {
    throw new Error('bad png signature');
  }
  const chunks = [];
  let off = 8;
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('latin1', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    const crc = buf.readUInt32BE(off + 8 + len);
    const calc = crc32(buf.subarray(off + 4, off + 8 + len));
    chunks.push({ type, data, crcOk: crc === calc });
    off += 12 + len;
    if (type === 'IEND') break;
  }
  return chunks;
}

function decode(file) {
  const buf = fs.readFileSync(file);
  const chunks = readChunks(buf);
  const ihdr = chunks.find((c) => c.type === 'IHDR');
  if (!ihdr) throw new Error('missing IHDR');
  const width = ihdr.data.readUInt32BE(0);
  const height = ihdr.data.readUInt32BE(4);
  const depth = ihdr.data[8];
  const colorType = ihdr.data[9];
  const interlace = ihdr.data[12];
  if (interlace !== 0) throw new Error('interlaced png not supported');
  const channels = CHANNELS[colorType];
  if (!channels) throw new Error('unsupported colour type ' + colorType);
  if (![1, 2, 4, 8, 16].includes(depth)) throw new Error('unsupported bit depth ' + depth);
  if (depth < 8 && colorType !== 0 && colorType !== 3) {
    throw new Error('unsupported depth/colourType combo ' + depth + '/' + colorType);
  }

  let palette = null;
  let trns = null;
  const idat = [];
  for (const c of chunks) {
    if (c.type === 'PLTE') palette = Buffer.from(c.data);
    else if (c.type === 'tRNS') trns = Buffer.from(c.data);
    else if (c.type === 'IDAT') idat.push(c.data);
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));

  const bitsPerPixel = channels * depth;
  const bpp = Math.max(1, bitsPerPixel >> 3);
  const rowBytes = Math.ceil((width * bitsPerPixel) / 8);
  const out = Buffer.alloc(width * height * 4); // RGBA8

  let prev = Buffer.alloc(rowBytes);
  let pos = 0;
  const line = Buffer.alloc(rowBytes);

  // sample readers for one pixel index within a scanline
  const maxVal = (1 << depth) - 1;

  for (let y = 0; y < height; y++) {
    const ft = raw[pos++];
    raw.copy(line, 0, pos, pos + rowBytes);
    pos += rowBytes;

    if (ft === 1) {
      for (let i = bpp; i < rowBytes; i++) line[i] = (line[i] + line[i - bpp]) & 0xff;
    } else if (ft === 2) {
      for (let i = 0; i < rowBytes; i++) line[i] = (line[i] + prev[i]) & 0xff;
    } else if (ft === 3) {
      for (let i = 0; i < rowBytes; i++) {
        const a = i >= bpp ? line[i - bpp] : 0;
        line[i] = (line[i] + ((a + prev[i]) >> 1)) & 0xff;
      }
    } else if (ft === 4) {
      for (let i = 0; i < rowBytes; i++) {
        const a = i >= bpp ? line[i - bpp] : 0;
        const c = i >= bpp ? prev[i - bpp] : 0;
        line[i] = (line[i] + paeth(a, prev[i], c)) & 0xff;
      }
    } else if (ft !== 0) {
      throw new Error('bad filter type ' + ft + ' at row ' + y);
    }

    // expand this row into RGBA
    let o = y * width * 4;
    for (let x = 0; x < width; x++) {
      let r, g, b, a = 255;
      if (depth === 8) {
        const i = x * channels;
        if (colorType === 0) {
          r = g = b = line[i];
        } else if (colorType === 2) {
          r = line[i]; g = line[i + 1]; b = line[i + 2];
        } else if (colorType === 3) {
          const pi = line[i] * 3;
          r = palette[pi]; g = palette[pi + 1]; b = palette[pi + 2];
          a = trns && line[i] < trns.length ? trns[line[i]] : 255;
        } else if (colorType === 4) {
          r = g = b = line[i]; a = line[i + 1];
        } else {
          r = line[i]; g = line[i + 1]; b = line[i + 2]; a = line[i + 3];
        }
      } else if (depth === 16) {
        const i = x * channels * 2;
        if (colorType === 0) {
          r = g = b = line[i];
        } else if (colorType === 2) {
          r = line[i]; g = line[i + 2]; b = line[i + 4];
        } else if (colorType === 4) {
          r = g = b = line[i]; a = line[i + 2];
        } else {
          r = line[i]; g = line[i + 2]; b = line[i + 4]; a = line[i + 6];
        }
      } else {
        // sub-byte grey or palette
        const bitPos = x * depth;
        const byte = line[bitPos >> 3];
        const shift = 8 - depth - (bitPos & 7);
        const v = (byte >> shift) & maxVal;
        if (colorType === 3) {
          const pi = v * 3;
          r = palette[pi]; g = palette[pi + 1]; b = palette[pi + 2];
          a = trns && v < trns.length ? trns[v] : 255;
        } else {
          r = g = b = Math.round((v * 255) / maxVal);
        }
      }
      out[o++] = r; out[o++] = g; out[o++] = b; out[o++] = a;
    }
    prev = Buffer.from(line);
  }

  return { width, height, depth, colorType, rgba: out };
}

/* ---------------- encode ---------------- */
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

/** rgba: Buffer of 8-bit RGBA pixels, w*h*4 */
function encode(w, h, rgba, level = 9) {
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    const src = y * w * 4;
    const dst = y * (w * 4 + 1);
    raw[dst] = 0; // filter: none
    rgba.copy(raw, dst + 1, src, src + w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function write(file, w, h, rgba, level = 9) {
  fs.writeFileSync(file, encode(w, h, rgba, level));
}

/** Extract a rectangular region (cropped, clamped) into a new RGBA buffer. */
function crop(rgba, imgW, imgH, x0, y0, w, h) {
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    const sy = y0 + y;
    if (sy < 0 || sy >= imgH) continue;
    const sx = Math.max(0, x0);
    const ex = Math.min(imgW, x0 + w);
    if (ex <= sx) continue;
    rgba.copy(out, y * w * 4 + (sx - x0) * 4, (sy * imgW + sx) * 4, (sy * imgW + ex) * 4);
  }
  return out;
}

module.exports = { decode, encode, write, crop, crc32 };
