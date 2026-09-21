/* ============================================================
   Pre-Flight 的两项修复：图标描边统一 + 圆角体系收敛
   ----------------------------------------------------------
   技能明确要求：
     · 「Standardize strokeWidth globally」——描边粗细全局统一
     · 「SHAPE CONSISTENCY LOCK」——一套圆角，混合体系必须有成文规则

   实测：CSS 里 stroke-width 有 .8/.9/1.9/2/2.4 五个值（同一套图标里
   1.9 与 2 并存、关闭钮 2.4、罗盘细线 .8/.9），圆角有 1/2/3/6px 游离值。

   两件事都做成**有名字的令牌**，而不是把数字抹平——抹平会丢掉
   「朱印是方的」这个刻意的设计决定：

     --stroke-icon: 2      图标描边（唯一一档）
     --stroke-hair: 1      装饰细线（罗盘盘面）
     --r-seal: 3px         朱印：方形微圆角，与卡片圆角是两套语言
     --r-bar: 999px        细条一律做成两端圆的胶囊

   用法：node tools/fix-preflight.js [--dry]
   ============================================================ */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const FILE = "src/styles/style.css";
const DRY = process.argv.includes("--dry");

let src = fs.readFileSync(path.join(ROOT, FILE), "utf8");
const before = src;
const log = [];

function sub(re, to, label) {
  const n = (src.match(re) || []).length;
  if (n) { src = src.replace(re, to); log.push([label, n]); }
  return n;
}

/* ---------- 1) 描边统一 ---------- */
/* 图标：1.9 / 2 / 2.4 全部归到 2。1.9 与 2 的差别肉眼看不出来，
   但「同一套图标里有两个值」正是技能要消除的东西。 */
sub(/stroke-width: 1\.9;/g, "stroke-width: var(--stroke-icon);", "图标描边 1.9 → 令牌");
sub(/stroke-width: 2\.4;/g, "stroke-width: var(--stroke-icon);", "小图标 2.4 → 令牌（12–16px 上用 2.4 偏重）");
sub(/stroke-width: 2;/g, "stroke-width: var(--stroke-icon);", "图标描边 2 → 令牌");
/* 罗盘盘面的两根细线：是装饰线不是图标，单独一档 */
sub(/stroke-width: \.9;/g, "stroke-width: var(--stroke-hair);", "罗盘细线 .9 → 细线令牌");
sub(/stroke-width: \.8;/g, "stroke-width: var(--stroke-hair);", "罗盘细线 .8 → 细线令牌");

/* ---------- 2) 圆角收敛 ---------- */
/* 朱印：3px / 2px / 1px 三种都出现在印章与其他小方块上，统一到 --r-seal */
sub(/border-radius: 3px;/g, "border-radius: var(--r-seal);", "3px → 朱印令牌");
sub(/border-radius: 2px;/g, "border-radius: var(--r-seal);", "2px → 朱印令牌");
sub(/border-radius: 1px;/g, "border-radius: var(--r-seal);", "1px → 朱印令牌");
sub(/border-radius: 6px;/g, "border-radius: var(--r-sm);", "6px → 小控件令牌");

/* ---------- 3) 令牌块补上这几个 ---------- */
if (!/--stroke-icon/.test(src)) {
  src = src.replace("  --r-sm: 6px;", [
    "  /* ══ 描边 ══ 图标只有一档；装饰细线单独一档 */",
    "  --stroke-icon: 2;",
    "  --stroke-hair: 1;",
    "",
    "  --r-sm: 6px;",
  ].join("\n"));
  log.push(["新增描边令牌", 1]);
}
if (!/--r-seal/.test(src)) {
  src = src.replace("  --r-sm: 6px;", [
    "  --r-sm: 6px;",
    "  --r-seal: 3px;   /* 朱印：方形微圆角，刻意与卡片圆角分属两套语言 */",
  ].join("\n"));
  log.push(["新增朱印圆角令牌", 1]);
}

if (src !== before && !DRY) fs.writeFileSync(path.join(ROOT, FILE), src, "utf8");

log.forEach(function ([k, n]) { console.log("  " + String(n).padStart(3) + "×  " + k); });
console.log(DRY ? "（--dry，未写入）" : "\n已写入 " + FILE);
