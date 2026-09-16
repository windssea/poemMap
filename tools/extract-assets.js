'use strict';
/**
 * Extract assets from a transparent sheet.
 * Usage: node tools/extract-assets.js <in.png> <outDir> <prefix> [gap] [alphaMin] [pad]
 * Writes <prefix>-NN.png plus <prefix>-crops.png (indexed contact sheet) for review.
 */
const fs = require('fs');
const path = require('path');
const { decode, encode, crop } = require('./pnglib');
const { segment, absorb } = require('./segment-sheet');

const [inFile, outDir, prefix, gapArg, alphaArg, padArg] = process.argv.slice(2);
const gap = Number(gapArg ?? 1);
const alphaMin = Number(alphaArg ?? 4);
const pad = Number(padArg ?? 4);

const img = decode(inFile);
const { width: W, height: H, rgba } = img;
const { list } = segment(rgba, W, H, { gap, alphaMin });
const boxes = absorb(list, W, H, 2);

fs.mkdirSync(outDir, { recursive: true });

const manifest = [];
boxes.forEach((b, i) => {
  const x0 = Math.max(0, b.x0 - pad), y0 = Math.max(0, b.y0 - pad);
  const x1 = Math.min(W - 1, b.x1 + pad), y1 = Math.min(H - 1, b.y1 + pad);
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const px = crop(rgba, W, H, x0, y0, w, h);
  const name = `${prefix}-${String(i).padStart(2, '0')}`;
  fs.writeFileSync(path.join(outDir, name + '.png'), encode(w, h, px, 9));
  manifest.push({ id: i, name, file: name + '.png', x: x0, y: y0, w, h, srcX: b.x0, srcY: b.y0, srcW: b.x1 - b.x0 + 1, srcH: b.y1 - b.y0 + 1, pixels: b.n });
});

fs.writeFileSync(path.join(outDir, prefix + '-manifest.json'), JSON.stringify(manifest, null, 2));

/* contact sheet of crops on a checkerboard, in a grid, with index labels */
const COLS = 8;
const CELL = 190;
const rows = Math.ceil(manifest.length / COLS);
const SW = COLS * CELL, SH = rows * CELL;
const sheet = Buffer.alloc(SW * SH * 4);
for (let y = 0; y < SH; y++) {
  for (let x = 0; x < SW; x++) {
    const c = ((x >> 4) + (y >> 4)) % 2 ? 226 : 250;
    const i = (y * SW + x) * 4;
    sheet[i] = c; sheet[i + 1] = c; sheet[i + 2] = c; sheet[i + 3] = 255;
  }
}
manifest.forEach((m, i) => {
  const col = i % COLS, row = (i / COLS) | 0;
  const cx = col * CELL, cy = row * CELL;
  const scale = Math.min((CELL - 24) / m.w, (CELL - 24) / m.h, 3);
  const dw = Math.max(1, Math.round(m.w * scale)), dh = Math.max(1, Math.round(m.h * scale));
  const ox = cx + Math.round((CELL - dw) / 2), oy = cy + Math.round((CELL - 18 - dh) / 2) + 4;
  // read back the written crop
  const cimg = decode(path.join(outDir, m.file));
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(cimg.width - 1, Math.floor(x / scale));
      const sy = Math.min(cimg.height - 1, Math.floor(y / scale));
      const si = (sy * cimg.width + sx) * 4;
      const a = cimg.rgba[si + 3] / 255;
      if (a === 0) continue;
      const di = ((oy + y) * SW + ox + x) * 4;
      sheet[di] = Math.round(cimg.rgba[si] * a + sheet[di] * (1 - a));
      sheet[di + 1] = Math.round(cimg.rgba[si + 1] * a + sheet[di + 1] * (1 - a));
      sheet[di + 2] = Math.round(cimg.rgba[si + 2] * a + sheet[di + 2] * (1 - a));
      sheet[di + 3] = 255;
    }
  }
  // label bar
  for (let y = cy + CELL - 16; y < cy + CELL - 2; y++) {
    for (let x = cx + 2; x < cx + 62; x++) {
      const di = (y * SW + x) * 4;
      sheet[di] = 255; sheet[di + 1] = 255; sheet[di + 2] = 255; sheet[di + 3] = 255;
    }
  }
  drawDigits(sheet, SW, SH, String(i), cx + 4, cy + CELL - 15, [200, 0, 0], 1);
  drawDigits(sheet, SW, SH, `${m.w}x${m.h}`, cx + 66, cy + CELL - 15, [40, 40, 40], 1);
});
fs.writeFileSync(path.join(outDir, prefix + '-crops.png'), encode(SW, SH, sheet, 6));

console.log(`extracted ${manifest.length} assets -> ${outDir}`);
console.log(manifest.map((m) => `${String(m.id).padStart(2)} ${m.file} ${m.w}x${m.h}`).join('\n'));

/* 5x7 font for labels */
function drawDigits(buf, W, H, text, x, y, color, scale) {
  const F = {
    '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
    '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
    '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
    '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
    '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
    '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
    '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
    '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
    '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
    '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
    'x': ['00000', '10001', '01010', '00100', '01010', '10001', '00000'],
  };
  let cx = x;
  for (const c of text) {
    const g = F[c];
    if (g) {
      for (let gy = 0; gy < 7; gy++) for (let gx = 0; gx < 5; gx++) {
        if (g[gy][gx] !== '1') continue;
        const px = cx + gx * scale, py = y + gy * scale;
        if (px < 0 || py < 0 || px >= W || py >= H) continue;
        const di = (py * W + px) * 4;
        buf[di] = color[0]; buf[di + 1] = color[1]; buf[di + 2] = color[2]; buf[di + 3] = 255;
      }
    }
    cx += 6 * scale;
  }
}
