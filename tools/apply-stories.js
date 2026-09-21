/* ============================================================
   把 tools/_new/story-*.json 里的背景故事写进正册
   ----------------------------------------------------------
   每条故事写成诗作对象末尾的一个 `story: "…",` 字段。
   为什么放末尾：它是这次新加的一层，放最后不会打乱既有的
   字段顺序（id/title/dynasty/author/form/place/lines/tr/notes/appr）。

   用法：node tools/apply-stories.js [--dry]
   幂等：已有 `story:` 的条目会跳过，重复跑不会写进两份。
   ============================================================ */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const NEW_DIR = path.join(ROOT, "tools", "_new");
const DRY = process.argv.indexOf("--dry") !== -1;
const FILES = ["src/data/poems.pre.js", "src/data/poems.tang.js", "src/data/poems.song.js"];

const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const write = (p, s) => fs.writeFileSync(path.join(ROOT, p), s, "utf8");

/* ---------- 收拢故事 ---------- */
const stories = {};
let files = 0;
fs.readdirSync(NEW_DIR)
  .filter(function (f) { return /^story-.*\.json$/.test(f); })
  .forEach(function (f) {
    let d;
    try { d = JSON.parse(fs.readFileSync(path.join(NEW_DIR, f), "utf8")); }
    catch (e) { console.log("✘ " + f + " 解析失败：" + e.message); return; }
    const s = d.stories || d;
    Object.keys(s).forEach(function (id) { stories[id] = String(s[id]).trim(); });
    files++;
  });

const ids = Object.keys(stories);
console.log("读入 " + files + " 个故事文件，共 " + ids.length + " 条");

/* ---------- 体检：长度 ---------- */
const lens = ids.map(function (i) { return stories[i].length; }).sort(function (a, b) { return a - b; });
if (lens.length) {
  const q = function (p) { return lens[Math.floor(lens.length * p)] || 0; };
  console.log("长度：最短 " + lens[0] + " / 中位 " + q(0.5) + " / 最长 " + lens[lens.length - 1]);
  const short = ids.filter(function (i) { return stories[i].length < 80; });
  const long = ids.filter(function (i) { return stories[i].length > 320; });
  if (short.length) console.log("⚠ 偏短（<80 字）：" + short.join(" "));
  if (long.length) console.log("⚠ 偏长（>320 字）：" + long.join(" "));
}

/* ---------- 写进正册 ---------- */
let added = 0, skipped = 0, missing = [];
FILES.forEach(function (f) {
  let src = read(f);
  const before = src;

  Object.keys(stories).forEach(function (id) {
    const idMark = 'id: "' + id + '",';
    const at = src.indexOf(idMark);
    if (at === -1) return;
    /* 这一条的范围：从 id 到下一个条目的 `  },` */
    const end = src.indexOf("\n  },", at);
    if (end === -1) return;
    const seg = src.slice(at, end);
    if (/\n\s*story:\s*"/.test(seg)) { skipped++; return; }

    /* 插在 appr 那一行之后（appr 是现有字段的最后一个） */
    const appr = seg.lastIndexOf("\n    appr:");
    if (appr === -1) { missing.push(id); return; }
    const lineEnd = src.indexOf("\n", at + appr + 1);
    const insert = "\n    story: " + JSON.stringify(stories[id]) + ",";
    src = src.slice(0, lineEnd) + insert + src.slice(lineEnd);
    added++;
  });

  if (src !== before && !DRY) write(f, src);
});

console.log("\n写入 " + added + " 条 · 已有跳过 " + skipped + " 条" +
  (missing.length ? " · 找不到 appr 的：" + missing.join(" ") : "") +
  (DRY ? "（--dry，未写入）" : ""));

/* ---------- 反向检查：哪些诗还没有故事 ---------- */
const still = [];
FILES.forEach(function (f) {
  const src = read(f);
  const re = /id:\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(src))) {
    const end = src.indexOf("\n  },", m.index);
    if (end === -1) continue;
    if (!/\n\s*story:\s*"/.test(src.slice(m.index, end))) still.push(m[1]);
  }
});
console.log("仍缺故事的：" + (still.length ? still.length + " 首 → " + still.slice(0, 20).join(" ") + (still.length > 20 ? " …" : "") : "无"));
