/* 查一组 id 的题名/地标，以及某个地标名下的所有诗。用法：
   node tools/show-poem.js <id...>            → 列出这些 id 的摘要
   node tools/show-poem.js --place=洞庭湖     → 列出该地标名下的所有诗 */
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
    rows.push({ id: m[1], title: m[2], dynasty: m[3], author: m[4], form: m[5], place: m[6], region: m[7], lat: +m[8], lng: +m[9], file: f });
  }
});

const args = process.argv.slice(2);
const placeArg = args.find(function (a) { return a.indexOf("--place=") === 0; });
let list;
if (placeArg) {
  const name = placeArg.slice(8);
  list = rows.filter(function (r) { return r.place === name; });
} else {
  list = rows.filter(function (r) { return args.indexOf(r.id) !== -1; });
}
list.forEach(function (r) {
  console.log(r.id + " | " + r.dynasty + "·" + r.author + "《" + r.title + "》 | " +
    r.place + "（" + r.region + "） " + r.lat + "," + r.lng + " | " + r.file);
});
console.log("— " + list.length + " 条");
