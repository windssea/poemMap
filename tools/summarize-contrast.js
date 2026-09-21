/* 把对比度探针的输出整理成人看的摘要。
   用法：node tools/cdp.js <url> --eval "@tools/probes/contrast.js" 7000 > tmp.txt
        node tools/summarize-contrast.js tmp.txt */
const fs = require("fs");
const file = process.argv[2] || "tmp-contrast.txt";
let raw = fs.readFileSync(file, "utf8");
if ((raw.match(/\u0000/g) || []).length > 20) raw = fs.readFileSync(file, "utf16le");
raw = raw.replace(/\u0000/g, "");

const m = raw.match(/"\{[\s\S]*\}"/);
if (!m) { console.log("没抓到探针输出，原始尾部：\n" + raw.slice(-600)); process.exit(1); }
const o = JSON.parse(JSON.parse(m[0]));

console.log("正文对比度失败：" + o.fail + " 处");
console.log("装饰性文字失败：" + o.failDecorative + " 处（aria-hidden，不参与正文判定）");
console.log("跳过（渐变背景，JS 取不到单一底色）：" + o.skippedGradientBg + " 处");

if (o.worst && o.worst.length) {
  console.log("\n最差的几处：");
  o.worst.forEach(function (w) {
    console.log("  " + String(w.ratio).padStart(5) + ":1  需 " + w.need + "  " + w.sel +
      "  " + w.size + "px  「" + w.text + "」  " + w.color + " on " + w.bg);
  });
} else {
  console.log("\n✔ 没有低于阈值的地方");
}
if (o.decorative && o.decorative.length) {
  console.log("\n装饰性（仅供参考）：");
  o.decorative.forEach(function (w) {
    console.log("  " + String(w.ratio).padStart(5) + ":1  " + w.sel + "  「" + w.text + "」");
  });
}
