/* ============================================================
   给地图底图降饱和
   ----------------------------------------------------------
   设计方向里有一条：「地图不应过于鲜艳，让地点标记成为第一视觉重点」。
   但现在的问题是**标记本身**太抢眼（155 个通红），底图反而算克制。
   两边都要动：标记改成墨青珠（见 style.css 的 .dot），
   底图再降一档饱和，让「深色珠子压在浅色大地上」这个对比拉满。

   底图的颜色不在 CSS 令牌里，而是硬编码在 mapEngine 的省区设色
   与 terrain 的山色阶里（那是绘制数据，不是主题色）。
   所以这里按文件、按调色板逐个降饱和，而不是手挑 20 个色值——
   手挑会破坏山阴/山腰/山巅之间原有的明度关系。

   只在 HSL 的 S 上动手，H 与 L 原样保留，所以层次不会塌。

   用法：node tools/desaturate-map.js [--dry] [factor=0.72]
   ============================================================ */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DRY = process.argv.includes("--dry");
const FACTOR = Number((process.argv.find(function (a) { return /^factor=/.test(a); }) || "").split("=")[1]) || 0.72;

function hexToRgb(h) {
  const s = h.replace("#", "");
  const f = s.length === 3 ? s.split("").map(function (c) { return c + c; }).join("") : s;
  return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)];
}
function toHex(rgb) {
  return "#" + rgb.map(function (v) { return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"); }).join("");
}
function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}
function hslToRgb([h, s, l]) {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = function (t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

function desat(hex) {
  const [h, s, l] = rgbToHsl(hexToRgb(hex));
  return toHex(hslToRgb([h, s * FACTOR, l]));
}

const FILES = [
  { file: "src/engine/mapEngine.js", label: "省区设色" },
  { file: "src/engine/terrain.js", label: "山色阶" },
];

let total = 0;
FILES.forEach(function (meta) {
  const p = path.join(ROOT, meta.file);
  let src = fs.readFileSync(p, "utf8");
  let n = 0;
  /* 只改这两个文件里出现的 6 位 hex；它们是纯绘制用的色阶，
     不参与界面语义，所以整体降饱和是安全的。 */
  src = src.replace(/#[0-9a-fA-F]{6}\b/g, function (m) {
    const out = desat(m);
    if (out.toLowerCase() !== m.toLowerCase()) n++;
    return out;
  });
  if (!DRY) fs.writeFileSync(p, src, "utf8");
  console.log(meta.file + "（" + meta.label + "）：改 " + n + " 个色值，饱和 ×" + FACTOR);
  total += n;
});
console.log("合计 " + total + (DRY ? "（--dry，未写入）" : ""));

/* 抽几个值给个直观对比 */
console.log("\n抽样对比：");
["#e9dcb8", "#dde4bd", "#8dae9c", "#bdd3c7"].forEach(function (c) {
  console.log("  " + c + " → " + desat(c) + "   （饱和 " +
    (rgbToHsl(hexToRgb(c))[1] * 100).toFixed(0) + "% → " + (rgbToHsl(hexToRgb(desat(c)))[1] * 100).toFixed(0) + "%）");
});
