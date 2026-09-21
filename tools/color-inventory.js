/* 把 style.css 里所有颜色值统计出来，按出现次数排序。
   改设计语言之前先看清「现在到底有多少种颜色」——凭印象改一定会漏。
   用法：node tools/color-inventory.js [file] */
const fs = require("fs");
const path = require("path");
const file = process.argv[2] || "src/styles/style.css";
const src = fs.readFileSync(path.join(__dirname, "..", file), "utf8");

/* hex + rgb/rgba */
const RE = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g;
const counts = new Map();
let m;
while ((m = RE.exec(src))) {
  const v = m[0].replace(/\s+/g, " ").trim();
  counts.set(v, (counts.get(v) || 0) + 1);
}

const all = [...counts.entries()].sort(function (a, b) { return b[1] - a[1]; });
console.log(file + "：共 " + all.length + " 种颜色，出现 " +
  all.reduce(function (s, x) { return s + x[1]; }, 0) + " 次\n");

/* 按色相粗略分组，好看出「其实在用几套色系」 */
function hue(v) {
  let r, g, b;
  if (v[0] === "#") {
    const s = v.slice(1);
    if (s.length === 3) { r = parseInt(s[0] + s[0], 16); g = parseInt(s[1] + s[1], 16); b = parseInt(s[2] + s[2], 16); }
    else { r = parseInt(s.slice(0, 2), 16); g = parseInt(s.slice(2, 4), 16); b = parseInt(s.slice(4, 6), 16); }
  } else {
    const p = v.match(/[\d.]+/g).map(Number);
    r = p[0]; g = p[1]; b = p[2];
  }
  if (r === g && g === b) return "灰";
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2 / 255;
  if (max - min < 12) return l > 0.5 ? "浅灰" : "深灰";
  let h;
  if (max === r) h = ((g - b) / (max - min) + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / (max - min) + 2) * 60;
  else h = ((r - g) / (max - min) + 4) * 60;
  if (h < 20 || h >= 340) return "红";
  if (h < 45) return "橙金";
  if (h < 70) return "黄";
  if (h < 160) return "绿";
  if (h < 200) return "青";
  if (h < 260) return "蓝";
  return "紫";
}

const groups = {};
all.forEach(function ([v, n]) { const h = hue(v); (groups[h] = groups[h] || []).push([v, n]); });

console.log("按色相分组：");
Object.keys(groups).sort(function (a, b) {
  return groups[b].reduce(function (s, x) { return s + x[1]; }, 0) -
    groups[a].reduce(function (s, x) { return s + x[1]; }, 0);
}).forEach(function (h) {
  const list = groups[h];
  const total = list.reduce(function (s, x) { return s + x[1]; }, 0);
  console.log("\n  【" + h + "】" + list.length + " 种 · " + total + " 次");
  list.slice(0, 22).forEach(function ([v, n]) { console.log("     " + String(n).padStart(4) + "×  " + v); });
  if (list.length > 22) console.log("     … 还有 " + (list.length - 22) + " 种");
});
