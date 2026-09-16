'use strict';
// Render a labeled grid over a zoomed region: node tools/region-grid.js <in.png> <out.png> <x> <y> <w> <h> [scale]
const { decode, encode, crop } = require('./pnglib');
const fs = require('fs');
const [inFile, outFile, X, Y, W0, H0, scaleArg] = process.argv.slice(2);
const scale = Number(scaleArg ?? 1);
const x0 = Number(X), y0 = Number(Y), w0 = Number(W0), h0 = Number(H0);
const img = decode(inFile);
const px = crop(img.rgba, img.width, img.height, x0, y0, w0, h0);
const sw = Math.round(w0 * scale), sh = Math.round(h0 * scale);
const out = Buffer.alloc(sw * sh * 4);
for (let y = 0; y < sh; y++) {
  for (let x = 0; x < sw; x++) {
    const sx = Math.min(w0 - 1, Math.floor(x / scale));
    const sy = Math.min(h0 - 1, Math.floor(y / scale));
    const si = (sy * w0 + sx) * 4;
    const a = px[si + 3] / 255;
    const di = (y * sw + x) * 4;
    out[di] = Math.round(px[si] * a + 255 * (1 - a));
    out[di + 1] = Math.round(px[si + 1] * a + 255 * (1 - a));
    out[di + 2] = Math.round(px[si + 2] * a + 255 * (1 - a));
    out[di + 3] = 255;
  }
}
// 100px grid in source coordinates
const step = 100 * scale;
for (let gx = 0; gx * 100 < w0; gx++) {
  const x = Math.round(gx * step);
  for (let y = 0; y < sh; y++) {
    if (x >= sw) break;
    const di = (y * sw + x) * 4;
    const strong = (x0 + gx * 100) % 500 === 0;
    out[di] = strong ? 255 : 190; out[di + 1] = strong ? 0 : 210; out[di + 2] = strong ? 255 : 210;
  }
  label(out, sw, sh, String(x0 + gx * 100), x + 2, 2);
}
for (let gy = 0; gy * 100 < h0; gy++) {
  const y = Math.round(gy * step);
  for (let x = 0; x < sw; x++) {
    if (y >= sh) break;
    const di = (y * sw + x) * 4;
    const strong = (y0 + gy * 100) % 500 === 0;
    out[di] = strong ? 255 : 190; out[di + 1] = strong ? 0 : 210; out[di + 2] = strong ? 255 : 210;
  }
  label(out, sw, sh, String(y0 + gy * 100), 2, y + 2);
}
fs.writeFileSync(outFile, encode(sw, sh, out, 6));
console.log(`${outFile} ${sw}x${sh} covering ${x0},${y0} ${w0}x${h0}`);

function label(buf, W, H, text, x, y) {
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
  };
  let cx = x;
  for (const c of text) {
    const g = F[c];
    if (g) for (let gy = 0; gy < 7; gy++) for (let gx = 0; gx < 5; gx++) {
      if (g[gy][gx] !== '1') continue;
      const pxx = cx + gx, py = y + gy;
      if (pxx < 0 || py < 0 || pxx >= W || py >= H) continue;
      const di = (py * W + pxx) * 4;
      buf[di] = 255; buf[di + 1] = 0; buf[di + 2] = 0;
    }
    cx += 6;
  }
}
