/* ============================================================
   对比度计算器（WCAG 2.1）
   ----------------------------------------------------------
   C12 那条观察里的「约 2.3:1」是估的，不能拿估算去改颜色。
   这里按 WCAG 公式实算，并且**在保持色相与饱和度的前提下**找出
   满足 4.5:1 的最浅那一档 —— 只是压暗，不换色调，
   免得把「暖灰」调成「冷灰」破坏了整张纸的色温。

   用法：node tools/contrast.js                      查内置的几组
        node tools/contrast.js "#b6a892" "#f2e9d7"   查指定前景/背景
        node tools/contrast.js --fix "#b6a892" "#f2e9d7"   给出压暗方案
   ============================================================ */

const hex = (h) => {
  const s = h.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
};
const toHex = (rgb) => "#" + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");

/* sRGB → 相对亮度 */
function lum(rgb) {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(fg, bg) {
  const a = lum(hex(fg)), b = lum(hex(bg));
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/* 转 HSL 只调 L：色相与饱和度原样保留 */
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
  const f = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

const args = process.argv.slice(2);
const fix = args.includes("--fix");
const vals = args.filter((a) => !a.startsWith("--"));

/* 内置：项目里实际在用的几组 */
const PAIRS = vals.length >= 2 ? [[vals[0], vals[1]]] : [
  ["#b6a892", "#f2e9d7", "--ink-4 on --paper"],
  ["#b6a892", "#fdf8ec", "--ink-4 on --paper-2"],
  ["#b6a892", "#fffdf7", "--ink-4 on --paper-3"],
  ["#9c8f7b", "#f2e9d7", "--ink-3 on --paper"],
  ["#6d6152", "#f2e9d7", "--ink-2 on --paper"],
  ["#3a3026", "#f2e9d7", "--ink   on --paper"],
  ["#a8322a", "#f2e9d7", "--seal  on --paper"],
  ["#8b7a63", "#f2e9d7", ".sv-line"],
  ["#4a4438", "#f2e9d7", ".sec p 正文"],
];

console.log("WCAG 2.1 对比度（正文要 ≥4.5:1，大字/图形要 ≥3:1）\n");
for (const [fg, bg, label] of PAIRS) {
  const r = ratio(fg, bg);
  const tag = r >= 4.5 ? "AA 正文 ✔" : r >= 3 ? "仅大字/图形" : "✘ 不达标";
  console.log("  " + (label || fg + " on " + bg).padEnd(24) + fg + " on " + bg +
    "  →  " + r.toFixed(2) + ":1   " + tag);
  if (fix) {
    const hsl = rgbToHsl(hex(fg));
    const solve = (target) => {
      for (let l = hsl[2]; l >= 0; l -= 0.002) {
        const c = toHex(hslToRgb([hsl[0], hsl[1], l]));
        if (ratio(c, bg) >= target) return c;
      }
      return null;
    };
    const aa = solve(4.5), gfx = solve(3);
    if (aa) console.log("      ≥4.5:1（正文）  " + aa + "  →  " + ratio(aa, bg).toFixed(2) + ":1");
    if (gfx) console.log("      ≥3.0:1（图形）  " + gfx + "  →  " + ratio(gfx, bg).toFixed(2) + ":1");
    if (aa) console.log("      亮度 " + (hsl[2] * 100).toFixed(1) + "% → " +
      (rgbToHsl(hex(aa))[2] * 100).toFixed(1) + "%（色相与饱和度未动）");
  }
}
