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
  /* 条目数：数组体数 `id: "..."`，对象体（authors/tags）数两位缩进的键行。
     ⚠️ 缩进用字面量 ` {2}` 而不是 `\s{2}`——带 m 标志时 `\s` 能吃掉换行，
     空行会被算成「缩进 + 下一行的键」，凭空多出两条。 */
  const ids = (txt.match(/^\s*id:\s*"/gm) || []).length;
  const keys = (txt.match(/^ {2}(?:"[\w-]+"|[\u4e00-\u9fa5]+):\s*[{[]/gm) || []).length;

  /* 语法检查：把 ESM 的 import/export 去掉再丢给 new Function。
     ⚠️ 只认 `export const ...` 是不够的——authors.js / tags.js 写的是
     `const X = {...}` 再 `export default X;`，那种写法下面这句不匹配，
     整段代码原样带着 `export` 进 new Function，报的却是「语法错」。
     工具误报比不报更坏：会让人去改一份本来没问题的数据。 */
  const body = txt
    .replace(/^[ \t]*import[ \t][\s\S]*?from[ \t]*["'][^"']+["'][ \t]*;?[ \t]*$/gm, "")
    .replace(/^[ \t]*export[ \t]+default[ \t]+[\w$]+[ \t]*;?[ \t]*$/gm, "")
    .replace(/^[ \t]*export[ \t]+/gm, "");
  let ok = true, err = "";
  try { new Function(body); }
  catch (e) { ok = false; err = e.message; }

  console.log(f + " | bytes " + buf.length + " | BOM " + bom + " | 替换字符 " + bad +
    " | 条目 " + (ids || keys) + " | 语法 " + (ok ? "OK" : "✘ " + err));
  if (bad) {
    const i = txt.indexOf("\uFFFD");
    console.log("   首个坏字附近: " + JSON.stringify(txt.slice(Math.max(0, i - 40), i + 40)));
  }
});
