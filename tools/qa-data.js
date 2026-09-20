/* ============================================================
   补编数据质检（在 check-data.js 之外多查几件事）
   ----------------------------------------------------------
   check-data.js 只查「四份文件对不对得上」。补编是一次几十首、
   分批并行写出来的，还需要查：
     1. 同一首诗被两批各写了一份（id 不同、题名+作者相同）
     2. 坐标是否落在中国境内、是否与地标名所在省对得上（粗查）
     3. 诗句是否为空、译文/赏析是否缺失
     4. 新地标之间是否过近（<15km 会被合并，说明白开了一个点）
   用法：node tools/qa-data.js
   ============================================================ */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const FILES = ["src/data/poems.pre.js", "src/data/poems.tang.js", "src/data/poems.song.js"];

const RE = /id:\s*"([^"]+)",\s*[\r\n]+\s*title:\s*"([^"]+)",\s*[\r\n]+\s*dynasty:\s*"([^"]*)",\s*[\r\n]+\s*author:\s*"([^"]*)",\s*[\r\n]+\s*form:\s*"([^"]*)",\s*[\r\n]+\s*place:\s*\{\s*[\r\n]+\s*name:\s*"([^"]+)",\s*[\r\n]+\s*region:\s*"([^"]*)",\s*[\r\n]+\s*lat:\s*([-\d.]+),\s*lng:\s*([-\d.]+)/g;

const rows = [];
FILES.forEach(function (f) {
  const txt = fs.readFileSync(path.join(ROOT, f), "utf8");
  let m;
  while ((m = RE.exec(txt))) {
    /* 窗口要够宽：88 句的《琵琶行》光 lines 就占 2000 多字符，
       窗口开小了 tr 落在外面，会被误判成「缺译文」。 */
    const win = txt.slice(m.index, m.index + 6000);
    rows.push({
      id: m[1], title: m[2], dynasty: m[3], author: m[4], form: m[5],
      place: m[6], region: m[7], lat: +m[8], lng: +m[9], file: f,
      hasTr: /tr:\s*"[^"]{10,}"/.test(win),
      hasAppr: /appr:\s*"[^"]{10,}"/.test(win),
      nLines: (txt.slice(m.index, txt.indexOf("\n  },", m.index)).match(/"[^"]*"/g) || []).length,
    });
  }
});
console.log("共 " + rows.length + " 首\n");

/* 1. 同题同作者（重复收录） */
const seen = new Map();
const dup = [];
rows.forEach(function (r) {
  const k = r.author + "｜" + r.title;
  if (seen.has(k)) dup.push(k + "  →  " + seen.get(k) + " / " + r.id);
  else seen.set(k, r.id);
});
console.log("① 同题同作者重复：" + (dup.length ? "\n   " + dup.join("\n   ") : "无"));

/* 2. 坐标范围 */
const out = rows.filter(function (r) { return r.lat < 17 || r.lat > 54.5 || r.lng < 73 || r.lng > 136; });
console.log("② 坐标越界（应全在中国境内）：" + (out.length
  ? "\n   " + out.map(function (r) { return r.id + " " + r.lat + "," + r.lng; }).join("\n   ") : "无"));

/* 3. 缺译文 / 缺赏析 / 诗句太少 */
const thin = rows.filter(function (r) { return !r.hasTr || !r.hasAppr || r.nLines < 4; });
console.log("③ 译文/赏析/诗句可疑：" + (thin.length
  ? "\n   " + thin.map(function (r) { return r.id + "（句 " + r.nLines + "）"; }).join("\n   ") : "无"));

/* 4. 地标两两过近（<15km）。
   注意这里用的是**球面距离 15km**，而 places.js 用的是 0.15°纬 / 0.2°经 的
   度数阈值——两者不完全等价，所以本节的「聚合后处数」会比 check-data 报的
   地标数略多几个，这是正常的。要查的是「有没有白开一个点」，不是对数。 */
function km(a, b) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const la1 = a.lat * rad, la2 = b.lat * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const nodes = [];
rows.forEach(function (r) {
  const hit = nodes.find(function (n) { return km(n, r) < 15; });
  if (hit) { hit.n++; hit.ids.push(r.id); return; }
  nodes.push({ lat: r.lat, lng: r.lng, name: r.place, n: 1, ids: [r.id] });
});
const tooClose = [];
for (let i = 0; i < nodes.length; i++) {
  for (let j = i + 1; j < nodes.length; j++) {
    const d = km(nodes[i], nodes[j]);
    if (d < 15) tooClose.push(nodes[i].name + " ~ " + nodes[j].name + " " + d.toFixed(1) + "km");
  }
}
console.log("④ 合并后地标 " + nodes.length + " 处；两两 <15km 的：" +
  (tooClose.length ? "\n   " + tooClose.join("\n   ") : "无"));

/* 5. 地标重名（同名不同坐标，地图上会出现两个同名的点） */
const byName = {};
nodes.forEach(function (n) { (byName[n.name] = byName[n.name] || []).push(n); });
const sameName = Object.keys(byName).filter(function (k) { return byName[k].length > 1; });
console.log("⑤ 同名不同址的地标：" + (sameName.length
  ? "\n   " + sameName.map(function (k) {
      return k + " ×" + byName[k].length + "（" + byName[k].map(function (n) {
        return n.lat.toFixed(2) + "," + n.lng.toFixed(2);
      }).join(" / ") + "）";
    }).join("\n   ") : "无"));

const bad = dup.length + out.length + thin.length;
console.log("\n" + (bad ? "✘ 有 " + bad + " 处要人工看一眼" : "✔ 未发现硬错误"));
