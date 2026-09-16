'use strict';
/**
 * Apply a plan and report the resulting assets without writing files.
 * Usage: node tools/run-plan.js <plan.json> [--write] [--audit <tiles.png>] [--overlay <boxes.png>]
 */
const path = require('path');
const fs = require('fs');
const { decode, encode, crop } = require('./pnglib');
const { buildAssets } = require('./asset-plan');

const planPath = process.argv[2];
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const root = path.resolve(__dirname, '..');
const sheetPath = path.isAbsolute(plan.sheet) ? plan.sheet : path.join(root, plan.sheet);
const img = decode(sheetPath);
const { width: W, height: H, rgba } = img;

let out;
try {
  out = buildAssets(rgba, W, H, plan);
} catch (e) {
  console.log('PLAN ERROR: ' + e.message);
  if (process.env.SHOW_ALL) {
    out = buildAssets(rgba, W, H, { ...plan, names: [] });
  } else {
    throw e;
  }
}
if (plan.showAllNames !== false) {
  // when running with a relaxed radius the plan may resolve everything; keep as-is
}
console.log(`raw components: ${out.rawCount}`);
for (const p of out.peelLog) {
  console.log(`peel "${p.label}" region=${p.region.join(',')} cores=${p.cores} withPixels=${p.coresWithPixels} fallbackPx=${p.fellBack}`);
  for (const b of p.boxes) console.log('    core ' + b);
}
console.log(`assets: ${out.assets.length}`);
console.log('idx  name                          x     y     w    h   parts   vcentre         avgRGB');
out.assets.forEach((a, i) => {
  const st = colourStats(rgba, W, a);
  console.log(
    String(i).padStart(3) + '  ' + (a.name + '                            ').slice(0, 28) +
    String(a.x0).padStart(5) + ' ' + String(a.y0).padStart(5) + ' ' +
    String(a.w).padStart(5) + String(a.h).padStart(5) + String(a.parts).padStart(6) +
    '   ' + (a.visualCentre ? a.visualCentre.map((v) => Math.round(v)).join(',').padEnd(11) : '-') +
    st +
    (a.unnamed ? '  <UNNAMED>' : '')
  );
});

function colourStats(rgba, W, a) {
  let r = 0, g = 0, b = 0, n = 0, bright = 0;
  for (let y = a.y0; y <= a.y1; y++) {
    for (let x = a.x0; x <= a.x1; x++) {
      const i = (y * W + x) * 4;
      const al = rgba[i + 3];
      if (al < 40) continue;
      r += rgba[i]; g += rgba[i + 1]; b += rgba[i + 2]; n++;
      if (rgba[i] > 200 && rgba[i + 1] < 150 && rgba[i + 2] < 110) bright++;
    }
  }
  if (!n) return '  -';
  const R = Math.round(r / n), G = Math.round(g / n), B = Math.round(b / n);
  // crude hue label
  const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
  let hue = 'gray';
  if (mx - mn > 22) {
    if (mx === R) hue = G > B ? 'orange' : 'pink/red';
    else if (mx === G) hue = 'green';
    else hue = R > G ? 'blue/violet' : 'cyan';
  } else if (mx > 190) hue = 'white';
  else hue = 'dark-gray';
  const warm = n ? Math.round((bright / n) * 100) : 0;
  return `${String(R).padStart(3)},${String(G).padStart(3)},${String(B).padStart(3)} ${hue.padEnd(10)} warm=${warm}%`;
}
if (process.env.SHOW_VC) {
  console.log('\nvisual centres (for "at" values):');
  out.assets.forEach((a, i) => {
    console.log(`  ${String(i).padStart(3)} ${(a.name + '                        ').slice(0, 24)} at=[${Math.round(a.visualCentre[0])}, ${Math.round(a.visualCentre[1])}]  box=${a.x0},${a.y0} ${a.w}x${a.h}`);
  });
}
const unnamed = out.assets.filter((a) => a.unnamed);
if (unnamed.length) {
  console.log('\nunnamed assets (give these a "names" entry with matching "at"):');
  for (const a of unnamed) {
    console.log(`  ${a.name}  centre=(${Math.round((a.x0 + a.x1) / 2)},${Math.round((a.y0 + a.y1) / 2)}) box=${a.x0},${a.y0} ${a.w}x${a.h} px=${a.n}`);
  }
}

if (process.argv.includes('--audit')) {
  const i = process.argv.indexOf('--audit');
  const outFile = process.argv[i + 1];
  const COLS = 6, CELL = 260;
  const rows = Math.ceil(out.assets.length / COLS);
  const SW = COLS * CELL, SH = rows * CELL;
  const sheet = Buffer.alloc(SW * SH * 4);
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
    const c = ((x >> 4) + (y >> 4)) % 2 ? 232 : 252;
    const di = (y * SW + x) * 4;
    sheet[di] = c; sheet[di + 1] = c; sheet[di + 2] = c; sheet[di + 3] = 255;
  }
  out.assets.forEach((a, i) => {
    const col = i % COLS, row = (i / COLS) | 0;
    const cx = col * CELL, cy = row * CELL;
    const m = 3, labelH = 11;
    const scale = Math.min((CELL - 2 * m) / a.w, (CELL - 2 * m - labelH) / a.h, 4);
    const dw = Math.max(1, Math.round(a.w * scale)), dh = Math.max(1, Math.round(a.h * scale));
    const ox = cx + Math.round((CELL - dw) / 2), oy = cy + labelH + Math.round((CELL - labelH - dh) / 2);
    const px = crop(rgba, W, H, a.x0, a.y0, a.w, a.h);
    for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
      const sx = Math.min(a.w - 1, Math.floor(x / scale)), sy = Math.min(a.h - 1, Math.floor(y / scale));
      const si = (sy * a.w + sx) * 4, al = px[si + 3] / 255;
      if (al === 0) continue;
      const di = ((oy + y) * SW + ox + x) * 4;
      sheet[di] = Math.round(px[si] * al + sheet[di] * (1 - al));
      sheet[di + 1] = Math.round(px[si + 1] * al + sheet[di + 1] * (1 - al));
      sheet[di + 2] = Math.round(px[si + 2] * al + sheet[di + 2] * (1 - al));
      sheet[di + 3] = 255;
    }
    const put = (x, y, c) => {
      if (x < 0 || y < 0 || x >= SW || y >= SH) return;
      const di = (y * SW + x) * 4;
      sheet[di] = c; sheet[di + 1] = c; sheet[di + 2] = c; sheet[di + 3] = 255;
    };
    for (let x = cx; x < cx + CELL; x++) { put(x, cy, 170); put(x, cy + CELL - 1, 170); }
    for (let y = cy; y < cy + CELL; y++) { put(cx, y, 170); put(cx + CELL - 1, y, 170); }
    drawText(sheet, SW, SH, `${i} ${a.w}x${a.h}`, cx + 3, cy + 2, [190, 0, 0], 1);
    drawText(sheet, SW, SH, ascii(a.name), cx + 3, cy + CELL - 10, [0, 90, 200], 1);
  });
  fs.writeFileSync(outFile, encode(SW, SH, sheet, 6));
  console.log(`\naudit sheet -> ${outFile} (${SW}x${SH})`);
}

function ascii(s) {
  return s.replace(/[^\x20-\x7e]/g, '?').slice(0, 34);
}

function drawText(buf, W, H, text, x, y, color, scale) {
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
  for (const c of text) {
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
