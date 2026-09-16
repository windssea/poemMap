'use strict';
/**
 * Segment a sprite sheet into independent assets by alpha connected components.
 * Uses union-find with a configurable pixel gap so soft/antialiased edges stay together.
 */
const { decode, encode, crop } = require('./pnglib');
const fs = require('fs');
const path = require('path');

function segment(rgba, W, H, opts = {}) {
  const alphaMin = opts.alphaMin ?? 16;   // pixel counts as content above this alpha
  const gap = opts.gap ?? 2;              // max transparent gap bridged between content pixels
  const minPixels = opts.minPixels ?? 60;  // discard specks
  const minSide = opts.minSide ?? 4;
  const keepPixels = opts.keepPixels ?? 900; // flagged as noise below this (still indexed)
  // optional rectangular search window (used to peel one asset out of a merged blob)
  const rx0 = opts.restrict ? Math.max(0, opts.restrict[0]) : 0;
  const ry0 = opts.restrict ? Math.max(0, opts.restrict[1]) : 0;
  const rx1 = opts.restrict ? Math.min(W - 1, opts.restrict[2]) : W - 1;
  const ry1 = opts.restrict ? Math.min(H - 1, opts.restrict[3]) : H - 1;

  const mask = new Uint8Array(W * H);
  for (let i = 0, p = 3; i < W * H; i++, p += 4) mask[i] = rgba[p] > alphaMin ? 1 : 0;

  const parent = new Int32Array(W * H).fill(-1);
  const find = (a) => {
    let r = a;
    while (parent[r] !== r) r = parent[r];
    while (parent[a] !== r) { const n = parent[a]; parent[a] = r; a = n; }
    return r;
  };
  const union = (a, b) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  for (let y = ry0; y <= ry1; y++) {
    for (let x = rx0; x <= rx1; x++) {
      const i = y * W + x;
      if (!mask[i]) continue;
      parent[i] = i;
      const y0 = Math.max(ry0, y - gap), x0 = Math.max(rx0, x - gap);
      for (let ny = y0; ny <= y; ny++) {
        for (let nx = x0; nx <= x; nx++) {
          const j = ny * W + nx;
          if (j === i || !mask[j]) continue;
          const dx = x - nx, dy = y - ny;
          if (dx * dx + dy * dy <= gap * gap + 1) union(i, j);
        }
      }
    }
  }

  // collect boxes per root
  const boxes = new Map();
  for (let y = ry0; y <= ry1; y++) {
    for (let x = rx0; x <= rx1; x++) {
      const i = y * W + x;
      if (!mask[i]) continue;
      const r = find(i);
      let b = boxes.get(r);
      if (!b) { b = { x0: x, y0: y, x1: x, y1: y, n: 0, sumA: 0 }; boxes.set(r, b); }
      if (x < b.x0) b.x0 = x;
      if (y < b.y0) b.y0 = y;
      if (x > b.x1) b.x1 = x;
      if (y > b.y1) b.y1 = y;
      b.n++;
      b.sumA += rgba[i * 4 + 3];
    }
  }

  // canonicalise roots so callers can map root -> component
  const byRoot = new Map();
  for (const [r, b] of boxes) {
    const cr = find(r);
    const e = byRoot.get(cr);
    if (!e) { b.root = cr; byRoot.set(cr, b); }
    else {
      e.x0 = Math.min(e.x0, b.x0); e.y0 = Math.min(e.y0, b.y0);
      e.x1 = Math.max(e.x1, b.x1); e.y1 = Math.max(e.y1, b.y1);
      e.n += b.n; e.sumA += b.sumA;
    }
  }
  let list = [...byRoot.values()].filter((b) => b.n >= minPixels);
  list = list.filter((b) => (b.x1 - b.x0 + 1) >= minSide && (b.y1 - b.y0 + 1) >= minSide);
  list.sort((a, b) => (a.y0 - b.y0) || (a.x0 - b.x0));
  list.forEach((b) => { b.keep = b.n >= keepPixels; });
  return { list, mask, minPixels, keepPixels, alphaMin, findRoot: find };
}

/** Merge boxes that overlap/nearly touch after accounting for the halo. */
function pad(b, p) {
  return { x0: b.x0 - p, y0: b.y0 - p, x1: b.x1 + p, y1: b.y1 + p };
}
function overlapArea(a, b) {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  return w > 0 && h > 0 ? w * h : 0;
}
function absorb(cands, W, H, padPx, minPixels) {
  // Any component whose box lies inside a bigger component's box is absorbed into it.
  const out = [];
  const sorted = [...cands].sort((a, b) => b.n - a.n);
  const used = new Array(sorted.length).fill(false);
  for (let i = 0; i < sorted.length; i++) {
    if (used[i]) continue;
    const host = { ...sorted[i] };
    used[i] = true;
    for (let j = i + 1; j < sorted.length; j++) {
      if (used[j]) continue;
      const c = sorted[j];
      if (c.n > host.n) continue;
      const inner = (c.n / host.n) < 0.02; // only truly tiny specks
      const inside = c.x0 >= host.x0 - padPx && c.x1 <= host.x1 + padPx && c.y0 >= host.y0 - padPx && c.y1 <= host.y1 + padPx;
      if (inside && inner) {
        used[j] = true;
        host.x0 = Math.min(host.x0, c.x0); host.y0 = Math.min(host.y0, c.y0);
        host.x1 = Math.max(host.x1, c.x1); host.y1 = Math.max(host.y1, c.y1);
        host.n += c.n;
        host.keep = true;
      }
    }
    out.push(host);
  }
  out.sort((a, b) => (a.y0 - b.y0) || (a.x0 - b.x0));
  return out;
}

