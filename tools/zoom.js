'use strict';
// Zoom a region of a sheet (with alpha flattened onto white) for visual inspection.
// Usage: node tools/zoom.js <in.png> <out.png> <x> <y> <w> <h> [scale]
const { decode, encode, crop } = require('./pnglib');
const fs = require('fs');
const [inFile, outFile, x, y, w, h, scaleArg] = process.argv.slice(2);
const scale = Number(scaleArg ?? 2);
const img = decode(inFile);
const px = crop(img.rgba, img.width, img.height, Number(x), Number(y), Number(w), Number(h));
const sw = Math.round(Number(w) * scale), sh = Math.round(Number(h) * scale);
const out = Buffer.alloc(sw * sh * 4);
for (let yy = 0; yy < sh; yy++) {
  for (let xx = 0; xx < sw; xx++) {
    const sx = Math.min(Number(w) - 1, Math.floor(xx / scale));
    const sy = Math.min(Number(h) - 1, Math.floor(yy / scale));
    const si = (sy * Number(w) + sx) * 4;
    const a = px[si + 3] / 255;
    const di = (yy * sw + xx) * 4;
    out[di] = Math.round(px[si] * a + 255 * (1 - a));
    out[di + 1] = Math.round(px[si + 1] * a + 255 * (1 - a));
    out[di + 2] = Math.round(px[si + 2] * a + 255 * (1 - a));
    out[di + 3] = 255;
  }
}
fs.writeFileSync(outFile, encode(sw, sh, out, 6));
console.log(`${outFile} ${sw}x${sh}`);
