'use strict';
/**
 * Audit: render every component as a scaled tile on a checkerboard with its index label.
 * This is the visual source of truth for naming.
 * Usage: node tools/audit-components.js <in.png> <out.png> [gap] [alphaMin] [cell] [cols]
 */
const { decode, encode, crop } = require('./pnglib');
const { segment, absorb, calibrate } = require('./segment-sheet');
const fs = require('fs');

const [inFile, outFile, gapArg, alphaArg, cellArg, colsArg, overridesArg] = process.argv.slice(2);
const gap = Number(gapArg ?? 1);
const alphaMin = Number(alphaArg ?? 4);
const CELL = Number(cellArg ?? 230);
const COLS = Number(colsArg ?? 6);

const img = decode(inFile);
const { width: W, height: H, rgba } = img;
const { list } = segment(rgba, W, H, { gap, alphaMin });
let boxList;
if (overridesArg) {
  const { applyOverrides, dropByAnchors, dropSpecks } = require('./merge-rules');
  const rules = JSON.parse(fs.readFileSync(overridesArg, 'utf8'));
  boxList = dropByAnchors(applyOverrides(list, W, H, rules), rules.drop);
} else {
  const { dropSpecks } = require('./merge-rules');
  const dropUnder = Number(process.env.DROP_UNDER ?? 0);
  boxList = dropSpecks(list, dropUnder);
}
const boxes = boxList;

const rows = Math.ceil(boxes.length / COLS);
const SW = COLS * CELL, SH = rows * CELL;
const sheet = Buffer.alloc(SW * SH * 4);
for (let y = 0; y < SH; y++) {
  for (let x = 0; x < SW; x++) {
    const c = ((x >> 4) + (y >> 4)) % 2 ? 232 : 252;
    const i = (y * SW + x) * 4;
    sheet[i] = c; sheet[i + 1] = c; sheet[i + 2] = c; sheet[i + 3] = 255;
  }
}

boxes.forEach((b, i) => {
  const col = i % COLS, row = (i / COLS) | 0;
  const cx = col * CELL, cy = row * CELL;
  const m = 4;
  const bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1;
  const scale = Math.min((CELL - 2 * m) / bw, (CELL - 2 * m - 12) / bh);
  const dw = Math.max(1, Math.round(bw * scale)), dh = Math.max(1, Math.round(bh * scale));
  const ox = cx + Math.round((CELL - dw) / 2), oy = cy + 12 + Math.round((CELL - 12 - dh) / 2);
  const px = crop(rgba, W, H, b.x0, b.y0, bw, bh);
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(bw - 1, Math.floor(x / scale));
      const sy = Math.min(bh - 1, Math.floor(y / scale));
      const si = (sy * bw + sx) * 4;
      const a = px[si + 3] / 255;
      if (a === 0) continue;
      const di = ((oy + y) * SW + ox + x) * 4;
      sheet[di] = Math.round(px[si] * a + sheet[di] * (1 - a));
      sheet[di + 1] = Math.round(px[si + 1] * a + sheet[di + 1] * (1 - a));
      sheet[di + 2] = Math.round(px[si + 2] * a + sheet[di + 2] * (1 - a));
      sheet[di + 3] = 255;
    }
  }
  // cell border
  const put = (x, y, c) => {
    if (x < 0 || y < 0 || x >= SW || y >= SH) return;
    const di = (y * SW + x) * 4;
    sheet[di] = c; sheet[di + 1] = c; sheet[di + 2] = c; sheet[di + 3] = 255;
  };
  for (let x = cx; x < cx + CELL; x++) { put(x, cy, 170); put(x, cy + CELL - 1, 170); }
  for (let y = cy; y < cy + CELL; y++) { put(cx, y, 170); put(cx + CELL - 1, y, 170); }
  const label = `#${i} ${bw}x${bh}${b.keep ? '' : ' DROP'}`;
  drawText(sheet, SW, SH, label, cx + 4, cy + 4, [190, 0, 0], 1, [255, 255, 255]);
});

fs.writeFileSync(outFile, encode(SW, SH, sheet, 6));
console.log(`${boxes.length} components -> ${outFile} (${SW}x${SH})`);
console.log(boxes.map((b, i) => `#${String(i).padStart(3)} x=${b.x0} y=${b.y0} w=${b.x1 - b.x0 + 1} h=${b.y1 - b.y0 + 1} px=${b.n}${b.keep ? '' : ' DROP'}`).join('\n'));

