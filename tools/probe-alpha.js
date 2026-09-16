'use strict';
// Probe: alpha profiles along specific scanlines/columns, to calibrate gap thresholds.
const { decode } = require('./pnglib');
const img = decode(process.argv[2]);
const { width: W, height: H, rgba } = img;
const A = (x, y) => rgba[(y * W + x) * 4 + 3];

const mode = process.argv[3] || 'col';
if (mode === 'col') {
  // vertical profile: for each y, the max alpha across x range
  const x0 = Number(process.argv[4]), x1 = Number(process.argv[5]);
  const y0 = Number(process.argv[6] ?? 0), y1 = Number(process.argv[7] ?? H - 1);
  for (let y = y0; y <= y1; y++) {
    let mx = 0, at = -1;
    for (let x = x0; x <= x1; x++) { const a = A(x, y); if (a > mx) { mx = a; at = x; } }
    if (y % 1 === 0) console.log(String(y).padStart(5) + ' max=' + String(mx).padStart(3) + ' x=' + at);
  }
} else if (mode === 'row') {
  const y0 = Number(process.argv[4]), y1 = Number(process.argv[5]);
  const x0 = Number(process.argv[6] ?? 0), x1 = Number(process.argv[7] ?? W - 1);
  for (let x = x0; x <= x1; x++) {
    let mx = 0, at = -1;
    for (let y = y0; y <= y1; y++) { const a = A(x, y); if (a > mx) { mx = a; at = y; } }
    console.log(String(x).padStart(5) + ' max=' + String(mx).padStart(3) + ' y=' + at);
  }
} else if (mode === 'pt') {
  const x = Number(process.argv[4]), y = Number(process.argv[5]);
  const r = Number(process.argv[6] ?? 12);
  for (let yy = y - r; yy <= y + r; yy++) {
    let row = String(yy).padStart(5) + ' ';
    for (let xx = x - r; xx <= x + r; xx++) {
      const a = A(xx, yy);
      row += a === 0 ? '.' : a < 32 ? ':' : a < 96 ? '+' : a < 200 ? '*' : '#';
    }
    console.log(row);
  }
}
