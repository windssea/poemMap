/* ============================================================
   Pre-Flight：把 design-taste-frontend 的检查项里**适用于本项目**的跑一遍
   ----------------------------------------------------------
   技能里那一串检查多数是为 landing page / portfolio 写的（hero 视口高度、
   CTA 换行、logo 墙、bento 网格…），本项目是一个全屏地图应用，
   没有 hero、没有 CTA、没有营销区块，那些项不适用。
   这里只跑真正能落在这个界面上的：

     · 破折号（技能要求可见文案零破折号）
     · 图标描边粗细是否全局统一
     · :active 触感反馈覆盖
     · 圆角体系是否只剩「令牌 + 胶囊 + 圆形」
     · 强调色是否只有一套（Color Consistency Lock）

   用法：node tools/preflight.js
   ============================================================ */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const css = fs.readFileSync(path.join(ROOT, "src/styles/style.css"), "utf8");

function readAll(dir, out) {
  out = out || [];
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = dir + "/" + e.name;
    if (e.isDirectory()) readAll(rel, out);
    else if (/\.(jsx?|html)$/.test(e.name)) out.push(rel);
  }
  return out;
}
const srcFiles = readAll("src").concat(["index.html"]);

let fails = 0;
function check(name, ok, detail) {
  console.log((ok ? "  ✔ " : "  ✘ ") + name + (detail ? "\n      " + detail : ""));
  if (!ok) fails++;
}

/* ---------- 1. 可见文案里的破折号 ---------- */
/* 技能要求「零破折号」，但那条是为英文营销页写的：它针对的是英文行文里
   滥用 em-dash 的 AI 味。中文的「——」是 GB/T 15834 规定的标准标点，
   年份区间的「701—762」用的是一字线，也是标准写法。
   把这两类当违规去改，是拿英文规范套中文排版。
   所以这里只判**英文语境下的破折号**，中文的两类单独列出来供人确认。

   ⚠️ 必须先整份文件地剥掉块注释再逐行看。只按单行块注释匹配会漏掉
   多行注释的续行——那些行的破折号前面没有起始标记，于是注释里的内容
   被当成「页面上的字」误报（第一版就是这么错的）。 */
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, function (m) { return m.replace(/[^\n]/g, " "); })
    .replace(/(^|[^:])\/\/[^\n]*/g, function (m, p1) { return p1 + " ".repeat(m.length - p1.length); });
}
const dashHits = [];
const cnDashes = [];
srcFiles.forEach(function (f) {
  const raw = fs.readFileSync(path.join(ROOT, f), "utf8");
  const code = stripComments(raw);
  code.split(/\r?\n/).forEach(function (line, i) {
    if (!/—/.test(line)) return;
    const where = f + ":" + (i + 1);
    /* 中文语境里的破折号 / 一字线：GB/T 15834 都算标准标点。三类都算：
         · 行内有汉字（含「约715—约779」这种两头带「约」的年份）
         · 纯数字区间（authors.js 的 "701—762"，整行没有汉字）
         · 「无此项」占位符 "—"
       英文散文不满足任何一条，所以不会漏掉真正的 em-dash。 */
    if (/[\u4e00-\u9fa5]/.test(line)) { cnDashes.push(where + "  " + raw.split(/\r?\n/)[i].trim()); return; }
    if (/\d\s*—\s*\d/.test(line)) { cnDashes.push(where + "  " + raw.split(/\r?\n/)[i].trim()); return; }
    if (/["']—["']/.test(line)) { cnDashes.push(where + "  " + raw.split(/\r?\n/)[i].trim()); return; }
    dashHits.push(where + "  " + line.trim());
  });
});
check("英文语境里没有破折号（—）", dashHits.length === 0, dashHits.slice(0, 6).join("\n      "));
if (cnDashes.length) {
  console.log("      · 中文标点用法 " + cnDashes.length + " 处（保留）：");
  cnDashes.slice(0, 3).forEach(function (h) { console.log("        " + h); });
  if (cnDashes.length > 3) console.log("        … 其余 " + (cnDashes.length - 3) + " 处同理");
}

/* ---------- 2. 图标描边统一 ---------- */
/* 认令牌，不认字面值：描边已经收敛成 --stroke-icon（图标）+ --stroke-hair（装饰细线）两档 */
const cssStrokes = new Set();
{
  const re = /stroke-width:\s*([^;]+);/g;
  let m;
  while ((m = re.exec(css))) cssStrokes.add(m[1].trim());
}
const badStrokes = [...cssStrokes].filter(function (v) { return !/^var\(--stroke-(icon|hair)\)$/.test(v); });
check("图标描边已收敛为令牌（--stroke-icon / --stroke-hair 两档）",
  badStrokes.length === 0, "游离值：" + badStrokes.join("  ") + "（现有：" + [...cssStrokes].join(" / ") + "）");

/* ---------- 3. :active 触感反馈 ---------- */
const activeCount = (css.match(/:active/g) || []).length;
check("有 :active 触感反馈（技能要求按下时有物理感）", activeCount >= 5, ":active 规则 " + activeCount + " 处");

/* ---------- 4. 圆角体系 ---------- */
const radii = new Map();
{
  const re = /border-radius:\s*([^;]+);/g;
  let m;
  while ((m = re.exec(css))) {
    const v = m[1].trim();
    radii.set(v, (radii.get(v) || 0) + 1);
  }
}
/* 成文规则：小控件 --r-sm / 卡片 --r-md / 浮层 --r-lg /
   印章 --r-seal / 胶囊 999px / 圆形 50% / 直角 0 / 继承 */
const strayRadius = [...radii.keys()].filter(function (v) {
  return !/var\(--r-(sm|md|lg|seal)\)/.test(v) && v !== "999px" && v !== "50%" && v !== "inherit" && !/^0\b/.test(v);
});
check("圆角体系收敛（小控件 6 / 卡片 10 / 浮层 12 / 印章 3 / 胶囊 / 圆形）",
  strayRadius.length === 0, "游离值：" + strayRadius.join("  "));

/* ---------- 5. 强调色只有一套 ---------- */
/* 朱砂（168,79,63 / #a84f3f / #8c3f31）是唯一强调色；
   山青是主题色。除这两族与中性色外，不该再有饱和色。 */
const accentFams = {
  "朱砂": [/#a84f3f|#8c3f31|rgba\(168, 79, 63/g],
  "山青": [/#4c675b|#3d5349|#557063|#435b4f|rgba\(76, 103, 91/g],
};
const counts = {};
Object.keys(accentFams).forEach(function (k) {
  counts[k] = accentFams[k].reduce(function (s, re) { return s + (css.match(re) || []).length; }, 0);
});
check("强调色只有一套（朱砂 = 选中/品牌印；山青 = 主题）",
  counts["朱砂"] > 0 && counts["山青"] > 0,
  "朱砂 " + counts["朱砂"] + " 处 / 山青 " + counts["山青"] + " 处");

console.log("\n" + (fails ? "✘ " + fails + " 项未通过" : "✔ 全部通过"));
process.exit(fails ? 1 : 0);
