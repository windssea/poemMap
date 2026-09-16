'use strict';
// Contact sheet of exported PNGs, on a checkerboard, with file index labels.
// Usage: node tools/make-contact-sheet.js <dir> <out.png> [cols] [cell]
const fs = require('fs');
const path = require('path');
const { decode, encode } = require('./pnglib');

const [dir, outFile, colsArg, cellArg] = process.argv.slice(2);
const COLS = Number(colsArg ?? 7);
const CELL = Number(cellArg ?? 230);
const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.png')).sort((a, b) => a.localeCompare(b, 'zh'));
const rows = Math.ceil(files.length / COLS);
const SW = COLS * CELL, SH = rows * CELL;
const sheet = Buffer.alloc(SW * SH * 4);
for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
  const c = ((x >> 4) + (y >> 4)) % 2 ? 228 : 250;
  const i = (y * SW + x) * 4;
  sheet[i] = c; sheet[i + 1] = c; sheet[i + 2] = c; sheet[i + 3] = 255;
}
files.forEach((f, i) => {
  const col = i % COLS, row = (i / COLS) | 0;
  const cx = col * CELL, cy = row * CELL;
  const img = decode(path.join(dir, f));
  const m = 4, labelH = 12;
  const scale = Math.min((CELL - 2 * m) / img.width, (CELL - 2 * m - labelH) / img.height, 4);
  const dw = Math.max(1, Math.round(img.width * scale)), dh = Math.max(1, Math.round(img.height * scale));
  const ox = cx + Math.round((CELL - dw) / 2), oy = cy + labelH + Math.round((CELL - labelH - dh) / 2);
  for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
    const sx = Math.min(img.width - 1, Math.floor(x / scale));
    const sy = Math.min(img.height - 1, Math.floor(y / scale));
    const si = (sy * img.width + sx) * 4;
    const a = img.rgba[si + 3] / 255;
    if (a === 0) continue;
    const di = ((oy + y) * SW + ox + x) * 4;
    sheet[di] = Math.round(img.rgba[si] * a + sheet[di] * (1 - a));
    sheet[di + 1] = Math.round(img.rgba[si + 1] * a + sheet[di + 1] * (1 - a));
    sheet[di + 2] = Math.round(img.rgba[si + 2] * a + sheet[di + 2] * (1 - a));
    sheet[di + 3] = 255;
  }
  const put = (x, y, c) => {
    if (x < 0 || y < 0 || x >= SW || y >= SH) return;
    const di = (y * SW + x) * 4;
    sheet[di] = c; sheet[di + 1] = c; sheet[di + 2] = c; sheet[di + 3] = 255;
  };
  for (let x = cx; x < cx + CELL; x++) { put(x, cy, 165); put(x, cy + CELL - 1, 165); }
  for (let y = cy; y < cy + CELL; y++) { put(cx, y, 165); put(cx + CELL - 1, y, 165); }
  // index label as plain block digits rendered from a 5x7 font
  text(sheet, SW, SH, `${i + 1}`, cx + 4, cy + 3, [200, 0, 0], 1);
  text(sheet, SW, SH, `${img.width}x${img.height}`, cx + 4, cy + CELL - 10, [60, 60, 60], 1);
});
fs.writeFileSync(outFile, encode(SW, SH, sheet, 6));
console.log(`${files.length} pngs -> ${outFile} (${SW}x${SH})`);
console.log(files.map((f, i) => `${i + 1}. ${f}`).join('\n'));

function text(buf, W, H, s, x, y, color, scale) {
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
    ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  };
  let cx = x;
  for (const c of s) {
    const g = F[c];
    if (g) for (let gy = 0; gy < 7; gy++) for (let gx = 0; gx < 5; gx++) {
      if (g[gy][gx] !== '1') continue;
      for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) {
        const px = cx + gx * scale + sx, py = y + gy * scale + sy;
        if (px < 0 || py < 0 || px >= W || py >= H) continue;
        const di = (py * W + px) * 4;
        buf[di] = color[0]; buf[di + 1] = color[1]; buf[di + 2] = color[2]; buf[di + 3] = 255;
      }
    }
    cx += 6 * scale;
  }
}
