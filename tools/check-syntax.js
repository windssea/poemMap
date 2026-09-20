/* 快速检查一份数据文件：语法是否合法、条目数、编码是否正常 */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const files = process.argv.slice(2);
if (!files.length) files.push("src/data/poems.tang.js");

files.forEach(function (f) {
  const p = path.join(ROOT, f);
  const buf = fs.readFileSync(p);
  const txt = buf.toString("utf8");
  const bom = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
  const bad = (txt.match(/\uFFFD/g) || []).length;
  const ids = (txt.match(/^\s*id:\s*"/gm) || []).length;
  let ok = true, err = "";
  try { new Function(txt.replace(/^export const \w+ =/m, "return")); }
  catch (e) { ok = false; err = e.message; }
  console.log(f + " | bytes " + buf.length + " | BOM " + bom + " | 替换字符 " + bad +
    " | 条目 " + ids + " | 语法 " + (ok ? "OK" : "✘ " + err));
  if (bad) {
    const i = txt.indexOf("\uFFFD");
    console.log("   首个坏字附近: " + JSON.stringify(txt.slice(Math.max(0, i - 40), i + 40)));
  }
});
