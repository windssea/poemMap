'use strict';
// List nearest-neighbour gaps between candidate components, to choose a merge threshold.
const { decode } = require('./pnglib');
const { segment, absorb } = require('./segment-sheet');
const img = decode(process.argv[2]);
const { width: W, height: H, rgba } = img;
const gap = Number(process.argv[3] ?? 1);
const alphaMin = Number(process.argv[4] ?? 4);
const { list } = segment(rgba, W, H, { gap, alphaMin });
const boxes = absorb(list, W, H, 2).map((b, i) => ({ i, ...b }));
console.log(`components = ${boxes.length}`);
const pairs = [];
for (let a = 0; a < boxes.length; a++) {
  for (let b = a + 1; b < boxes.length; b++) {
    const A = boxes[a], B = boxes[b];
    const dx = Math.max(0, Math.max(A.x0 - B.x1, B.x0 - A.x1));
    const dy = Math.max(0, Math.max(A.y0 - B.y1, B.y0 - A.y1));
    const d = Math.max(dx, dy); // chebyshev-ish: touching in both axes required
    const gapXY = Math.sqrt(dx * dx + dy * dy);
    if (gapXY <= 26) pairs.push({ a: A.i, b: B.i, dx, dy, d, gapXY: +gapXY.toFixed(1), areaA: (A.x1 - A.x0) * (A.y1 - A.y0), areaB: (B.x1 - B.x0) * (B.y1 - B.y0) });
  }
}
pairs.sort((p, q) => p.gapXY - q.gapXY);
for (const p of pairs) {
  const A = boxes[p.a], B = boxes[p.b];
  const desc = (X) => `#${X.i}[${X.x0},${X.y0} ${X.x1 - X.x0 + 1}x${X.y1 - X.y0 + 1}]`;
  console.log(`gap=${String(p.gapXY).padStart(5)} dx=${String(p.dx).padStart(3)} dy=${String(p.dy).padStart(3)}  ${desc(A)}  <->  ${desc(B)}`);
}
