/* ============================================================
   字体清晰度：把字号与字距收回整数
   ----------------------------------------------------------
   实测（tools/probes/type-sharp.js，1× DPR）：
     分数字号的文字元素 1081 个，整数的 537 个 —— **三分之二的文字**
     声明里 51 处 font-size 是分数（11.5 / 12.5 / 13.5 / 10.5 / 14.5 / 9.5 …）
     字距全部是 em，小字号下算出来也是分数（.05em @11.5px = 0.575px）

   为什么这对中文尤其要紧：
     汉字是全角，**步进宽度 = 字号**。所以
       字号是整数 + 字距为 0  →  每个字都落在整数像素上，边缘干净
       字号是分数 或 字距是分数 →  第一个字之后每个字都偏移一个分数，
                                   整行都被抗锯齿抹开
   也就是说中文排版里「字号 + 字距」这两个数必须都是整数，
   只修其中一个没有用。

   规则：
     · 所有 font-size 四舍五入到整数
     · 所有 letter-spacing 由 em 换算成**整数 px**
       —— 不是归零。竖排的 `.cp-line` / `.sv-line` / `.d-poem` 里，
       字距就是字与字之间的间距，归零会让字挤在一起（试过，难看）。
       换算成整数 px 两头都保住：设计要的字距还在，步进又落回像素网格。
     · 去掉 body 上的 -webkit-font-smoothing: antialiased
       （它的作用是「让字变细」，正好与清晰相反；macOS 上会关掉次像素抗锯齿）
     · text-rendering: optimizeLegibility → auto
       （现代浏览器默认就做 kerning，这个值只会带来副作用）

   用法：node tools/fix-type.js [--dry]
   ============================================================ */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const FILE = "src/styles/style.css";
const DRY = process.argv.includes("--dry");

let src = fs.readFileSync(path.join(ROOT, FILE), "utf8");
const before = src;

const sizeChanged = new Map();
const trackChanged = [];

/* 逐个「最内层规则块」处理：/\{([^{}]*)\}/ 匹配不含嵌套括号的块，
   @media 这类外层块不会被误当规则（它里面没有 font-size）。 */
src = src.replace(/\{([^{}]*)\}/g, function (whole, body) {
  const sizeM = body.match(/font-size:\s*([\d.]+)px\s*;/);
  if (!sizeM) return whole;

  const oldSize = parseFloat(sizeM[1]);
  const newSize = Math.round(oldSize);
  let out = body;

  if (newSize !== oldSize) {
    out = out.replace(/font-size:\s*[\d.]+px\s*;/, "font-size: " + newSize + "px;");
    sizeChanged.set(oldSize, (sizeChanged.get(oldSize) || 0) + 1);
  }

  /* 字距：em → 整数 px */
  const trackM = out.match(/letter-spacing:\s*([\d.]+)em\s*;/);
  if (trackM) {
    const em = parseFloat(trackM[1]);
    const px = Math.round(newSize * em);
    out = out.replace(/letter-spacing:\s*[\d.]+em\s*;/, "letter-spacing: " + px + "px;");
    trackChanged.push(em + "em @" + newSize + "px → " + px + "px");
  }
  return "{" + out + "}";
});

/* body 上的两个渲染开关 */
src = src.replace(/^\s*-webkit-font-smoothing:\s*antialiased;\s*$/m, "");
src = src.replace(/text-rendering:\s*optimizeLegibility;/, "text-rendering: auto;");

if (src !== before && !DRY) fs.writeFileSync(path.join(ROOT, FILE), src, "utf8");

console.log("字号取整：" + [...sizeChanged.entries()].map(function (e) {
  return e[0] + "→" + Math.round(e[0]) + "px ×" + e[1];
}).join("  "));
console.log("\n字距 em → 整数 px：" + trackChanged.length + " 处");
const byTrack = {};
trackChanged.forEach(function (t) { byTrack[t] = (byTrack[t] || 0) + 1; });
Object.keys(byTrack).sort(function (a, b) { return byTrack[b] - byTrack[a]; }).forEach(function (k) {
  console.log("   " + String(byTrack[k]).padStart(3) + "×  " + k);
});
console.log("\nbody 渲染开关：去掉 -webkit-font-smoothing: antialiased，text-rendering → auto");
console.log(DRY ? "（--dry，未写入）" : "已写入 " + FILE);
