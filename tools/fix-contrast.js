/* ============================================================
   C12：把文字色阶改成「三级都过 AA + 一个图形专用色」
   ----------------------------------------------------------
   实测（tools/contrast.js，WCAG 2.1）：
     --ink-4 #b6a892 on #f2e9d7  →  1.93:1   ✘
     --ink-3 #9c8f7b on #f2e9d7  →  2.63:1   ✘（这条原审计里没发现）
     --ink-2 #6d6152 on #f2e9d7  →  5.00:1   ✔
   浅纸上放不下四个都能过 4.5:1 的文字层级——第四级只能做到 3:1，
   而 3:1 只够图形。所以：

     --ink    #3a3026  10.68:1  正文 / 标题
     --ink-2  #5f5548   6.05:1  次级（原来 5.00，压暗一档把三级拉开）
     --ink-3  #76674f   4.55:1  三级：注释、meta、说明（AA 地板）
     --ink-gfx #978365  3.03:1  **仅图形**：箭头、图标描边、分隔
     删除 --ink-4（它做文字不合格，做图形又不够，位置尴尬）

   替换规则按 CSS 属性判断，不按行号——行号会漂：
     color: var(--ink-4)                    → color: var(--ink-3)      文字
     stroke/fill: var(--ink-4)              → var(--ink-gfx)           图形
     background: var(--ink-4)               → var(--ink-3)             反白徽标的底（上面压浅字）

   用法：node tools/fix-contrast.js [--dry]
   ============================================================ */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const FILE = "src/styles/style.css";
const DRY = process.argv.includes("--dry");

let src = fs.readFileSync(path.join(ROOT, FILE), "utf8");
const before = src;
let nText = 0, nGfx = 0, nBg = 0;

/* 注意：不能要求「声明后面就是行尾」。
   `.item .chev { ... stroke: var(--ink-4); stroke-width: 2; ... }` 这类
   一行里塞了好几个声明的写法会被漏掉，而 --ink-4 这时已经被删掉了，
   漏掉的引用会变成**未定义的自定义属性**，整条声明失效、颜色回退到继承值。 */
src = src.replace(/(^|[;{]\s*)(stroke|fill):\s*var\(--ink-4\)/gm, function (_, pre, prop) {
  nGfx++;
  return pre + prop + ": var(--ink-gfx)";
});

src = src.replace(/(^|[;{]\s*)background:\s*var\(--ink-4\)/gm, function (_, pre) {
  nBg++;
  return pre + "background: var(--ink-3)";
});

src = src.replace(/(^|[;{]\s*)color:\s*var\(--ink-4\)/gm, function (_, pre) {
  nText++;
  return pre + "color: var(--ink-3)";
});

/* 令牌本身 */
const tokens = [
  [/--ink-2:\s*#6d6152;/, "--ink-2:  #5f5548;", "--ink-2 6.05:1"],
  [/--ink-3:\s*#9c8f7b;/, "--ink-3:  #76674f;", "--ink-3 4.55:1（AA 地板）"],
  [/--ink-4:\s*#b6a892;/, "--ink-gfx: #978365;", "--ink-gfx 3.03:1（仅图形）"],
];
const changed = [];
tokens.forEach(function ([re, to, label]) {
  if (re.test(src)) { src = src.replace(re, to); changed.push(label); }
});

if (src !== before && !DRY) fs.writeFileSync(path.join(ROOT, FILE), src, "utf8");

console.log("文字 color → --ink-3 ：" + nText + " 处");
console.log("图形 stroke/fill → --ink-gfx ：" + nGfx + " 处");
console.log("反白底 background → --ink-3 ：" + nBg + " 处");
console.log("令牌改写：" + (changed.length ? changed.join(" / ") : "（已改过，跳过）"));
console.log(DRY ? "\n--dry，未写入" : "\n已写入 " + FILE);

const left = (src.match(/--ink-4/g) || []).length;
console.log("残留的 --ink-4 引用：" + left + (left ? "  ⚠ 还有地方没换" : "  ✔ 已清空"));
