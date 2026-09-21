/* 把 a11y 探针的输出整理成人看的摘要。
   用法：node tools/cdp.js <url> --eval "@tools/probes/a11y.js" 7000 > tmp.txt
        node tools/summarize-a11y.js tmp.txt */
const fs = require("fs");
const file = process.argv[2] || "tmp-a11y.txt";
let raw = fs.readFileSync(file, "utf8");
/* PowerShell 的 > 重定向可能写成 UTF-16LE：读成 utf8 会变成「字 符 间 带 空 格」。
   检测到大量 NUL 就按 UTF-16 重读。 */
if ((raw.match(/\u0000/g) || []).length > 20) raw = fs.readFileSync(file, "utf16le");
raw = raw.replace(/\u0000/g, "");
const m = raw.match(/"\{[\s\S]*\}"/);
if (!m) { console.log("没抓到探针输出，原始尾部：\n" + raw.slice(-800)); process.exit(1); }
const o = JSON.parse(JSON.parse(m[0]));

console.log("C09 地标键盘可达：");
console.log("   " + JSON.stringify(o.C09, null, 1).replace(/\n/g, "\n   "));
console.log("\nC10 抽屉焦点：");
console.log("   " + JSON.stringify(o.C10, null, 1).replace(/\n/g, "\n   "));
console.log("\nC11 真模态 inert：");
console.log("   " + JSON.stringify(o.C11, null, 1).replace(/\n/g, "\n   "));
console.log("\nC08 索引缓存：");
console.log("   " + JSON.stringify(o.C08, null, 1).replace(/\n/g, "\n   "));

console.log("\nC13 命中区 < 44px 的元素：");
const agg = {};
(o.C13_smallTargets || []).forEach(function (x) {
  const k = x.sel + "  " + x.w + "×" + x.h;
  agg[k] = (agg[k] || 0) + 1;
});
const rows = Object.entries(agg).sort(function (a, b) { return b[1] - a[1]; });
if (!rows.length) console.log("   无");
rows.forEach(function ([k, v]) { console.log("   " + k + (v > 1 ? "   ×" + v : "")); });
