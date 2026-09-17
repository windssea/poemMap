/* ============================================================
   几何工具（与旧版逐行一致，仅改为 ESM 导出）
   ============================================================ */

/** Catmull-Rom 重采样：把稀疏折线加密成平滑曲线 */
export function smoothPath(pts, seg) {
  if (!pts || pts.length < 3) return pts;
  const out = [];
  const n = pts.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(n - 1, i + 2)];
    for (let j = 0; j < seg; j++) {
      const t = j / seg, t2 = t * t, t3 = t2 * t;
      const lat = 0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t +
        (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
        (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
      const lng = 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t +
        (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
        (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
      out.push([lat, lng]);
    }
  }
  out.push(pts[n - 1]);
  return out;
}

/** Douglas–Peucker 抽稀：省区只是晕染色块，容差之内肉眼无差 */
export function simplifyRing(ring, tol) {
  const n = ring.length;
  if (n < 8) return ring;
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack = [0, n - 1];
  const tol2 = tol * tol;
  while (stack.length) {
    const b = stack.pop(), a = stack.pop();
    const ax = ring[a][0], ay = ring[a][1];
    const dx = ring[b][0] - ax, dy = ring[b][1] - ay;
    const dd = dx * dx + dy * dy;
    let best = -1, bi = -1;
    for (let i = a + 1; i < b; i++) {
      const px = ring[i][0] - ax, py = ring[i][1] - ay;
      let t = dd ? (px * dx + py * dy) / dd : 0;
      if (t < 0) t = 0; else if (t > 1) t = 1;
      const qx = px - dx * t, qy = py - dy * t;
      const d2 = qx * qx + qy * qy;
      if (d2 > best) { best = d2; bi = i; }
    }
    if (best > tol2) { keep[bi] = 1; stack.push(a, bi, bi, b); }
  }
  const out = [];
  for (let k = 0; k < n; k++) if (keep[k]) out.push(ring[k]);
  return out.length > 3 ? out : ring;
}

export function simplifyProvince(f, tol) {
  const g = f.geometry;
  if (!g || !g.coordinates) return f;
  const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  const outPolys = polys.map(function (poly) {
    return poly.map(function (ring) { return simplifyRing(ring, tol); });
  });
  return {
    type: f.type,
    properties: f.properties,
    geometry: {
      type: g.type,
      coordinates: g.type === "Polygon" ? outPolys[0] : outPolys,
    },
  };
}

export function countPts(list) {
  let n = 0;
  list.forEach(function (f) {
    const g = f.geometry;
    if (!g || !g.coordinates) return;
    const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
    polys.forEach(function (p) { p.forEach(function (r) { n += r.length; }); });
  });
  return n;
}
