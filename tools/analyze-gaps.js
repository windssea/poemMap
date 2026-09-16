'use strict';
// True pixel-gap analysis between components (multi-source BFS over background).
// Usage: node tools/analyze-gaps.js <sheet.png> [alphaMin] [gap]
const { decode } = require('./pnglib');
const { segment, absorb } = require('./segment-sheet');

const file = process.argv[2];
const alphaMin = Number(process.argv[3] ?? 4);
const gapArg = Number(process.argv[4] ?? 1);
const img = decode(file);
const { width: W, height: H, rgba } = img;
const { list, findRoot } = segment(rgba, W, H, { gap: gapArg, alphaMin });

// label map: reuse segment's union-find so each pixel maps to its component index
const comps = list.map((b, i) => ({ ...b, i }));
const rootToIdx = new Map();
list.forEach((b, i) => rootToIdx.set(b.root, i));
const lab2 = new Int32Array(W * H).fill(-1);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (rgba[i * 4 + 3] <= alphaMin) continue;
    const r = findRoot(i);
    const idx = rootToIdx.get(r);
    lab2[i] = idx === undefined ? -1 : idx;
  }
}
console.log(`components = ${comps.length}`);

// multi-source BFS over background; track two nearest distinct sources per background pixel
const dist = new Int32Array(W * H).fill(-1);
const owner = new Int32Array(W * H).fill(-1);
const pair = new Map(); // "a|b" -> min contact distance
const qx = new Int32Array(W * H), qy = new Int32Array(W * H);
let qh = 0, qt = 0;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const l = lab2[y * W + x];
    if (l >= 0) { /* foreground */ }
    else {
      // seed if adjacent to foreground
      let src = -1;
      for (let dy = -1; dy <= 1 && src < 0; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const l2 = lab2[ny * W + nx];
          if (l2 >= 0) { src = l2; break; }
        }
      }
      if (src >= 0) {
        dist[y * W + x] = 1; owner[y * W + x] = src;
        qx[qt] = x; qy[qt] = y; qt++;
      }
    }
  }
}
const key = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
while (qh < qt) {
  const x = qx[qh], y = qy[qh]; qh++;
  const i = y * W + x;
  const d = dist[i], o = owner[i];
  for (let k = 0; k < 4; k++) {
    const nx = x + (k === 0 ? 1 : k === 1 ? -1 : 0);
    const ny = y + (k === 2 ? 1 : k === 3 ? -1 : 0);
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
    const j = ny * W + nx;
    if (lab2[j] < 0) {
      if (dist[j] === -1) {
        dist[j] = d + 1; owner[j] = o;
        qx[qt] = nx; qy[qt] = ny; qt++;
      } else if (owner[j] !== -1 && owner[j] !== o) {
        const kk = key(owner[j], o);
        const cand = dist[j] + d; // gap = pixels between the two components
        if (!pair.has(kk) || pair.get(kk) > cand) pair.set(kk, cand);
      }
    } else {
      const l2 = lab2[j];
      if (l2 >= 0 && l2 !== o) {
        const kk = key(l2, o);
        const cand = d + 1;
        if (!pair.has(kk) || pair.get(kk) > cand) pair.set(kk, cand);
      }
    }
  }
}
const rows = [...pair.entries()].map(([k, g]) => {
  const [a, b] = k.split('|').map(Number);
  const A = comps[a], B = comps[b];
  return { a, b, g, A, B };
}).sort((p, q) => p.g - q.g);
for (const r of rows) {
  if (r.g > 30) continue;
  const desc = (X) => `#${X.i}[${X.x0},${X.y0} ${X.x1 - X.x0 + 1}x${X.y1 - X.y0 + 1} px=${X.n}]`;
  console.log(`gap=${String(r.g).padStart(3)}  ${desc(r.A)}  <->  ${desc(r.B)}`);
}
const hist = {};
for (const r of rows) { const bucket = r.g <= 12 ? r.g : r.g <= 24 ? '13-24' : r.g <= 40 ? '25-40' : '>40'; hist[bucket] = (hist[bucket] || 0) + 1; }
console.log('gap histogram:', JSON.stringify(hist));
