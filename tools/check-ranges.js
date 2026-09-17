/* ============================================================
   校验山系（terrain.js 的 RANGES）
   ----------------------------------------------------------
   改山脉的脊线或宽度之后跑一遍，确认三件事：
     1. 位置——脊线采样点落在哪些省（用 src/data/china.geo.js 的真实省界做点在多边形内）
     2. 尺度——长度（沿脊线累加）与宽度（w 换算成公里）是否与真实山脉同一量级
     3. 出海——有多少采样点不在国境内（国境线上的山脉越界是正常的，记下来心里有数）

   用法：node tools/check-ranges.js
   ============================================================ */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

/* ---------- 读数据：terrain.js 里的 RANGES 是未加引号的数组字面量，用 eval ---------- */
function readRanges() {
  const src = fs.readFileSync(path.join(ROOT, "src/engine/terrain.js"), "utf8");
  const m = /var RANGES = (\[[\s\S]*?\n  \]);/.exec(src);
  if (!m) throw new Error("terrain.js 里找不到 RANGES");
  return eval(m[1]);
}

/* ---------- 读省界：china.geo.js 是 ESM，取出对象字面量即可 JSON.parse ---------- */
function readGeo() {
  const src = fs.readFileSync(path.join(ROOT, "src/data/china.geo.js"), "utf8");
  return JSON.parse(src.slice(src.indexOf("{"), src.lastIndexOf("}") + 1));
}

/* ---------- 几何 ---------- */
function ringsOf(feature) {
  const g = feature.geometry;
  const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  const out = [];
  polys.forEach(function (poly) { poly.forEach(function (ring) { out.push(ring); }); });
  return out;
}
function inRing(pt, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    const hit = (yi > pt[1]) !== (yj > pt[1]) &&
      pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi + 1e-12) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}
function provinceAt(pt, features) {
  const hits = [];
  for (const f of features) {
    let inside = false;
    for (const r of ringsOf(f)) if (inRing(pt, r)) inside = !inside;   // 奇偶：内环＝飞地，要挖掉
    if (inside) hits.push(f.properties.name);
  }
  return hits;
}

/* 与 terrain.js 同一套 Catmull-Rom，保证量的是真正画出来的那条脊线 */
function smoothSpine(spine, per) {
  const n = spine.length;
  if (n < 3) return spine.slice();
  per = per || 8;
  const p = [spine[0]].concat(spine).concat([spine[n - 1]]);
  const out = [];
  for (let i = 1; i < p.length - 2; i++) {
    const p0 = p[i - 1], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2];
    for (let j = 0; j < per; j++) {
      const t = j / per, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  out.push(spine[n - 1]);
  return out;
}
function km(a, b) {
  const dLat = (b[0] - a[0]) * 111.19;
  const dLng = (b[1] - a[1]) * 111.19 * Math.cos((((a[0] + b[0]) / 2) * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}
function lengthKm(pts) {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += km(pts[i - 1], pts[i]);
  return s;
}

/* ---------- 期望：真实山脉的粗略量级 [最短, 最长, 最窄, 最宽, 应落省份] ---------- */
const EXPECT = {
  天山: [1000, 2600, 200, 400, ["新疆"]],
  阿尔泰山: [350, 700, 120, 250, ["新疆"]],
  昆仑山: [1200, 2600, 150, 350, ["新疆", "青海", "西藏"]],
  喜马拉雅: [1000, 1800, 120, 260, ["西藏"]],
  唐古拉山: [450, 900, 60, 140, ["西藏", "青海"]],
  祁连山: [500, 900, 80, 220, ["青海", "甘肃"]],
  秦岭: [600, 1200, 80, 180, ["陕西", "甘肃", "河南", "四川", "湖北"]],
  大巴山: [300, 600, 60, 180, ["陕西", "四川", "重庆", "湖北"]],
  太行山: [400, 700, 60, 150, ["山西", "河北", "河南"]],
  大兴安岭: [500, 1000, 150, 350, ["内蒙古", "黑龙江"]],
  小兴安岭: [250, 500, 80, 220, ["黑龙江"]],
  长白山: [300, 600, 100, 250, ["吉林", "辽宁", "黑龙江"]],
  横断山: [600, 1100, 150, 350, ["四川", "西藏", "云南"]],
  云贵高原: [400, 1000, 100, 400, ["云南", "贵州"]],
  南岭: [400, 800, 80, 220, ["江西", "湖南", "广东", "广西"]],
  武夷山: [300, 650, 60, 180, ["福建", "江西"]],
  大别山: [250, 500, 60, 160, ["安徽", "湖北", "河南"]],
  阴山: [500, 1100, 40, 160, ["内蒙古"]],
  贺兰山: [130, 260, 30, 80, ["内蒙古", "宁夏"]],
  六盘山: [150, 320, 30, 80, ["宁夏", "甘肃", "陕西"]],
  泰山: [40, 220, 25, 90, ["山东"]],
  中央山脉: [250, 400, 40, 110, ["台湾"]],
};

/* ---------- 跑 ---------- */
const RANGES = readRanges();
const feats = readGeo().features;
const rows = [];

RANGES.forEach(function (r) {
  const sp = smoothSpine(r.spine, 8);
  const len = lengthKm(sp);
  const wKm = r.w * 111.19;
  const provs = {};
  let outside = 0;
  const step = Math.max(1, Math.floor(sp.length / 60));
  let samples = 0;
  for (let i = 0; i < sp.length; i += step) {
    samples++;
    const hit = provinceAt([sp[i][1], sp[i][0]], feats);   // 脊线是 [lat,lng]，省界是 [lng,lat]
    if (!hit.length) outside++;
    hit.forEach(function (n) { provs[n] = (provs[n] || 0) + 1; });
  }
  const found = Object.keys(provs).sort(function (a, b) { return provs[b] - provs[a]; });
  const e = EXPECT[r.name];
  const problems = [];
  if (!e) {
    problems.push("无期望值，请补 EXPECT");
  } else {
    if (len < e[0] * 0.8 || len > e[1] * 1.2) problems.push("长度 " + Math.round(len) + "km 偏离常见区间 " + e[0] + "-" + e[1]);
    if (wKm < e[2] * 0.8 || wKm > e[3] * 1.2) problems.push("宽度 " + Math.round(wKm) + "km 偏离常见区间 " + e[2] + "-" + e[3]);
    const ok = found.some(function (n) { return e[4].some(function (k) { return n.indexOf(k) === 0; }); });
    if (found.length && !ok) problems.push("落在 " + found.slice(0, 3).join("/") + "，预期 " + e[4].join("/"));
  }
  rows.push({
    name: r.name, len: Math.round(len), wKm: Math.round(wKm),
    provinces: found.slice(0, 4).join(" "),
    outside: outside + "/" + samples,
    problems: problems.join("；"),
  });
});

const pad = function (s, n) { s = String(s); return s + " ".repeat(Math.max(0, n - s.length)); };
console.log(pad("山系", 12) + pad("长km", 7) + pad("宽km", 8) + pad("省份", 34) + pad("境外", 8) + "问题");
rows.forEach(function (r) {
  console.log(pad(r.name, 12) + pad(r.len, 7) + pad(r.wKm, 8) + pad(r.provinces, 34) + pad(r.outside, 8) + r.problems);
});
const bad = rows.filter(function (r) { return r.problems; });
console.log("\n" + rows.length + " 条山系，" + bad.length + " 条需要留意" +
  (bad.length ? "：" + bad.map(function (r) { return r.name; }).join("、") : ""));
