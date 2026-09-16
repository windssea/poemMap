'use strict';
// Inspect the sheet: header info, alpha statistics, coarse density map, projections.
const { decode } = require('./pnglib');

const file = process.argv[2];
const img = decode(file);
const { width: W, height: H, rgba } = img;
console.log(`size=${W}x${H} depth=${img.depth} colorType=${img.colorType}`);

let opaque = 0, semi = 0, transparent = 0;
const alphaHist = new Array(9).fill(0);
for (let i = 3; i < rgba.length; i += 4) {
  const a = rgba[i];
  if (a === 0) transparent++;
  else if (a === 255) opaque++;
  else semi++;
  alphaHist[a >> 5]++;
}
const total = W * H;
console.log(`pixels=${total} opaque=${opaque} semi=${semi} transparent=${transparent}`);
console.log('alpha histogram (bins of 32):', alphaHist.join(','));

// Threshold for "content"
const TH = 8;
const on = (x, y) => rgba[(y * W + x) * 4 + 3] > TH;

// density map: cell grid
const CW = 96, CH = 48; // columns, rows of the ascii map
const cellW = W / CW, cellH = H / CH;
let lines = [];
for (let cy = 0; cy < CH; cy++) {
  let row = '';
  for (let cx = 0; cx < CW; cx++) {
    let cnt = 0, n = 0;
    const x0 = Math.floor(cx * cellW), x1 = Math.min(W, Math.ceil((cx + 1) * cellW));
    const y0 = Math.floor(cy * cellH), y1 = Math.min(H, Math.ceil((cy + 1) * cellH));
    for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) { n++; if (on(x, y)) cnt++; }
    const f = n ? cnt / n : 0;
    row += f > 0.5 ? '#' : f > 0.2 ? '+' : f > 0.05 ? '.' : f > 0 ? ':' : ' ';
  }
  lines.push(row);
}
console.log('\n--- density map (' + CW + 'x' + CH + ' cells) ---');
console.log('    ' + Array.from({ length: CW }, (_, i) => (i % 10 === 0 ? String((i / 10) % 10) : ' ')).join(''));
lines.forEach((l, i) => console.log(String(i).padStart(3, ' ') + ' ' + l));

// row projection: which rows are empty
const rowEmpty = [];
for (let y = 0; y < H; y++) {
  let any = false;
  for (let x = 0; x < W; x++) if (on(x, y)) { any = true; break; }
  rowEmpty.push(!any);
}
const colEmpty = [];
for (let x = 0; x < W; x++) {
  let any = false;
  for (let y = 0; y < H; y++) if (on(x, y)) { any = true; break; }
  colEmpty.push(!any);
}
function bands(empty) {
  const out = [];
  let s = -1;
  for (let i = 0; i < empty.length; i++) {
    if (!empty[i] && s < 0) s = i;
    else if (empty[i] && s >= 0) { out.push([s, i - 1]); s = -1; }
  }
  if (s >= 0) out.push([s, empty.length - 1]);
  return out;
}
console.log('\nrow content bands:', JSON.stringify(bands(rowEmpty).map(b => b[0] + '-' + b[1])));
console.log('col content bands:', JSON.stringify(bands(colEmpty).map(b => b[0] + '-' + b[1])));
