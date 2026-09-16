/**
 * 底图适配检查（工具，非站点运行时依赖）
 * ----------------------------------------------------------
 * 真正的验收标准不是经纬网有多准，而是**64 处诗词地标是否落在画中的陆地上**。
 * 本脚本用候选 bounds 把每个地标换算成像素，读该处 alpha：
 *   alpha 高 = 落在画上（好）；alpha 低 = 落进透明的海里（视觉上会「漂在海上」）
 *
 * 用法：node tools/check-landmarks.js
 */
const path = require("path");
const fs = require("fs");
const png = require("./pnglib.js");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const IMG = path.join(ROOT, "assets", "map-painting.png");

/* 载入诗词数据 */
const win = { POEMS: [], AUTHORS: {} };
["data/authors.js", "data/poems.tang.js", "data/poems.song.js"].forEach((f) => {
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, f), "utf8"), { window: win });
});

/* 地标聚合（与 app.js 同规则） */
const nodes = [];
win.POEMS.forEach((p) => {
  let hit = null;
  for (const c of nodes) {
    if (Math.abs(c.lat - p.place.lat) < 0.15 && Math.abs(c.lng - p.place.lng) < 0.2) { hit = c; break; }
  }
  if (!hit) { hit = { lat: p.place.lat, lng: p.place.lng, poems: [] }; nodes.push(hit); }
  hit.poems.push(p);
});

function mercY(lat) {
  const r = (lat * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + r / 2));
}

const img = png.decode(IMG);

function evaluate(b) {
  const mN = mercY(b.north), mS = mercY(b.south);
  let onLand = 0, inSea = 0, offImage = 0;
  const bad = [];
  for (const n of nodes) {
    const x = ((n.lng - b.west) / (b.east - b.west)) * img.width;
    const y = ((mN - mercY(n.lat)) / (mN - mS)) * img.height;
    if (x < 0 || y < 0 || x >= img.width || y >= img.height) {
      offImage++;
      bad.push({ name: n.poems[0].place.name, why: "出图", a: -1 });
      continue;
    }
    const a = img.rgba[(Math.round(y) * img.width + Math.round(x)) * 4 + 3];
    if (a > 60) onLand++;
    else { inSea++; bad.push({ name: n.poems[0].place.name, why: "入海", a: a }); }
  }
  return { onLand: onLand, inSea: inSea, offImage: offImage, bad: bad };
}

const CANDIDATES = [
  { name: "20点粗标定", south: 17.60, north: 51.60, west: 68.60, east: 133.80 },
  { name: "44点细标定", south: 19.00, north: 50.40, west: 68.80, east: 134.20 },
  { name: "按陆地外接框估计", south: 18.20, north: 53.60, west: 73.50, east: 135.10 },
  { name: "折中（略放大）", south: 17.00, north: 53.00, west: 72.00, east: 136.00 },
];

console.log("地标总数: " + nodes.length + "，图幅 " + img.width + "x" + img.height);
for (const c of CANDIDATES) {
  const r = evaluate(c);
  const pct = Math.round((r.onLand / nodes.length) * 100);
  console.log(
    c.name.padEnd(18) + " 落画上 " + String(r.onLand).padStart(2) + "/" + nodes.length +
    " (" + pct + "%)  入海 " + r.inSea + "  出图 " + r.offImage
  );
  if (r.bad.length) {
    console.log("    问题地标: " + r.bad.slice(0, 14).map((b) => b.name + "(" + b.why + ")").join("、") +
      (r.bad.length > 14 ? " 等 " + r.bad.length + " 处" : ""));
  }
}
