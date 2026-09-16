'use strict';
/**
 * Asset plan engine.
 *
 * A plan turns a raw component list into named assets by label-map surgery:
 *   1. `peel`  – re-segment inside a rectangle and reassign those pixels to the sub-parts,
 *                so one asset can be pulled out of a blob containing several assets
 *   2. `drop`  – discard speck/noise components (by anchor or size)
 *   3. `merge` – combine an anchor group into a single asset
 *   4. leftovers become their own assets
 *   5. `names` – bind human names to assets by centre distance
 *
 * Anchors are [x, y] points; a point binds to the smallest component containing it.
 */
const { segment } = require('./segment-sheet');

function centreOf(b) {
  return [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2];
}

function bind(comps, anchors, label) {
  const hits = new Set();
  for (const [ax, ay] of anchors) {
    let best = -1, bestArea = Infinity;
    for (let i = 0; i < comps.length; i++) {
      const c = comps[i];
      if (ax < c.x0 || ax > c.x1 || ay < c.y0 || ay > c.y1) continue;
      const area = (c.x1 - c.x0 + 1) * (c.y1 - c.y0 + 1);
      if (area < bestArea) { bestArea = area; best = i; }
    }
    if (best < 0) throw new Error(`${label}: anchor ${ax},${ay} matched no component`);
    hits.add(best);
  }
  return hits;
}

function countersFromLabels(W, H, label, count) {
  const out = Array.from({ length: count }, () => ({
    x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity, n: 0, sumA: 0, keep: true,
  }));
  for (let i = 0; i < W * H; i++) {
    const l = label[i];
    if (l < 0) continue;
    const x = i % W, y = (i / W) | 0;
    const b = out[l];
    if (x < b.x0) b.x0 = x;
    if (y < b.y0) b.y0 = y;
    if (x > b.x1) b.x1 = x;
    if (y > b.y1) b.y1 = y;
    b.n++;
  }
  return out.map((b, i) => (b.n > 0 ? { ...b, i } : null)).filter(Boolean);
}

/**
 * @param {Buffer} rgba  RGBA8 pixels
 * @param {number} W
 * @param {number} H
 * @param {object} plan  { gap, alphaMin, dropUnder, peel:[], drop:[], merge:[], names:[] }
 */
