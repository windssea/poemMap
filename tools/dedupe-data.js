/* ============================================================
   清理补编里的重复收录
   ----------------------------------------------------------
   补编是分批并行写的，两批各写了一次同一首名篇（id 不同、题名+作者相同），
   跑 tools/qa-data.js 就能查出来。这里按 id 把多余的那一份连同它的标签一起删掉。

   判断原则：**保留原有正册里的那一份**（它的地标位置是早先核过的），
   删掉补编新增的那一份；两份都是补编时，保留地标更贴合诗题的那个。

   用法：node tools/dedupe-data.js [--dry]
   ============================================================ */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DRY = process.argv.indexOf("--dry") !== -1;
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const write = (p, s) => fs.writeFileSync(path.join(ROOT, p), s, "utf8");

/* 要删的 id → 保留的是哪一个。清单放在 tools/_new/_drop.json，
   apply-new-poems.js 读同一份文件，两边不会走散。 */
const DROP = (function () {
  const p = path.join(ROOT, "tools", "_new", "_drop.json");
  if (!fs.existsSync(p)) return {};
  try { return JSON.parse(fs.readFileSync(p, "utf8")).drop || {}; }
  catch (e) { console.log("✘ _drop.json 解析失败：" + e.message); return {}; }
})();

const FILES = ["src/data/poems.pre.js", "src/data/poems.tang.js", "src/data/poems.song.js"];

/* 从源码里整块删掉一个条目：
   我的生成器固定把条目写成   `  {` … `    id: "xxx",` … `  },`
   所以按行定位「id 行 → 向上找 `  {` → 向下找 `  },`」即可，不碰别的条目。 */
function dropEntry(lines, id) {
  const idLine = '    id: "' + id + '",';
  const at = lines.findIndex(function (l) { return l === idLine; });
  if (at === -1) return false;
  let start = at;
  while (start >= 0 && lines[start] !== "  {") start--;
  let end = at;
  while (end < lines.length && lines[end] !== "  },") end++;
  if (start < 0 || end >= lines.length) {
    console.log("  ! " + id + " 的块边界没找到，跳过（请手工处理）");
    return false;
  }
  lines.splice(start, end - start + 1);
  return true;
}

let removed = 0;
FILES.forEach(function (f) {
  const lines = read(f).split("\n");
  let n = 0;
  Object.keys(DROP).forEach(function (id) {
    if (dropEntry(lines, id)) { n++; removed++; console.log("  - " + id + "（" + f + "）"); }
  });
  if (n && !DRY) write(f, lines.join("\n"));
});

/* 标签：一并删掉，否则 check-data 会报「多余标签」 */
{
  const lines = read("src/data/tags.js").split("\n");
  let n = 0;
  Object.keys(DROP).forEach(function (id) {
    const i = lines.findIndex(function (l) { return l.trim().indexOf('"' + id + '":') === 0; });
    if (i !== -1) { lines.splice(i, 1); n++; }
  });
  if (n && !DRY) write("src/data/tags.js", lines.join("\n"));
  console.log("  - 标签 " + n + " 条");
}

/* 洞庭湖：李商隐《宿洞庭》原来写在 29.36,112.98，与另外三首的 29.25,112.75
   相距约 25km，超过了 15km 的合并阈值，于是地图上出现两个「洞庭湖」。
   洞庭湖就是一个湖，把坐标并到同一处。 */
{
  const f = "src/data/poems.tang.js";
  let src = read(f);
  const before = src;
  src = src.replace(
    /(id: "wang-dongting-lu-mengtong",[\s\S]{0,400}?lat: )29\.36(,\s*\r?\n\s*lng: )112\.98/,
    "$129.25$2112.75"
  );
  if (src !== before) { if (!DRY) write(f, src); console.log("  · 洞庭湖坐标并入同一处（wang-dongting-lu-mengtong）"); }
  else console.log("  · 洞庭湖坐标未改动（可能已经并过了）");
}

console.log("\n共删除 " + removed + " 首重复条目" + (DRY ? "（--dry，未写入）" : ""));
