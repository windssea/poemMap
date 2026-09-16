/**
 * 从画作中取「区域地形色」（工具，非站点运行时依赖）
 * ----------------------------------------------------------
 * 不直接把画当底图（地理对不齐），而是**参考它的设色**：
 *   1. 用 tools/calibrate-map.js 解出的 bounds，把每个省的经纬范围
 *      换算到画作像素；
 *   2. 在省内网格采样，只取画上不透明的像素；
 *   3. 取中位色作为该省的「地形色」，再按大区汇总成调色板。
 *
 * 输出可直接粘进 js/app.js 的 TINTS。
 *
 * 用法：node tools/palette-from-painting.js [图片路径]
 */
const path = require("path");
const fs = require("fs");
const png = require("./pnglib.js");

const ROOT = path.join(__dirname, "..");
const IMG = process.argv[2] || path.join(ROOT, "assets", "map-painting.png");
const BOUNDS = { south: 17.6, north: 51.6, west: 68.6, east: 133.8 };

const REGION = {
  黑龙江省: "东北", 吉林省: "东北", 辽宁省: "东北",
  北京市: "华北", 天津市: "华北", 河北省: "华北", 山西省: "华北", 内蒙古自治区: "华北",
  上海市: "华东", 江苏省: "华东", 浙江省: "华东", 安徽省: "华东",
  福建省: "华东", 江西省: "华东", 山东省: "华东",
  河南省: "华中", 湖北省: "华中", 湖南省: "华中",
  广东省: "华南", 广西壮族自治区: "华南", 海南省: "华南",
  重庆市: "西南", 四川省: "西南", 贵州省: "西南", 云南省: "西南", 西藏自治区: "西南",
  陕西省: "西北", 甘肃省: "西北", 青海省: "西北",
  宁夏回族自治区: "西北", 新疆维吾尔自治区: "西北",
};

function mercY(lat) {
  const r = (lat * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + r / 2));
}

function pipRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function pipFeature(lng, lat, geom) {
  const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
  for (const poly of polys) {
    if (pipRing(lng, lat, poly[0])) {
      let inHole = false;
      for (let h = 1; h < poly.length; h++) if (pipRing(lng, lat, poly[h])) { inHole = true; break; }
      if (!inHole) return true;
    }
  }
  return false;
}

function median(values) {
  const v = values.slice().sort((a, b) => a - b);
  return v.length ? v[Math.floor(v.length / 2)] : 0;
}

function componentMedian(pixels, ch) {
  const arr = pixels.map((p) => p[ch]);
  return median(arr);
}

function hex(r, g, b) {
  const h = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return "#" + h(r) + h(g) + h(b);
}

const img = png.decode(IMG);
const win = {};
const vm = require("vm");
vm.runInNewContext(fs.readFileSync(path.join(ROOT, "data", "china.geo.js"), "utf8"), { window: win });
const feats = (win.CHINA_GEO.features || []).filter((f) => f.properties.level === "province");

const mN = mercY(BOUNDS.north), mS = mercY(BOUNDS.south);
const byRegion = {};
const byProvince = {};

for (const f of feats) {
  const name = f.properties.name;
  const region = REGION[name] || "其他";
  let minLng = 180, maxLng = -180, minLat = 90, maxLat = -90;
  const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const poly of polys) {
    for (const pt of poly[0]) {
      if (pt[0] < minLng) minLng = pt[0];
      if (pt[0] > maxLng) maxLng = pt[0];
      if (pt[1] < minLat) minLat = pt[1];
      if (pt[1] > maxLat) maxLat = pt[1];
    }
  }
  const step = 0.25;
  const px = [];
  for (let lng = minLng; lng <= maxLng; lng += step) {
    for (let lat = minLat; lat <= maxLat; lat += step) {
      if (!pipFeature(lng, lat, f.geometry)) continue;
      const x = Math.round(((lng - BOUNDS.west) / (BOUNDS.east - BOUNDS.west)) * img.width);
      const y = Math.round(((mN - mercY(lat)) / (mN - mS)) * img.height);
      if (x < 0 || y < 0 || x >= img.width || y >= img.height) continue;
      const i = (y * img.width + x) * 4;
      if (img.rgba[i + 3] < 100) continue;
      px.push([img.rgba[i], img.rgba[i + 1], img.rgba[i + 2]]);
    }
  }
  if (px.length < 6) continue;
  const c = [componentMedian(px, 0), componentMedian(px, 1), componentMedian(px, 2)];
  byProvince[name] = hex(c[0], c[1], c[2]);
  (byRegion[region] = byRegion[region] || []).push(c);
}

