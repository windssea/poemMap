'use strict';
// Show, for every name in a plan, the nearest built assets and their centre distance.
// Usage: node tools/plan-centres.js <plan.json>
const fs = require('fs');
const path = require('path');
const { decode } = require('./pnglib');
const { buildAssets } = require('./asset-plan');

const plan = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const root = path.resolve(__dirname, '..');
const sheetPath = path.isAbsolute(plan.sheet) ? plan.sheet : path.join(root, plan.sheet);
const img = decode(sheetPath);
const bare = { ...plan, names: [] };
const { assets } = buildAssets(img.rgba, img.width, img.height, bare);
// assets were sorted by position inside buildAssets; match each name to its best 3
const rows = (plan.names || []).map((n) => {
  const ds = assets.map((a, i) => ({
    i, d: Math.hypot(a.visualCentre[0] - n.at[0], a.visualCentre[1] - n.at[1]),
  })).sort((p, q) => p.d - q.d);
  return { n, ds };
});
console.log('name                     at          best assets (dist, index, box)');
for (const r of rows) {
  const best = r.ds.slice(0, 3).map((d) => {
    const a = assets[d.i];
    return `${d.d.toFixed(0)}px #${d.i}[${a.x0},${a.y0} ${a.w}x${a.h} vc=${a.visualCentre.join(',')}]`;
  }).join('  |  ');
  console.log(`${(r.n.name + '                        ').slice(0, 24)} [${r.n.at}]  ${best}`);
}
console.log('\nassets (sorted):');
assets.forEach((a, i) => {
  console.log(`  #${String(i).padStart(2)} ${String(a.x0).padStart(4)},${String(a.y0).padStart(4)} ${String(a.w).padStart(4)}x${String(a.h).padStart(4)} vc=${a.visualCentre.join(',')} px=${a.n}`);
});