/* nearest-neighbour gap listing (true pixel gap via BFS) */
if (process.env.GAPS) {
  const { list: rawList, findRoot } = segment(rgba, W, H, { gap, alphaMin });
  const rootToIdx = new Map();
  rawList.forEach((b, i) => rootToIdx.set(b.root, i));
  const lab = new Int32Array(W * H).fill(-1);
  for (let i = 0; i < W * H; i++) {
    if (rgba[i * 4 + 3] <= alphaMin) continue;
    const r = findRoot(i);
    const v = rootToIdx.get(r);
    lab[i] = v === undefined ? -1 : v;
  }
  const dist = new Int32Array(W * H).fill(-1);
  const owner = new Int32Array(W * H).fill(-1);
  const pair = new Map();
  const qx = new Int32Array(W * H), qy = new Int32Array(W * H);
  let qh = 0, qt = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (lab[i] >= 0) continue;
    let src = -1;
    for (let dy = -1; dy <= 1 && src < 0; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const l2 = lab[ny * W + nx];
      if (l2 >= 0) { src = l2; break; }
    }
    if (src >= 0) { dist[i] = 1; owner[i] = src; qx[qt] = x; qy[qt] = y; qt++; }
  }
  const key = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
  while (qh < qt) {
    const x = qx[qh], y = qy[qh]; qh++;
    const i = y * W + x, d = dist[i], o = owner[i];
    for (let k = 0; k < 4; k++) {
      const nx = x + (k === 0 ? 1 : k === 1 ? -1 : 0);
      const ny = y + (k === 2 ? 1 : k === 3 ? -1 : 0);
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      if (lab[j] >= 0) {
        const l2 = lab[j];
        if (l2 !== o) {
          const kk = key(l2, o), cand = d + 1;
          if (!pair.has(kk) || pair.get(kk) > cand) pair.set(kk, cand);
        }
        continue;
      }
      if (dist[j] === -1) { dist[j] = d + 1; owner[j] = o; qx[qt] = nx; qy[qt] = ny; qt++; }
      else if (owner[j] !== -1 && owner[j] !== o) {
        const kk = key(owner[j], o), cand = dist[j] + d;
        if (!pair.has(kk) || pair.get(kk) > cand) pair.set(kk, cand);
      }
    }
  }
  const idxOf = new Map();
  rawList.forEach((b, i) => idxOf.set(b.root, i));
  console.log('--- gaps <= 24 (index refers to the RAW list, not the displayed list) ---');
  [...pair.entries()].map(([k, g]) => ({ k, g })).sort((a, b) => a.g - b.g).forEach(({ k, g }) => {
    if (g > 24) return;
    const [a, b] = k.split('|').map(Number);
    const A = rawList[a], B = rawList[b];
    console.log(`gap=${String(g).padStart(3)}  #${a}[${A.x0},${A.y0} ${A.x1 - A.x0 + 1}x${A.y1 - A.y0 + 1}] <-> #${b}[${B.x0},${B.y0} ${B.x1 - B.x0 + 1}x${B.y1 - B.y0 + 1}]`);
  });
}

function drawText(buf, W, H, text, x, y, color, scale, bg) {
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
    ',': ['00000', '00000', '00000', '00000', '00100', '00100', '01000'],
    '=': ['00000', '11111', '00000', '00000', '11111', '00000', '00000'],
    ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  };
  const w = text.length * 6 * scale;
  if (bg) {
    for (let yy = y - 2; yy < y + 9 * scale; yy++) for (let xx = x - 2; xx < x + w + 2; xx++) {
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const di = (yy * W + xx) * 4;
      buf[di] = bg[0]; buf[di + 1] = bg[1]; buf[di + 2] = bg[2];
    }
  }
  let cx = x;
  for (const c of text) {
    const g = F[c];
    if (g) {
      for (let gy = 0; gy < 7; gy++) for (let gx = 0; gx < 5; gx++) {
        if (g[gy][gx] !== '1') continue;
        for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) {
          const px2 = cx + gx * scale + sx, py = y + gy * scale + sy;
          if (px2 < 0 || py < 0 || px2 >= W || py >= H) continue;
          const di = (py * W + px2) * 4;
          buf[di] = color[0]; buf[di + 1] = color[1]; buf[di + 2] = color[2];
        }
      }
    }
    cx += 6 * scale;
  }
}
