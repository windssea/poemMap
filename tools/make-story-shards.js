/* ============================================================
   把 325 首诗切成 N 份「背景故事」写作任务
   ----------------------------------------------------------
   为什么先切分再派活：写故事只需要「这首诗 + 它已有的背景事实」，
   不需要把三个几百 KB 的数据文件整个读进上下文。
   这里生成的是**精简输入**：每首只留 id / 篇名 / 作者 / 地点 / 已有的
   origin / 前两句，让每个写手只读自己那一小份。

   用法：node tools/make-story-shards.js [份数=11]
   产物：tools/_new/_story-in-<i>.json
   ============================================================ */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "tools", "_new");
const FILES = ["src/data/poems.pre.js", "src/data/poems.tang.js", "src/data/poems.song.js"];
const N = Math.max(1, Number(process.argv[2]) || 11);

/* ⚠️ `place` 与 `lines` 之间**可能有 `prologue`（词的小序）**。
   最初的正则要求 `},` 后紧跟 `lines:`，于是 9 首带小序的词
   （琵琶行、水调歌头、定风波、扬州慢、暗香…）全被漏掉，
   325 首只解析出 316 首。这里把小序做成可选段。 */
const RE = /id:\s*"([^"]+)",\s*[\r\n]+\s*title:\s*"([^"]+)",\s*[\r\n]+\s*dynasty:\s*"([^"]*)",\s*[\r\n]+\s*author:\s*"([^"]*)",\s*[\r\n]+\s*form:\s*"([^"]*)",\s*[\r\n]+\s*place:\s*\{\s*[\r\n]+\s*name:\s*"([^"]+)",\s*[\r\n]+\s*region:\s*"([^"]*)",\s*[\r\n]+\s*lat:\s*([-\d.]+),\s*lng:\s*([-\d.]+),\s*[\r\n]+\s*origin:\s*"([^"]*)",\s*[\r\n]+\s*\},\s*[\r\n]+(?:\s*prologue:\s*"([^"]*)",\s*[\r\n]+)?\s*lines:\s*\[([^\]]*)\]/g;

const rows = [];
FILES.forEach(function (f) {
  const txt = fs.readFileSync(path.join(ROOT, f), "utf8");
  let m;
  while ((m = RE.exec(txt))) {
    const lines = (m[12].match(/"([^"]*)"/g) || []).map(function (s) { return s.slice(1, -1); });
    rows.push({
      id: m[1], title: m[2], dynasty: m[3], author: m[4], form: m[5],
      place: m[6], region: m[7], origin: m[10],
      prologue: m[11] || "",
      lines: lines.join(""),
    });
  }
});

console.log("解析到 " + rows.length + " 首");
if (rows.length !== 325) {
  console.error("✘ 期望 325 首，实际 " + rows.length + " 首——正则没跟上数据格式，先修工具再跑。");
  process.exit(1);
}

/* 按数据顺序均分：同一作者、同一地点的诗尽量落在同一份里，
   写手能顺手保持前后一致（比如苏轼黄州那一串）。 */
const per = Math.ceil(rows.length / N);
let n = 0;
for (let i = 0; i < N; i++) {
  const slice = rows.slice(i * per, (i + 1) * per);
  if (!slice.length) continue;
  const file = path.join(OUT, "_story-in-" + i + ".json");
  fs.writeFileSync(file, JSON.stringify({ poems: slice }, null, 1), "utf8");
  n++;
  console.log("  _story-in-" + i + ".json  " + slice.length + " 首  " +
    slice[0].author + "《" + slice[0].title + "》…" +
    slice[slice.length - 1].author + "《" + slice[slice.length - 1].title + "》");
}
console.log("共 " + n + " 份");