module.exports = { segment, absorb, overlapArea, calibrate };

/**
 * Merge components whose bounding boxes nearly touch.
 * `reach` is the max gap (px) between content boxes that still counts as one asset;
 * this reconnects pieces that a faint transparent halo had cut apart.
 */
function calibrate(list, gapPx) {
  const boxes = list.map((b) => ({ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1, n: b.n }));
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < boxes.length && !changed; i++) {
      for (let j = i + 1; j < boxes.length && !changed; j++) {
        const a = boxes[i], b = boxes[j];
        const dx = Math.max(0, Math.max(a.x0 - b.x1, b.x0 - a.x1));
        const dy = Math.max(0, Math.max(a.y0 - b.y1, b.y0 - a.y1));
        if (dx <= gapPx && dy <= gapPx) {
          a.x0 = Math.min(a.x0, b.x0); a.y0 = Math.min(a.y0, b.y0);
          a.x1 = Math.max(a.x1, b.x1); a.y1 = Math.max(a.y1, b.y1);
          a.n += b.n;
          boxes.splice(j, 1);
          changed = true;
        }
      }
    }
  }
  boxes.sort((p, q) => (p.y0 - q.y0) || (p.x0 - q.x0));
  return boxes;
}

if (require.main === module) {
  const file = process.argv[2];
  const outJson = process.argv[3];
  const gap = Number(process.argv[4] ?? 2);
  const img = decode(file);
  const { width: W, height: H, rgba } = img;
  const { list } = segment(rgba, W, H, { gap });
  const merged = absorb(list, W, H, 2);
  console.log(`components(gap=${gap}): ${list.length} -> after absorb: ${merged.length}`);
  const report = merged.map((b, i) => {
    const w = b.x1 - b.x0 + 1, h = b.y1 - b.y0 + 1;
    return { i, x: b.x0, y: b.y0, w, h, n: b.n, fill: +(b.n / (w * h)).toFixed(3) };
  });
  console.log('idx   x    y     w    h    px   fill');
  for (const r of report) {
    console.log(
      String(r.i).padStart(3) + ' ' + String(r.x).padStart(4) + ' ' + String(r.y).padStart(4) + ' ' +
      String(r.w).padStart(4) + ' ' + String(r.h).padStart(4) + ' ' + String(r.n).padStart(6) + ' ' + r.fill
    );
  }
  if (outJson) {
    fs.mkdirSync(path.dirname(outJson), { recursive: true });
    fs.writeFileSync(outJson, JSON.stringify(report, null, 2));
  }

  // write a contact sheet overlay: each box outlined on a downscaled copy
  const scale = Math.min(1, 900 / W);
  const sw = Math.round(W * scale), sh = Math.round(H * scale);
  const out = Buffer.alloc(sw * sh * 4);
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const si = ((Math.floor(y / scale) * W) + Math.floor(x / scale)) * 4;
      const di = (y * sw + x) * 4;
      const a = rgba[si + 3] / 255;
      // white background so faint art is visible
      out[di] = Math.round(rgba[si] * a + 255 * (1 - a));
      out[di + 1] = Math.round(rgba[si + 1] * a + 255 * (1 - a));
      out[di + 2] = Math.round(rgba[si + 2] * a + 255 * (1 - a));
      out[di + 3] = 255;
    }
  }
  let idx = 0;
  for (const b of merged) {
    const hx0 = Math.max(0, Math.round(b.x0 * scale)), hx1 = Math.min(sw - 1, Math.round(b.x1 * scale));
    const hy0 = Math.max(0, Math.round(b.y0 * scale)), hy1 = Math.min(sh - 1, Math.round(b.y1 * scale));
    const colors = [[255, 0, 0], [0, 130, 255], [0, 170, 0], [255, 0, 255], [255, 140, 0]];
    const c = colors[idx % colors.length];
    const put = (x, y) => {
      if (x < 0 || y < 0 || x >= sw || y >= sh) return;
      const di = (y * sw + x) * 4;
      out[di] = c[0]; out[di + 1] = c[1]; out[di + 2] = c[2]; out[di + 3] = 255;
    };
    for (let x = hx0; x <= hx1; x++) { put(x, hy0); put(x, hy1); }
    for (let y = hy0; y <= hy1; y++) { put(hx0, y); put(hx1, y); }
    idx++;
  }
  fs.mkdirSync(path.dirname(outJson || 'tmp/x'), { recursive: true });
  fs.writeFileSync((outJson || 'tmp/boxes.json').replace(/\.json$/, '-overlay.png'), encode(sw, sh, out));
  console.log('overlay: ' + (outJson || 'tmp/boxes.json').replace(/\.json$/, '-overlay.png'));
}
