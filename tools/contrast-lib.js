/* 对比度计算的公共库（从 tools/contrast.js 抽出，供其它脚本 require） */
function hexToRgb(h) {
  const s = String(h).replace("#", "");
  const f = s.length === 3 ? s.split("").map(function (c) { return c + c; }).join("") : s;
  return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)];
}
function toHex(rgb) {
  return "#" + rgb.map(function (v) { return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"); }).join("");
}
function lum(rgb) {
  const [r, g, b] = rgb.map(function (v) {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(fg, bg) {
  const a = lum(hexToRgb(fg)), b = lum(hexToRgb(bg));
  const hi = Math.max(a, b), lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
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
/** 保持色相与饱和度，只压暗明度，直到对 bg 达到 target */
function darkenTo(fg, bg, target) {
  const hsl = rgbToHsl(hexToRgb(fg));
  for (let l = hsl[2]; l >= 0; l -= 0.002) {
    const c = toHex(hslToRgb([hsl[0], hsl[1], l]));
    if (ratio(c, bg) >= target) return c;
  }
  return toHex(hslToRgb([hsl[0], hsl[1], 0]));
}
/** 保持色相与饱和度，只提亮明度，直到对 bg 达到 target（用于反白字场景） */
function lightenTo(fg, bg, target) {
  const hsl = rgbToHsl(hexToRgb(fg));
  for (let l = hsl[2]; l <= 1; l += 0.002) {
    const c = toHex(hslToRgb([hsl[0], hsl[1], l]));
    if (ratio(c, bg) >= target) return c;
  }
  return toHex(hslToRgb([hsl[0], hsl[1], 1]));
}
module.exports = { hexToRgb, toHex, lum, ratio, rgbToHsl, hslToRgb, darkenTo, lightenTo };