console.log("=== 各省中位色（采样自画作）===");
Object.keys(byProvince).sort().forEach((n) => console.log("  " + n.padEnd(10) + byProvince[n]));

console.log("\n=== 大区调色板（建议写入 js/app.js 的 TINTS）===");
const out = {};
Object.keys(byRegion).forEach((region) => {
  const list = byRegion[region];
  const c = [componentMedian(list, 0), componentMedian(list, 1), componentMedian(list, 2)];
  // 同色系两档：一档原色，一档略深，用于相邻省份区分
  const dark = [c[0] * 0.93, c[1] * 0.93, c[2] * 0.92];
  out[region] = [hex(c[0], c[1], c[2]), hex(dark[0], dark[1], dark[2])];
  console.log("  " + region + ': ["' + out[region][0] + '", "' + out[region][1] + '"],   // ' + hex(c[0], c[1], c[2]));
});
console.log("\nJS:\n" + JSON.stringify(out, null, 2).replace(/"/g, '"'));

/* ---------------- 山脉色：在画作的山地处取样 ---------------- */
const MOUNTAIN_AREAS = [
  [43.0, 85.0], [42.4, 88.0], [35.6, 84.0], [36.0, 92.0],   // 天山 / 昆仑
  [33.9, 108.0], [34.2, 106.5], [37.5, 113.2], [40.0, 113.6], // 秦岭 / 太行
  [47.0, 120.0], [50.0, 121.5], [43.0, 128.0], [41.5, 126.5], // 大兴安岭 / 长白
  [28.5, 100.0], [30.0, 99.5], [26.5, 103.0], [27.5, 117.0],  // 横断 / 云贵 / 武夷
  [31.5, 115.0], [30.0, 118.0], [25.5, 113.0], [24.5, 121.0], // 大别 / 黄山 / 南岭 / 台湾
];
const mPix = [];
for (const a of MOUNTAIN_AREAS) {
  for (let dl = -0.6; dl <= 0.6; dl += 0.12) {
    for (let dn = -0.6; dn <= 0.6; dn += 0.12) {
      const lat = a[0] + dn, lng = a[1] + dl;
      const x = Math.round(((lng - BOUNDS.west) / (BOUNDS.east - BOUNDS.west)) * img.width);
      const y = Math.round(((mN - mercY(lat)) / (mN - mS)) * img.height);
      if (x < 0 || y < 0 || x >= img.width || y >= img.height) continue;
      const i = (y * img.width + x) * 4;
      if (img.rgba[i + 3] < 120) continue;
      const lum = 0.299 * img.rgba[i] + 0.587 * img.rgba[i + 1] + 0.114 * img.rgba[i + 2];
      mPix.push({ r: img.rgba[i], g: img.rgba[i + 1], b: img.rgba[i + 2], lum: lum });
    }
  }
}
mPix.sort((a, b) => a.lum - b.lum);
function pick(q) {
  const p = mPix[Math.floor((mPix.length - 1) * q)];
  return p ? hex(p.r, p.g, p.b) : "#888888";
}

/* 画作里最暗的部分就是山体：按亮度分位取三档青色 */
const landPix = [];
for (const key of Object.keys(byRegion)) {
  /* byRegion 只存了中位色，这里重新按省扫一遍亮度排序不可行，
     改用「画作整体非透明像素」的暗部分位 */
}
(function collectAll() {
  for (let y = 0; y < img.height; y += 2) {
    for (let x = 0; x < img.width; x += 2) {
      const i = (y * img.width + x) * 4;
      if (img.rgba[i + 3] < 140) continue;
      const r = img.rgba[i], g = img.rgba[i + 1], b = img.rgba[i + 2];
      landPix.push({ r: r, g: g, b: b, lum: 0.299 * r + 0.587 * g + 0.114 * b });
    }
  }
})();
landPix.sort((a, b) => a.lum - b.lum);
function pickLand(q) {
  const p = landPix[Math.floor((landPix.length - 1) * q)];
  return p ? hex(p.r, p.g, p.b) : "#888888";
}
console.log("\n=== 山脉色阶（画作整体像素按亮度分位：最暗处即山体）===");
console.log("  样本数 " + landPix.length);
console.log('  山阴(12%) ' + pickLand(0.12) + "   山腰(30%) " + pickLand(0.3) + "   山巅(52%) " + pickLand(0.52));
console.log('  参考：平原(80%) ' + pickLand(0.8) + "   最亮(96%) " + pickLand(0.96));
