/* ============================================================
   校验诗词数据（src/data 下四份文件对不对得上）
   ----------------------------------------------------------
   加诗之后跑一遍，四件事：
     1. 每首诗的 id 唯一
     2. 每首诗都在 tags.js 里有标签（详情页与主题索引都靠它）
     3. 每位 author 都在 authors.js 里登记过（否则卡片显示「暂无介绍」）
     4. 打印朝代/体裁/地标/作者的规模，和新加的条目对得上

   用法：node tools/check-data.js
   ============================================================ */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const FILES = ["src/data/poems.pre.js", "src/data/poems.tang.js", "src/data/poems.song.js"];
const read = function (p) { return fs.readFileSync(path.join(ROOT, p), "utf8"); };

/* ---------- 诗词：id / title / dynasty / author / form / place(+坐标) ---------- */
const poems = [];
FILES.forEach(function (f) {
  const txt = read(f);
  const re = /id:\s*"([^"]+)",\s*[\r\n]+\s*title:\s*"([^"]+)",\s*[\r\n]+\s*dynasty:\s*"([^"]*)",\s*[\r\n]+\s*author:\s*"([^"]*)",\s*[\r\n]+\s*form:\s*"([^"]*)",\s*[\r\n]+\s*place:\s*\{\s*[\r\n]+\s*name:\s*"([^"]+)",\s*[\r\n]+\s*region:\s*"([^"]*)",\s*[\r\n]+\s*lat:\s*([-\d.]+),\s*lng:\s*([-\d.]+)/g;
  let m;
  while ((m = re.exec(txt))) {
    poems.push({ id: m[1], title: m[2], dynasty: m[3], author: m[4], form: m[5], place: m[6], region: m[7], lat: +m[8], lng: +m[9], file: f });
  }
});

/* ---------- 地标：按 places.js 的同款阈值（0.15° 纬 / 0.2° 经）合并 ---------- */
function countLandmarks() {
  const nodes = [];
  poems.forEach(function (p) {
    const hit = nodes.find(function (n) { return Math.abs(n.lat - p.lat) < 0.15 && Math.abs(n.lng - p.lng) < 0.2; });
    if (hit) { hit.poems.push(p); return; }
    nodes.push({ lat: p.lat, lng: p.lng, poems: [p] });
  });
  return nodes;
}

/* ---------- 标签 / 作者 ---------- */
const tagTxt = read("src/data/tags.js");
const tagged = new Set([...tagTxt.matchAll(/^\s*"([\w-]+)":\s*\[/gm)].map(function (m) { return m[1]; }));

const authorTxt = read("src/data/authors.js");
/* 两位缩进的键行；**不要求**「`{` 之后就是行尾」——正册里有几条作者
   压在一行里写（`  苏洵: { years: "...", bio: "..." },`），
   要求行尾就会把它们漏掉，报出来的作者数偏小。 */
const registeredList = [...authorTxt.matchAll(/^ {2}([\u4e00-\u9fa5]+):\s*\{/gm)].map(function (m) { return m[1]; });
const registered = new Set(registeredList);
/* 重复键：JS 不报错（后者覆盖前者），但读的人会以为有两个同名作者 */
const dupAuthors = registeredList.filter(function (n, i, a) { return a.indexOf(n) !== i; });

/* ---------- 判 ---------- */
const dupIds = [];
const seen = new Set();
poems.forEach(function (p) { if (seen.has(p.id)) dupIds.push(p.id); seen.add(p.id); });

const missingTags = poems.filter(function (p) { return !tagged.has(p.id); }).map(function (p) { return p.id; });
const strayTags = [...tagged].filter(function (t) { return !seen.has(t); });
const unknownAuthors = [...new Set(poems.map(function (p) { return p.author; }))].filter(function (a) { return !registered.has(a); });

const count = function (key) {
  const out = {};
  poems.forEach(function (p) { out[p[key]] = (out[p[key]] || 0) + 1; });
  return out;
};
const landmarks = countLandmarks();
const biggest = landmarks.slice().sort(function (a, b) { return b.poems.length - a.poems.length; })[0];

console.log("诗词 " + poems.length + " 首 | 地标 " + landmarks.length + " 处（最多 " +
  biggest.poems[0].place + " " + biggest.poems.length + " 首）| 作者 " + registered.size + " 位 | 标签 " + tagged.size + " 条");
console.log("朝代:", JSON.stringify(count("dynasty")), " 体裁:", JSON.stringify(count("form")));
/* 时代组：与 src/data/eras.js 的 ERAS 同一套口径（先唐管先秦/汉/魏晋/南北朝） */
const ERA_OF = { 先秦: "先唐", 汉: "先唐", 魏晋: "先唐", 南北朝: "先唐", 唐: "唐", 宋: "宋" };
const eras = {};
poems.forEach(function (p) {
  const e = ERA_OF[p.dynasty] || p.dynasty;
  eras[e] = (eras[e] || 0) + 1;
});
console.log("时代组:", JSON.stringify(eras));
console.log("id 重复:", dupIds.length ? dupIds.join(" ") : "无");
console.log("缺标签:", missingTags.length ? missingTags.join(" ") : "无");
console.log("多余标签（没有对应诗）:", strayTags.length ? strayTags.join(" ") : "无");
console.log("未登记的作者:", unknownAuthors.length ? unknownAuthors.join(" ") : "无");
console.log("重复的作者条目:", dupAuthors.length ? [...new Set(dupAuthors)].join(" ") : "无");

const bad = dupIds.length + missingTags.length + strayTags.length + unknownAuthors.length + dupAuthors.length;
console.log(bad ? "\n✘ 有 " + bad + " 处需要修" : "\n✔ 四份数据对得上");
process.exit(bad ? 1 : 0);
