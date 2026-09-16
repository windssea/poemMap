/**
 * 底图地理配准（工具，非站点运行时依赖）
 * ----------------------------------------------------------
 * 把「青绿中国地图.png」的像素范围解算成经纬度范围（Leaflet 的
 * imageOverlay 需要 bounds）。
 *
 * 做法：在图上取样一批**已知在陆地/在海里（或境外）**的坐标点，
 * 对候选 bounds 打分（陆地应落在有像素处，海面应落在透明处），
 * 先粗后细网格搜索，取分数最高的解。
 *
 * 注意：Leaflet 用 Web 墨卡托投影，因此图像的纵向是墨卡托等距，
 * 换算像素时必须用 mercY(lat) 而不是 lat 本身。
 *
 * 用法：node tools/calibrate-map.js [图片路径]
 */
const path = require("path");
const png = require("./pnglib.js");

const IMG = process.argv[2] || path.join(__dirname, "..", "assets", "map-painting.png");

/* 陆地测试点（应落在有画的地方） */
const LAND = [
  [39.90, 116.40], [31.23, 121.47], [23.13, 113.26], [30.66, 104.07],
  [43.83, 87.62], [29.65, 91.14], [45.80, 126.53], [25.04, 102.72],
  [34.34, 108.94], [18.25, 109.51], [25.03, 121.57], [39.47, 75.99],
  [43.65, 111.98], [52.97, 122.54], [36.06, 103.83], [38.49, 106.23],
  [47.35, 123.92], [28.68, 115.86], [26.58, 106.71], [44.30, 86.03],
  // 沿海城市：对东西向与南北向的缩放最敏感
  [38.92, 121.63], [36.07, 120.38], [24.48, 118.09], [21.27, 110.36],
  [28.02, 120.70], [34.60, 119.20], [39.13, 117.20], [30.25, 120.15],
  [22.54, 114.06], [26.07, 119.30], [31.80, 120.00], [40.66, 122.23],
  // 边境内侧：约束西部与西南
  [49.58, 117.45], [44.20, 80.40], [27.98, 85.98], [24.00, 97.85],
  [21.54, 107.97], [40.13, 124.39], [42.90, 129.50], [33.00, 79.00],
  [35.50, 74.50], [31.00, 81.00], [36.00, 91.00], [48.00, 88.00],
];

/* 海面 / 境外测试点（应落在透明处） */
const SEA = [
  // 近海：紧贴海岸，最能校正海岸线位置
  [39.00, 120.00], [34.00, 124.00], [27.00, 124.00], [20.00, 112.00],
  [24.50, 119.50], [38.00, 121.00], [30.50, 123.00], [22.00, 115.50],
  [31.50, 124.50], [35.50, 122.50], [40.00, 121.50], [18.50, 111.00],
  // 远海与境外
  [30.00, 127.00], [15.00, 113.00], [36.00, 123.50], [38.50, 119.50],
  [47.90, 106.90], [25.00, 85.00], [46.00, 70.00], [40.00, 135.00],
  [25.00, 140.00], [20.00, 95.00], [35.00, 70.00], [50.00, 100.00],
  [42.00, 132.00], [22.00, 120.00], [44.00, 78.00], [28.00, 88.00],
];

function mercY(lat) {
  const r = (lat * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + r / 2));
}

function makeSampler(img) {
  const { rgba, width, height } = img;
  return function (px, py) {
    const x = Math.round(px), y = Math.round(py);
    if (x < 0 || y < 0 || x >= width || y >= height) return 0;
    return rgba[(y * width + x) * 4 + 3];
  };
}

function score(sample, W, H, b) {
  const mN = mercY(b.north), mS = mercY(b.south);
  let s = 0;
  const toPx = (lat, lng) => [
    ((lng - b.west) / (b.east - b.west)) * W,
    ((mN - mercY(lat)) / (mN - mS)) * H,
  ];
  for (const p of LAND) {
    const q = toPx(p[0], p[1]);
    if (q[0] < 0 || q[0] >= W || q[1] < 0 || q[1] >= H) continue;
    s += sample(q[0], q[1]) > 60 ? 1 : -1;
  }
  for (const p of SEA) {
    const q = toPx(p[0], p[1]);
    if (q[0] < 0 || q[0] >= W || q[1] < 0 || q[1] >= H) { s += 1; continue; }
    s += sample(q[0], q[1]) <= 60 ? 1 : -1;
  }
  return s;
}

function search(sample, W, H, range, step) {
  let best = null;
  for (let s = range.s0; s <= range.s1 + 1e-9; s += step.s) {
    for (let n = range.n0; n <= range.n1 + 1e-9; n += step.n) {
      if (n - s < 20) continue;
      for (let w = range.w0; w <= range.w1 + 1e-9; w += step.w) {
        for (let e = range.e0; e <= range.e1 + 1e-9; e += step.e) {
          if (e - w < 30) continue;
          const b = { south: s, north: n, west: w, east: e };
          const sc = score(sample, W, H, b);
          if (!best || sc > best.score) best = { score: sc, b };
        }
      }
    }
  }
  return best;
}

const img = png.decode(IMG);
const sample = makeSampler(img);
console.log("底图: " + IMG + "  " + img.width + "x" + img.height);

const coarse = search(sample, img.width, img.height,
  { s0: 2, s1: 24, n0: 48, n1: 57, w0: 68, w1: 80, e0: 128, e1: 142 },
  { s: 1, n: 1, w: 1, e: 1 });
console.log("粗搜: 得分 " + coarse.score + "  " + JSON.stringify(coarse.b));

const c = coarse.b;
const fine = search(sample, img.width, img.height,
  { s0: c.south - 1, s1: c.south + 1, n0: c.north - 1, n1: c.north + 1,
    w0: c.west - 1, w1: c.west + 1, e0: c.east - 1, e1: c.east + 1 },
  { s: 0.2, n: 0.2, w: 0.2, e: 0.2 });
console.log("细搜: 得分 " + fine.score + "  " + JSON.stringify(fine.b));

const total = LAND.length + SEA.length;
console.log("满分 " + total + "，最终得分 " + fine.score + "（正确率 " +
  Math.round((fine.score / total) * 100) + "%）");
console.log("bounds = [[" + fine.b.south.toFixed(2) + ", " + fine.b.west.toFixed(2) + "], [" +
  fine.b.north.toFixed(2) + ", " + fine.b.east.toFixed(2) + "]]");

/* 逐点报告，便于人工判断 */
const mN = mercY(fine.b.north), mS = mercY(fine.b.south);
function report(list, want) {
  let bad = 0;
  for (const p of list) {
    const x = ((p[1] - fine.b.west) / (fine.b.east - fine.b.west)) * img.width;
    const y = ((mN - mercY(p[0])) / (mN - mS)) * img.height;
    const a = sample(x, y);
    const ok = want === "land" ? a > 60 : a <= 60;
    if (!ok) { bad++; console.log("  ✗ " + p[0] + "," + p[1] + " alpha=" + a + " (期望" + want + ")"); }
  }
  if (!bad) console.log("  ✓ 全部正确");
}
console.log("陆地抽样:"); report(LAND, "land");
console.log("海面抽样:"); report(SEA, "sea");
