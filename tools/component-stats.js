'use strict';
// Per-component stats: bbox, centroid, and tight content bounds (where alpha is solid).
// Usage: node tools/component-stats.js <in.png> [gap] [alphaMin] [dropUnder]
const { decode } = require('./pnglib');
const { segment } = require('./segment-sheet');
const img = decode(process.argv[2]);
const { width: W, height: H, rgba } = img;
const gap = Number(process.argv[3] ?? 1);
const alphaMin = Number(process.argv[4] ?? 4);
const dropUnder = Number(process.argv[5] ?? 0);
const { list, findRoot } = segment(rgba, W, H, { gap, alphaMin });
const rootToIdx = new Map();
list.forEach((b, i) => rootToIdx.set(b.root, i));
const idx = new Int32Array(W * H).fill(-1);
for (let i = 0; i < W * H; i++) {
  if (rgba[i * 4 + 3] <= alphaMin) continue;
  const r = findRoot(i);
  const v = rootToIdx.get(r);
  idx[i] = v === undefined ? -1 : v;
}
const stats = list.map((b, i) => ({ i, x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1, n: b.n, sx: 0, sy: 0, solid: 0, sx0: 1e9, sy0: 1e9, sx1: -1, sy1: -1 }));
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const c = idx[i];
    if (c < 0) continue;
    const s = stats[c];
    s.sx += x; s.sy += y;
    if (rgba[i * 4 + 3] > 128) {
      s.solid++;
      if (x < s.sx0) s.sx0 = x;
      if (y < s.sy0) s.sy0 = y;
      if (x > s.sx1) s.sx1 = x;
      if (y > s.sy1) s.sy1 = y;
    }
  }
}
console.log('idx  bbox(x,y,w,h)          centroid      solid-bounds(x,y,w,h)   px    solid');
for (const s of stats) {
  if (s.n < dropUnder) continue;
  const w = s.x1 - s.x0 + 1, h = s.y1 - s.y0 + 1;
  const cx = (s.sx / s.n).toFixed(0), cy = (s.sy / s.n).toFixed(0);
  const sw = s.sx1 - s.sx0 + 1, shh = s.sy1 - s.sy0 + 1;
  console.log(
    `${String(s.i).padStart(3)}  ${String(s.x0).padStart(4)},${String(s.y0).padStart(4)} ${String(w).padStart(4)}x${String(h).padStart(4)}  ` +
    `${String(cx).padStart(5)},${String(cy).padStart(5)}  ${String(s.sx0).padStart(4)},${String(s.sy0).padStart(4)} ${String(sw).padStart(4)}x${String(shh).padStart(4)}  ${String(s.n).padStart(6)} ${String(s.solid).padStart(6)}`
  );
}
