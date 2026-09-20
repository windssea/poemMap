/* 按作者（或地标/朝代）列出篇目，补编前查重用。
   用法：
     node tools/list-by.js 李白
     node tools/list-by.js --place=长安
     node tools/list-by.js --dynasty=唐 --form=诗            */
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
    rows.push({
      id: m[1], title: m[2], dynasty: m[3], author: m[4], form: m[5],
      place: m[6], region: m[7], lat: +m[8], lng: +m[9], file: f,
    });
  }
});

const args = process.argv.slice(2);
const opt = {};
const free = [];
args.forEach(function (a) {
  const m = /^--([\w-]+)=(.*)$/.exec(a);
  if (m) opt[m[1]] = m[2]; else free.push(a);
});

let list = rows;
if (free.length) list = list.filter(function (r) { return free.indexOf(r.author) !== -1; });
if (opt.author) list = list.filter(function (r) { return r.author === opt.author; });
if (opt.place) list = list.filter(function (r) { return r.place === opt.place; });
if (opt.region) list = list.filter(function (r) { return r.region.indexOf(opt.region) !== -1; });
if (opt.dynasty) list = list.filter(function (r) { return r.dynasty === opt.dynasty; });
if (opt.form) list = list.filter(function (r) { return r.form === opt.form; });

list.forEach(function (r) {
  console.log(r.id + " ｜ " + r.dynasty + "·" + r.author + "《" + r.title + "》 ｜ " +
    r.place + "（" + r.region + "） " + r.lat + "," + r.lng);
});
console.log("— " + list.length + " 条");
