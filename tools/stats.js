/* 统计某位作者 / 各朝代 / 各体裁的首数，用于核对 README 里的数字。
   用法：node tools/stats.js [作者名...] */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const FILES = ["src/data/poems.pre.js", "src/data/poems.tang.js", "src/data/poems.song.js"];
const txt = FILES.map(function (f) { return fs.readFileSync(path.join(ROOT, f), "utf8"); }).join("\n");

function tally(re) {
  const out = {};
  let m;
  while ((m = re.exec(txt))) out[m[1]] = (out[m[1]] || 0) + 1;
  return out;
}
console.log("朝代:", JSON.stringify(tally(/dynasty:\s*"([^"]+)"/g)));
console.log("体裁:", JSON.stringify(tally(/form:\s*"([^"]+)"/g)));
const authors = process.argv.slice(2);
if (!authors.length) authors.push("苏轼", "李白", "杜甫", "辛弃疾", "李清照");
const byAuthor = tally(/author:\s*"([^"]+)"/g);
authors.forEach(function (a) { console.log(a + ":", byAuthor[a] || 0); });
