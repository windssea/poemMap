/* ============================================================
   收尾：把剩下的「一次性色值」并进色板，并统一圆角
   ----------------------------------------------------------
   上一轮按语义族批量改了 167 处，但长尾还有 40 种只出现一两次的值——
   它们才是「糊」的真正来源：十几个几乎一样的近黑褐分别用在标题、
   章节文字、诗句上，肉眼分不出差别，却让整页失去统一感。

   这里做两件事：
     1. 长尾色值 → 色板（近黑褐一律并到 --ink / --ink-2 / --ink-3 三级）
     2. 圆角 → 规范值（小控件 6 / 卡片 10 / 浮层 12；胶囊与圆形不动）

   用法：node tools/unify-tail.js [--dry]
   ============================================================ */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const FILE = "src/styles/style.css";
const DRY = process.argv.includes("--dry");

let src = fs.readFileSync(path.join(ROOT, FILE), "utf8");
const before = src;

/* ---------- 1) 长尾色值 → 色板 ---------- */
const MAP = {
  /* 反白字：三种暖白统一到卡面暖白 */
  "#fdf4e4": "#fffcf5", "#fdf4e6": "#fffcf5", "#ffe6c8": "#fffcf5",
  /* 近黑褐：十几个「差不多」的深褐 → 墨黑 */
  "#3a3026": "#292e2b", "#3a352c": "#292e2b", "#3a2f26": "#292e2b",
  "#3a3027": "#292e2b", "#2e2a23": "#292e2b", "#2f2a22": "#292e2b",
  "#322e27": "#292e2b", "#332f27": "#292e2b", "#33291f": "#292e2b",
  "#2f271e": "#292e2b",
  /* 中褐 → 次级文字 */
  "#4a4438": "#4e5a52", "#4d4738": "#4e5a52", "#4a3f31": "#4e5a52",
  "#48422f": "#4e5a52", "#5e5342": "#4e5a52",
  /* 浅褐 → 辅助文字 */
  "#7d6b52": "#6a6e68", "#8b7a63": "#6a6e68", "#756653": "#6a6e68",
  /* 米白各档 → 表面令牌 */
  "#fffdf7": "#fffdf9", "#faf5e8": "#fbf9f3", "#fdf8ec": "#fffcf5",
  /* 纸灰系 */
  "#d9cdb4": "#d8d0c3", "#cbbfa4": "#d8d0c3",
  /* 海面 */
  "#eef0e3": "#eceee5", "#e8ece0": "#eceee5", "#e4eae0": "#e6e9e2",
  /* 珠子高光 */
  "#e0a892": "#d8b3a5",
};

let nColor = 0;
const hit = {};
Object.keys(MAP).forEach(function (k) {
  const re = new RegExp(k, "gi");
  const m = src.match(re);
  if (m) { hit[k] = m.length; nColor += m.length; }
  src = src.replace(re, MAP[k]);
});

/* ---------- 2) 圆角统一 ---------- */
let nRadius = 0;
const RADII = [
  [/border-radius: 9px;/g, "border-radius: var(--r-md);"],     // 卡片类的小偏差
  [/border-radius: 11px;/g, "border-radius: var(--r-md);"],
  [/border-radius: 10px;/g, "border-radius: var(--r-md);"],
  [/border-radius: 14px;/g, "border-radius: var(--r-lg);"],    // 浮层
  [/border-radius: 15px;/g, "border-radius: var(--r-lg);"],
  [/border-radius: 12px;/g, "border-radius: var(--r-lg);"],
  [/border-radius: 8px;/g, "border-radius: var(--r-sm);"],     // 小控件
  [/border-radius: 5px;/g, "border-radius: var(--r-sm);"],
  [/border-radius: 4px;/g, "border-radius: var(--r-sm);"],
];
RADII.forEach(function ([re, to]) {
  const m = src.match(re);
  if (m) nRadius += m.length;
  src = src.replace(re, to);
});

/* ---------- 3) 浮层阴影减重（默认不加，浮层才用，且不要 30px 的褐影） ---------- */
src = src.replace(/0 30px 70px rgba\(74, 54, 28, \.3\)/g, "0 20px 48px rgba(41, 46, 43, .18)");
src = src.replace(/rgba\(74, 54, 28, ([\d.]+)\)/g, "rgba(41, 46, 43, $1)");

if (src !== before && !DRY) fs.writeFileSync(path.join(ROOT, FILE), src, "utf8");

console.log("色值并入色板：" + nColor + " 处");
Object.keys(hit).sort(function (a, b) { return hit[b] - hit[a]; }).slice(0, 14).forEach(function (k) {
  console.log("   " + String(hit[k]).padStart(3) + "×  " + k + " → " + MAP[k]);
});
if (Object.keys(hit).length > 14) console.log("   … 还有 " + (Object.keys(hit).length - 14) + " 种");
console.log("\n圆角归到令牌：" + nRadius + " 处" + (DRY ? "（--dry，未写入）" : ""));
