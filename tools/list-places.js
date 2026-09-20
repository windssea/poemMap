/* 列出已收录的地标（按省分组），供补编时避免重复开点。用法：node tools/list-places.js */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const FILES = ["src/data/poems.pre.js", "src/data/poems.tang.js", "src/data/poems.song.js"];
const RE = /id:\s*"([^"]+)",\s*[\r\n]+\s*title:\s*"([^"]+)",\s*[\r\n]+\s*dynasty:\s*"([^"]*)",\s*[\r\n]+\s*author:\s*"([^"]*)",\s*[\r\n]+\s*form:\s*"([^"]*)",\s*[\r\n]+\s*place:\s*\{\s*[\r\n]+\s*name:\s*"([^"]+)",\s*[\r\n]+\s*region:\s*"([^"]*)"/g;

const rows = [];
FILES.forEach(function (f) {
  const txt = fs.readFileSync(path.join(ROOT, f), "utf8");
  let m;
  while ((m = RE.exec(txt))) {
    rows.push({ id: m[1], title: m[2], dynasty: m[3], author: m[4], form: m[5], place: m[6], region: m[7] });
  }
});
console.log("已收录 " + rows.length + " 首\n");
const byProv = {};
rows.forEach(function (r) {
  const p = r.region.split(" · ")[0] || "未标";
  (byProv[p] = byProv[p] || []).push(r);
});
Object.keys(byProv).sort().forEach(function (p) {
  const names = [...new Set(byProv[p].map(function (r) { return r.place; }))];
  console.log(p + "（" + byProv[p].length + " 首 / " + names.length + " 地）：" + names.join("、"));
});
console.log("\n已用地标名共 " + new Set(rows.map(function (r) { return r.place; })).size + " 个");
console.log("已用 id：\n" + rows.map(function (r) { return r.id; }).join(" "));
