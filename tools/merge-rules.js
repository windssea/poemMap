'use strict';
/**
 * Curated merge rules.
 * Rules are anchored by top-left coordinates (stable across runs), never by index.
 *
 * rules = {
 *   merge: [ [[x,y], [x,y], ...], ... ],   // components listed here become one asset
 *   separate: [ [[x,y], [x,y]], ... ]      // anchors explicitly kept apart (documents intent)
 * }
 *
 * A rule matches a component when the anchor lies inside that component's box.
 * Anchors usually come from a printed component listing.
 */
function resolve(comps, anchors) {
  const hits = new Set();
  for (const [ax, ay] of anchors) {
    let best = -1, bestArea = Infinity;
    for (let i = 0; i < comps.length; i++) {
      const c = comps[i];
      if (ax < c.x0 || ax > c.x1 || ay < c.y0 || ay > c.y1) continue;
      const area = (c.x1 - c.x0 + 1) * (c.y1 - c.y0 + 1);
      if (area < bestArea) { bestArea = area; best = i; }
    }
    if (best < 0) throw new Error(`merge anchor ${ax},${ay} matched no component`);
    hits.add(best);
  }
  return hits;
}

function applyOverrides(list, W, H, rules) {
  const comps = list.map((b) => ({ ...b }));
  const consumed = new Set();
  const out = [];
  for (const group of rules.merge || []) {
    const idxs = resolve(comps, group);
    const host = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity, n: 0, sumA: 0, keep: true };
    for (const i of idxs) {
      const c = comps[i];
      host.x0 = Math.min(host.x0, c.x0); host.y0 = Math.min(host.y0, c.y0);
      host.x1 = Math.max(host.x1, c.x1); host.y1 = Math.max(host.y1, c.y1);
      host.n += c.n; host.sumA += c.sumA;
      consumed.add(i);
    }
    out.push(host);
  }
  comps.forEach((c, i) => { if (!consumed.has(i)) out.push(c); });
  out.sort((a, b) => (a.y0 - b.y0) || (a.x0 - b.x0));
  return out;
}

/** Drop boxes matched by anchor list (used to discard noise fragments). */
function dropByAnchors(list, anchors) {
  if (!anchors || !anchors.length) return list;
  const idxs = resolve(list, anchors);
  return list.filter((_, i) => !idxs.has(i));
}

const { calibrate } = require('./segment-sheet');

/** Drop components smaller than minPixels (noise specks). */
function dropSpecks(list, minPixels) {
  return list.filter((b) => b.n >= minPixels);
}

module.exports = { applyOverrides, dropByAnchors, resolve, dropSpecks };
