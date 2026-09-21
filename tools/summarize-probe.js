/* 通用探针输出整理：读 cdp 重定向出来的文件，把里头那段 JSON 美化打印。
   用法：node tools/summarize-probe.js <file> */
const fs = require("fs");
const file = process.argv[2];
if (!file) { console.error("用法: node tools/summarize-probe.js <file>"); process.exit(2); }
let raw = fs.readFileSync(file, "utf8");
/* PowerShell 的 > 可能写成 UTF-16LE */
if ((raw.match(/\u0000/g) || []).length > 20) raw = fs.readFileSync(file, "utf16le");
raw = raw.replace(/\u0000/g, "");

/* 探针返回的是一个 JSON 字符串，被 cdp 再包了一层 —— 所以剥两层引号 */
const m = raw.match(/"\{[\s\S]*?\}"\s*$/m) || raw.match(/"\{[\s\S]*\}"/);
if (!m) { console.log("没抓到 JSON，原始尾部：\n" + raw.slice(-900)); process.exit(1); }
let s = m[0];
try { s = JSON.parse(s); } catch (e) { /* 已经是对象串 */ }
try { console.log(JSON.stringify(typeof s === "string" ? JSON.parse(s) : s, null, 1)); }
catch (e) { console.log("解析失败：" + e.message + "\n原文：" + String(s).slice(0, 900)); }
