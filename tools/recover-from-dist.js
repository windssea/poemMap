/* 从 dist 的旧构建产物里把诗词/作者/标签数据捞回来。
   ----------------------------------------------------------
   背景：正册里有一批**未提交**的补编（8 首唐诗 + 7 位作者 + 16 条标签），
   被 git checkout 覆盖掉了。dist/ 的产物早于那次覆盖，里面完整保留了
   当时运行的数据，且打包器不改动对象字面量的键名与字符串内容，
   所以可以按「找锚点 + 括号配平」把三段字面量原样取出来求值。

   用法：node tools/recover-from-dist.js <bundle.js> <out.json>
   ============================================================ */
const fs = require("fs");
const path = require("path");

const file = process.argv[2];
const out = process.argv[3] || path.join(__dirname, "_new", "recovered.json");
if (!file) { console.error("用法: node tools/recover-from-dist.js <bundle.js> [out.json]"); process.exit(2); }

const txt = fs.readFileSync(file, "utf8");

/* 从 startIdx 处的开括号开始，配平到对应的闭括号，返回 [start, end) */
function matchFrom(s, startIdx) {
  const open = s[startIdx];
  const close = open === "{" ? "}" : "]";
  let depth = 0, i = startIdx, inStr = null, esc = false;
  for (; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (c === "\\") { esc = true; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { inStr = c; continue; }
    if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) return [startIdx, i + 1]; }
  }
  throw new Error("括号没配平");
}

function grab(anchor, which) {
  const at = txt.indexOf(anchor);
  if (at === -1) throw new Error("找不到锚点 " + anchor);
  const braceIdx = txt.indexOf(which, at);
  const [a, b] = matchFrom(txt, braceIdx);
  return txt.slice(a, b);
}

/* 三段字面量：作者对象 / 标签对象 / 诗数组（唐、宋两册各一段）。
   锚点用「只出现一次的特征串」，配平后求值。 */
function evalLiteral(raw) { return eval("(" + raw + ")"); }

/* 作者：打包后是 `ve={李白:{years:...`，取 `ve=` 之后那个对象 */
const authorsRaw = (function () {
  const at = txt.indexOf("ve={李白:{years:");
  if (at === -1) throw new Error("找不到作者对象锚点");
  const b = txt.indexOf("{", at + 3);
  return txt.slice(...matchFrom(txt, b));
})();

/* 标签：`={"jing-ye-si":[` */
const tagsRaw = (function () {
  const at = txt.indexOf('={"jing-ye-si":[');
  if (at === -1) throw new Error("找不到标签对象锚点");
  const b = txt.indexOf("{", at + 1);
  return txt.slice(...matchFrom(txt, b));
})();

/* 诗：从某首诗的对象往外扩到它所在的数组 */
function poemsFrom(anchorId) {
  const at = txt.indexOf("id:`" + anchorId + "`");
  if (at === -1) throw new Error("找不到诗对象锚点 " + anchorId);
  const objStart = txt.lastIndexOf("{", at);
  const [oa] = matchFrom(txt, objStart);
  let i = oa - 1;
  while (i > 0 && /\s|,/.test(txt[i])) i--;
  if (txt[i] !== "[") throw new Error("诗对象前面不是数组开括号，而是 " + JSON.stringify(txt[i]));
  return txt.slice(...matchFrom(txt, i));
}

const val = {
  poems: evalLiteral(poemsFrom("jing-ye-si")).concat(evalLiteral(poemsFrom("shui-diao-ge-tou"))),
  authors: evalLiteral(authorsRaw),
  tags: evalLiteral(tagsRaw),
};

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(val, null, 1), "utf8");

const byD = {};
val.poems.forEach(function (p) { byD[p.dynasty] = (byD[p.dynasty] || 0) + 1; });
console.log("捞出：诗 " + val.poems.length + " 首 " + JSON.stringify(byD) +
  " · 作者 " + Object.keys(val.authors).length + " 位 · 标签 " + Object.keys(val.tags).length + " 条");
console.log("写入 " + out);
