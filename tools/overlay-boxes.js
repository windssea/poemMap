'use strict';
/**
 * Diagnostics: segment a sheet and render each component box with an index label.
 * Usage: node tools/overlay-boxes.js <in.png> <out.png> [gap]
 */
const { decode, encode } = require('./pnglib');
const { segment, absorb, calibrate } = require('./segment-sheet');
const fs = require('fs');

/* ---------- tiny 5x7 bitmap font ---------- */
const FONT = {
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
  ':': ['00000', '00100', '00100', '00000', '00100', '00100', '00000'],
};

function drawText(buf, W, H, text, x, y, color, scale = 2, bg = [255, 255, 255]) {
  const cw = 5 * scale, ch = 7 * scale, gap = scale;
  // background plate for legibility
  const tw = text.length * (cw + gap) + gap;
  for (let yy = y - scale; yy < y + ch + scale; yy++) {
    for (let xx = x - scale; xx < x + tw; xx++) {
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const i = (yy * W + xx) * 4;
      buf[i] = bg[0]; buf[i + 1] = bg[1]; buf[i + 2] = bg[2]; buf[i + 3] = 255;
    }
  }
  let cx = x;
  for (const ch2 of text) {
    const glyph = FONT[ch2];
    if (glyph) {
      for (let gy = 0; gy < 7; gy++) {
        for (let gx = 0; gx < 5; gx++) {
          if (glyph[gy][gx] !== '1') continue;
          for (let sy = 0; sy < scale; sy++) {
            for (let sx = 0; sx < scale; sx++) {
              const px = cx + gx * scale + sx, py = y + gy * scale + sy;
              if (px < 0 || py < 0 || px >= W || py >= H) continue;
              const i = (py * W + px) * 4;
              buf[i] = color[0]; buf[i + 1] = color[1]; buf[i + 2] = color[2]; buf[i + 3] = 255;
            }
          }
        }
      }
    }
    cx += cw + gap;
  }
}

const [inFile, outFile, gapArg, alphaArg, reachArg, overridesArg] = process.argv.slice(2);
const gap = Number(gapArg ?? 1);
const alphaMin = Number(alphaArg ?? 4);
const reach = Number(reachArg ?? 0);
const img = decode(inFile);
const { width: W, height: H, rgba } = img;
const { list } = segment(rgba, W, H, { gap, alphaMin });
let merged = absorb(list, W, H, 2);
if (overridesArg) {
  const { applyOverrides } = require('./merge-rules');
  merged = applyOverrides(list, W, H, JSON.parse(fs.readFileSync(overridesArg, 'utf8')));
} else if (reach > 0) {
  merged = calibrate(merged, reach);
}

// flatten onto white, full resolution
const out = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) {
  const a = rgba[i * 4 + 3] / 255;
  out[i * 4] = Math.round(rgba[i * 4] * a + 255 * (1 - a));
  out[i * 4 + 1] = Math.round(rgba[i * 4 + 1] * a + 255 * (1 - a));
  out[i * 4 + 2] = Math.round(rgba[i * 4 + 2] * a + 255 * (1 - a));
  out[i * 4 + 3] = 255;
}

const COLORS = [[220, 20, 20], [20, 90, 220], [10, 150, 40], [200, 0, 190], [230, 120, 0]];
const put = (x, y, c) => {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  out[i] = c[0]; out[i + 1] = c[1]; out[i + 2] = c[2]; out[i + 3] = 255;
};

merged.forEach((b, idx) => {
  const c = COLORS[idx % COLORS.length];
  for (let x = b.x0; x <= b.x1; x++) { put(x, b.y0, c); put(x, b.y1, c); }
  for (let y = b.y0; y <= b.y1; y++) { put(b.x0, y, c); put(b.x1, y, c); }
  const lx = Math.max(0, Math.min(W - 1, b.x0));
  const ly = Math.max(0, Math.min(H - 1, b.y0 - 18));
  drawText(out, W, H, String(idx), lx + 2, Math.max(0, ly), c, 2);
});

fs.writeFileSync(outFile, encode(W, H, out, 6));
console.log(`boxes=${merged.length} -> ${outFile}`);
console.log(JSON.stringify(merged.map((b, i) => ({ i, x: b.x0, y: b.y0, w: b.x1 - b.x0 + 1, h: b.y1 - b.y0 + 1 })), null, 0));
