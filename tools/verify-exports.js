'use strict';
// Verify exported PNGs: real size, alpha coverage, opaque-edge check, and a colour tag.
// Usage: node tools/verify-exports.js <dir> [<dir> ...]
const fs = require('fs');
const path = require('path');
const { decode } = require('./pnglib');

for (const dir of process.argv.slice(2)) {
  const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.png'));
  console.log(`\n=== ${dir} (${files.length} pngs) ===`);
  console.log('file                                   size      fill%  edgeOpaque  avgRGB          tag');
  const rows = [];
  for (const f of files) {
    const img = decode(path.join(dir, f));
    const { width: w, height: h, rgba } = img;
    let n = 0, r = 0, g = 0, b = 0, edge = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const a = rgba[i + 3];
        if (a > 8) {
          n++; r += rgba[i]; g += rgba[i + 1]; b += rgba[i + 2];
          if (x === 0 || y === 0 || x === w - 1 || y === h - 1) edge++;
        }
      }
    }
    const R = n ? Math.round(r / n) : 0, G = n ? Math.round(g / n) : 0, B = n ? Math.round(b / n) : 0;
    const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
    let tag = 'gray';
    if (mx - mn > 25) {
      if (mx === R) tag = G > B ? 'warm/orange-red' : 'pink/magenta';
      else if (mx === G) tag = 'green';
      else tag = R > G ? 'blue/violet' : 'cyan';
    } else if (mx > 200) tag = 'white/light';
    const fill = ((n / (w * h)) * 100).toFixed(1);
    rows.push({ f, w, h, fill: +fill, edge, R, G, B, tag });
    console.log(
      (f + '                                      ').slice(0, 38) +
      (w + 'x' + h + '        ').slice(0, 10) +
      String(fill).padStart(5) + '  ' + String(edge).padStart(9) + '  ' +
      `${String(R).padStart(3)},${String(G).padStart(3)},${String(B).padStart(3)}`.padEnd(15) + tag
    );
  }
  const edgey = rows.filter((r) => r.edge > 0);
  console.log(`\nfiles with opaque pixels on the crop border: ${edgey.length}`);
  for (const r of edgey) console.log(`  ! ${r.f} edge=${r.edge} fill=${r.fill}%`);
  const dims = new Map();
  for (const r of rows) {
    const k = `${r.w}x${r.h}`;
    dims.set(k, (dims.get(k) || 0) + 1);
  }
  console.log('distinct sizes:', [...dims.entries()].map(([k, v]) => `${k}${v > 1 ? '×' + v : ''}`).join(' '));
}