function buildAssets(rgba, W, H, plan) {
  const gap = plan.gap ?? 1;
  const alphaMin = plan.alphaMin ?? 4;
  const dropUnder = plan.dropUnder ?? 0;

  const seg0 = segment(rgba, W, H, { gap, alphaMin });
  const raw = seg0.list;
  const findRoot = seg0.findRoot;
  const rootToIdx = new Map();
  raw.forEach((b, i) => rootToIdx.set(b.root, i));

  // global label map for the raw components
  const label = new Int32Array(W * H).fill(-1);
  for (let i = 0; i < W * H; i++) {
    if (rgba[i * 4 + 3] <= alphaMin) continue;
    const v = rootToIdx.get(findRoot(i));
    // components smaller than minPixels were filtered out of `raw`; ignore their pixels
    label[i] = v === undefined ? -1 : v;
  }

  const components = raw.map((b, i) => ({ ...b, i }));
  const peelLog = [];

  // ---------- 1. peel ----------
  // A peel names one merged blob (by an anchor point) and splits it into its sprites:
  // the blob's own box is re-segmented at a higher alpha ("core") threshold so faint
  // halos stop bridging neighbours, then every blob pixel joins its nearest core.
  // Pixels too far from any core fall back to the region centre, never to a neighbour.
  let nextLabel = components.length;
  for (const p of plan.peel || []) {
    const [ax, ay] = p.anchor;
    let hostIdx = -1, hostArea = Infinity;
    for (let i = 0; i < components.length; i++) {
      const c = components[i];
      if (ax < c.x0 || ax > c.x1 || ay < c.y0 || ay > c.y1) continue;
      const area = (c.x1 - c.x0 + 1) * (c.y1 - c.y0 + 1);
      if (area < hostArea) { hostArea = area; hostIdx = i; }
    }
    if (hostIdx < 0) throw new Error(`peel "${p.label}": anchor ${ax},${ay} matched no component`);
    const host = components[hostIdx];
    const pad = p.pad ?? 6;
    const rx0 = Math.max(0, host.x0 - pad), ry0 = Math.max(0, host.y0 - pad);
    const rx1 = Math.min(W - 1, host.x1 + pad), ry1 = Math.min(H - 1, host.y1 + pad);
    const coreAlpha = p.coreAlpha ?? 96;
    const coreGap = p.coreGap ?? 2;
    // segment the whole sheet at core alpha, then keep the cores inside the region
    const allCores = segment(rgba, W, H, { gap: coreGap, alphaMin: coreAlpha, minPixels: p.minPixels ?? 150, minSide: 3 }).list;
    const cores = allCores.filter((c) => c.x0 >= rx0 - 2 && c.x1 <= rx1 + 2 && c.y0 >= ry0 - 2 && c.y1 <= ry1 + 2);
    if (!cores.length) throw new Error(`peel "${p.label}": no cores inside ${rx0},${ry0} ${rx1},${ry1}`);
    const partLabels = cores.map(() => nextLabel++);
    const gx = (rx0 + rx1) / 2, gy = (ry0 + ry1) / 2;
    const maxDist2 = (p.maxCoreDist ?? 90) ** 2;
    const assigned = new Map();
    let fellBack = 0;
    for (let y = ry0; y <= ry1; y++) {
      for (let x = rx0; x <= rx1; x++) {
        const i = y * W + x;
        if (label[i] < 0) continue;
        let best = -1, bestD = Infinity;
        for (let k = 0; k < cores.length; k++) {
          const c = cores[k];
          const dx = x < c.x0 ? c.x0 - x : x > c.x1 ? x - c.x1 : 0;
          const dy = y < c.y0 ? c.y0 - y : y > c.y1 ? y - c.y1 : 0;
          const d = dx * dx + dy * dy;
          if (d < bestD) { bestD = d; best = k; }
        }
        if (best >= 0 && bestD <= maxDist2) {
          label[i] = partLabels[best];
          assigned.set(best, (assigned.get(best) || 0) + 1);
        } else {
          // gravity: keep stray halo pixels with the region instead of a neighbour
          label[i] = partLabels[nearestCoreTo(cores, gx, gy)];
          fellBack++;
        }
      }
    }
    peelLog.push({
      label: p.label, region: [rx0, ry0, rx1, ry1], cores: cores.length,
      coresWithPixels: assigned.size, fellBack,
      boxes: cores.map((c, k) => `${c.x0},${c.y0} ${c.x1 - c.x0 + 1}x${c.y1 - c.y0 + 1} px=${assigned.get(k) || 0}`),
    });
  }

  // ---------- rebuild the component list from the (possibly rewritten) label map ----------
  const maxLabel = nextLabel;
  let comps = countersFromLabels(W, H, label, maxLabel);

  // ---------- 2. drop ----------
  const dropped = new Set();
  for (const anchors of plan.drop || []) {
    for (const i of bind(comps, anchors, 'drop')) dropped.add(i);
  }
  if (dropUnder > 0) comps.forEach((c, i) => { if (c.n < dropUnder) dropped.add(i); });

  // ---------- 3. merge ----------
  const consumed = new Set(dropped);
  const assets = [];
  if (process.env.DEBUG_COMPS) {
    console.log('\npost-peel components:');
    comps.forEach((c, i) => {
      console.log(`  #${String(i).padStart(2)} box=${String(c.x0).padStart(4)},${String(c.y0).padStart(4)} ${String(c.x1 - c.x0 + 1).padStart(4)}x${String(c.y1 - c.y0 + 1).padStart(4)} px=${String(c.n).padStart(6)}`);
    });
  }
  if (process.env.DEBUG_MERGE) {
    console.log('\nmerge binding debug:');
  }
  for (const g of plan.merge || []) {
    let allIdx;
    if (g.contains) {
      // group by containment: every component whose box lies inside `contains.r`
      // and (optionally) is no larger than `contains.maxPixels`
      const [gx0, gy0, gx1, gy1] = g.contains.r;
      allIdx = [];
      comps.forEach((c, i) => {
        if (c.x0 < gx0 || c.x1 > gx1 || c.y0 < gy0 || c.y1 > gy1) return;
        if (g.contains.maxPixels && c.n > g.contains.maxPixels) return;
        allIdx.push(i);
      });
    } else {
      allIdx = [...bind(comps, g.anchors, `merge "${g.name}"`)];
    }
    const idxs = allIdx.filter((i) => !consumed.has(i));
    if (process.env.DEBUG_MERGE) {
      console.log(`  merge "${g.name}": anchors bind -> [${allIdx}] available -> [${idxs}]`);
      for (const i of allIdx) {
        const c = comps[i];
        console.log(`      comp #${i} box=${c.x0},${c.y0} ${c.x1 - c.x0 + 1}x${c.y1 - c.y0 + 1} consumed=${consumed.has(i)}`);
      }
    }
    if (!idxs.length) throw new Error(`merge "${g.name}": all anchors already consumed`);
    idxs.forEach((i) => consumed.add(i));
    const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity, n: 0, sumA: 0 };
    for (const i of idxs) {
      const c = comps[i];
      box.x0 = Math.min(box.x0, c.x0); box.y0 = Math.min(box.y0, c.y0);
      box.x1 = Math.max(box.x1, c.x1); box.y1 = Math.max(box.y1, c.y1);
      box.n += c.n; box.sumA += c.sumA;
    }
    box.name = g.name;
    box.parts = idxs.length;
    box._labelIds = idxs.map((i) => comps[i].i);
    assets.push(box);
  }

  // ---------- 4. leftovers ----------
  comps.forEach((c, i) => {
    if (consumed.has(i)) return;
    assets.push({ ...c, name: null, parts: 1 });
  });

  // ---------- 5. naming ----------
  // Match on the alpha-weighted visual centre: bounding-box centres drift badly for
  // L-shaped merges (a map plus its scattered dotted trail, for example).
  // One pass over the canvas computes every asset's visual centre.
  const labelOwner = new Int32Array(maxLabel).fill(-1);
  assets.forEach((a, ai) => {
    if (a._labelIds) a._labelIds.forEach((l) => { labelOwner[l] = ai; });
    else labelOwner[a.i] = ai;
  });
  const sumX = new Float64Array(assets.length), sumY = new Float64Array(assets.length), sumN = new Float64Array(assets.length);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const l = label[y * W + x];
      if (l < 0) continue;
      const o = labelOwner[l];
      if (o < 0) continue;
      sumX[o] += x; sumY[o] += y; sumN[o]++;
    }
  }
  const vc = assets.map((a, ai) => sumN[ai]
    ? [sumX[ai] / sumN[ai], sumY[ai] / sumN[ai]]
    : [(a.x0 + a.x1) / 2, (a.y0 + a.y1) / 2]);
  // attach before any sorting so the centre travels with its asset
  assets.forEach((a, ai) => { a.visualCentre = vc[ai].map((v) => +v.toFixed(1)); });

  const pending = (plan.names || []).map((n) => ({ ...n }));
  const named = new Set();
  const nameReport = [];
  const cand = [];
  for (let pi = 0; pi < pending.length; pi++) {
    for (let ai = 0; ai < assets.length; ai++) {
      cand.push({ pi, ai, d: Math.hypot(vc[ai][0] - pending[pi].at[0], vc[ai][1] - pending[pi].at[1]) });
    }
  }
  cand.sort((a, b) => a.d - b.d);
  if (process.env.SHOW_MATCHES) {
    console.log('\nclosest (name, asset) pairs:');
    for (const c of cand.slice(0, 80)) {
      if (c.d > 240) break;
      console.log(`  ${c.d.toFixed(1).padStart(6)}  "${pending[c.pi].name}"  ->  asset ${c.ai}  vcentre=${vc[c.ai].map((v) => Math.round(v)).join(',')}  box=${assets[c.ai].x0},${assets[c.ai].y0} ${assets[c.ai].x1 - assets[c.ai].x0 + 1}x${assets[c.ai].y1 - assets[c.ai].y0 + 1}`);
    }
  }
  for (const c of cand) {
    if (c.d > (pending[c.pi].maxDist ?? plan.defaultMaxDist ?? 80)) continue;
    if (named.has(c.ai) || pending[c.pi]._used) continue;
    pending[c.pi]._used = true;
    assets[c.ai].name = pending[c.pi].name;
    named.add(c.ai);
    nameReport.push({ name: pending[c.pi].name, asset: c.ai, dist: +c.d.toFixed(1) });
  }
  const unmatched = pending.filter((n) => !n._used);
  if (unmatched.length) {
    const detail = unmatched.map((n) => {
      let best = -1, bestD = Infinity;
      for (let ai = 0; ai < assets.length; ai++) {
        if (named.has(ai)) continue;
        const d = Math.hypot(vc[ai][0] - n.at[0], vc[ai][1] - n.at[1]);
        if (d < bestD) { bestD = d; best = ai; }
      }
      return `${n.name} at=[${n.at}] (nearest free asset ${bestD.toFixed(1)}px away, max ${n.maxDist ?? plan.defaultMaxDist ?? 80})`;
    });
    throw new Error('unmatched names:\n  ' + detail.join('\n  '));
  }
  assets.forEach((a, i) => {
    if (!a.name) {
      a.name = (plan.fallbackPrefix || 'asset') + '-' + String(i).padStart(2, '0');
      a.unnamed = true;
    }
  });
  assets.forEach((a) => { delete a._labels; });

  assets.sort((a, b) => (a.y0 - b.y0) || (a.x0 - b.x0));
  // final normalisation: expose width/height
  assets.forEach((a) => {
    a.w = a.x1 - a.x0 + 1;
    a.h = a.y1 - a.y0 + 1;
    a.keep = true;
  });
  return { assets, peelLog, rawCount: raw.length, nameReport };
}

module.exports = { buildAssets, centreOf, bind };

function nearestCoreTo(cores, x, y) {
  let best = 0, bestD = Infinity;
  for (let k = 0; k < cores.length; k++) {
    const c = cores[k];
    const dx = x < c.x0 ? c.x0 - x : x > c.x1 ? x - c.x1 : 0;
    const dy = y < c.y0 ? c.y0 - y : y > c.y1 ? y - c.y1 : 0;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = k; }
  }
  return best;
}
