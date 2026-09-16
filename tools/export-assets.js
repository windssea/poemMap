'use strict';
/**
 * Export a plan's assets as individual transparent PNGs.
 * Transparency is preserved: each crop is trimmed to its own alpha bounds plus a
 * small margin, so no opaque border is introduced.
 *
 * Usage: node tools/export-assets.js <plan.json> [--out <dir>]
 */
const fs = require('fs');
const path = require('path');
const { decode, encode, crop } = require('./pnglib');
const { buildAssets } = require('./asset-plan');

const planPath = process.argv[2];
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const root = path.resolve(__dirname, '..');
const sheetPath = path.isAbsolute(plan.sheet) ? plan.sheet : path.join(root, plan.sheet);
const outIdx = process.argv.indexOf('--out');
const outDir = path.resolve(root, outIdx > 0 ? process.argv[outIdx + 1] : plan.outDir);

const img = decode(sheetPath);
const { width: W, height: H, rgba } = img;
const { assets } = buildAssets(rgba, W, H, plan);

fs.mkdirSync(outDir, { recursive: true });

const margin = plan.margin ?? 2;
const alphaFloor = plan.trimAlpha ?? 2;

/** Trim a crop to the rows/cols that carry alpha above `alphaFloor`. */
function trim(px, w, h) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (px[(y * w + x) * 4 + 3] <= alphaFloor) continue;
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  return { x0, y0, x1, y1 };
}

const used = new Map();
const manifest = [];
for (const a of assets) {
  const x0 = Math.max(0, a.x0 - margin), y0 = Math.max(0, a.y0 - margin);
  const x1 = Math.min(W - 1, a.x1 + margin), y1 = Math.min(H - 1, a.y1 + margin);
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const px = crop(rgba, W, H, x0, y0, w, h);
  const t = trim(px, w, h);
  if (!t) {
    console.log(`skip empty asset "${a.name}" at ${a.x0},${a.y0}`);
    continue;
  }
  const tw = t.x1 - t.x0 + 1, th = t.y1 - t.y0 + 1;
  const trimmed = crop(px, w, h, t.x0, t.y0, tw, th);

  let base = String(a.name).replace(/[\\/:*?"<>|\s]+/g, '_').replace(/^_+|_+$/g, '');
  if (!base) base = 'asset';
  const n = (used.get(base) || 0) + 1;
  used.set(base, n);
  const file = n > 1 ? `${base}-${n}.png` : `${base}.png`;

  fs.writeFileSync(path.join(outDir, file), encode(tw, th, trimmed, 9));
  manifest.push({
    file,
    name: a.name,
    source: { sheet: path.relative(root, sheetPath).replace(/\\/g, '/'), x: x0 + t.x0, y: y0 + t.y0 },
    width: tw,
    height: th,
    parts: a.parts,
  });
}

manifest.sort((a, b) => a.file.localeCompare(b.file, 'zh'));
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify({
  sourceSheet: path.relative(root, sheetPath).replace(/\\/g, '/'),
  sheetSize: [W, H],
  count: manifest.length,
  assets: manifest,
}, null, 2), 'utf8');

console.log(`exported ${manifest.length} assets -> ${outDir}`);
for (const m of manifest) console.log(`  ${m.file}  ${m.width}x${m.height}  (from ${m.source.x},${m.source.y})`);
