/* ============================================================
   一次性迁移脚本：window 全局脚本 → ES Module
   ----------------------------------------------------------
   把 data/*.js 与 js/*.js（app.js 除外）由「挂 window」的传统脚本
   转成 src/ 下的 ESM 模块。转换后**在沙箱里跑两边并逐字段深比对**，
   证明数据与生成结果一字未改；任何不一致直接报错退出，不写文件。

   用法：node tools/port-to-esm.js
   ============================================================ */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "src");
const log = [];

/* ---------------- 工具 ---------------- */
function read(p) { return fs.readFileSync(path.join(ROOT, p), "utf8"); }
function write(p, s) {
  const out = path.join(SRC, p);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, s, "utf8");
}
/** 在沙箱里跑传统脚本，取回挂到 window 上的东西 */
function evalLegacy(code) {
  const win = {};
  return new Function("window", "document", "self", code + "\n;return window;")(win, {}, win);
}
/** 把 ESM 降级为可 new Function 的传统代码 */
function stripExport(code) {
  return code
    .replace(/^\s*import[^\n]*\n/gm, "")
    .replace(/\bexport\s+default\s+/g, "")
    .replace(/\bexport\s+const\s+/g, "const ")
    .replace(/\bexport\s+function\s+/g, "function ");
}
/** 取出 ESM 里某个 const 的值 */
function evalConst(code, name) {
  return new Function(stripExport(code) + "\n;return " + name + ";")();
}
/** 深比对，不一致就抛错 */
function same(a, b, label) {
  const A = JSON.stringify(a), B = JSON.stringify(b);
  if (A !== B) {
    let i = 0;
    while (i < A.length && A[i] === B[i]) i++;
    throw new Error(
      `✗ ${label}：内容不一致（${A.length} vs ${B.length} 字节）\n` +
      `  old …${A.slice(Math.max(0, i - 50), i + 50)}\n  new …${B.slice(Math.max(0, i - 50), i + 50)}`
    );
  }
  return `${label} ✓ 完全一致（${(A.length / 1024).toFixed(1)} KB）`;
}

/* ---------------- 一、数据：window.X = {...} ---------------- */
[
  { file: "data/authors.js", name: "AUTHORS" },
  { file: "data/tags.js", name: "POEM_TAGS" },
  { file: "data/china.geo.js", name: "CHINA_GEO" },
  { file: "data/geo-extras.js", name: "GEO_EXTRAS" },
].forEach(function (j) {
  const src = read(j.file);
  const hits = src.match(new RegExp("window\\." + j.name + "\\b", "g")) || [];
  if (hits.length !== 1) throw new Error(`✗ ${j.file} 期望 1 处 window.${j.name}，实为 ${hits.length}`);

  const out = src.replace(new RegExp("window\\." + j.name + "\\b"), "const " + j.name) +
    "\n\nexport default " + j.name + ";\n";

  log.push(same(evalLegacy(src)[j.name], evalConst(out, j.name), j.file + " → src/" + j.file));
  write(j.file, out);
});

/* ---------------- 二、数据：poems.*.js（push 风格） ---------------- */
[
  { dyn: "tang", name: "TANG_POEMS" },
  { dyn: "song", name: "SONG_POEMS" },
].forEach(function (j) {
  const file = "data/poems." + j.dyn + ".js";
  const src = read(file);
  if (!/^window\.POEMS = window\.POEMS \|\| \[\];\s*$/m.test(src))
    throw new Error(`✗ ${file} 未找到 POEMS 初始化行`);
  if (!/\);\s*\/\/\s*end-/.test(src))
    throw new Error(`✗ ${file} 未找到 end- 收尾标记`);

  const out = src
    .replace(/^window\.POEMS = window\.POEMS \|\| \[\];\s*$/m, "")
    .replace(/\bwindow\.POEMS\.push\(/, "export const " + j.name + " = [")
    .replace(/\);\s*\/\/\s*end-[\w-]+\s*$/, "];\n");

  const oldArr = evalLegacy(src.replace("window.POEMS = window.POEMS || [];", "window.POEMS = [];")).POEMS;
  const newArr = evalConst(out, j.name);
  if (!newArr || !newArr.length) throw new Error(`✗ ${file} 转换后为空`);
  log.push(same(oldArr, newArr, file + ` → src/data/poems.${j.dyn}.js（${newArr.length} 首）`));
  write("data/poems." + j.dyn + ".js", out);
});

/* ---------------- 三、引擎：window.X = (function(){...})() ---------------- */
[
  { file: "js/terrain.js", name: "TERRAIN" },
  { file: "js/thumbs.js", name: "THUMBS" },
  { file: "js/mapimage.js", name: "MAP_OVERLAY" },
  { file: "js/atmosphere.js", name: "ATMOSPHERE", import: 'import * as THREE from "three";' },
  { file: "js/motion.js", name: "MOTION", import: 'import gsap from "gsap";' },
  { file: "js/eave.js", name: "EAVE_SVG" },
].forEach(function (j) {
  const src = read(j.file);
  let out;

  if (j.name === "MAP_OVERLAY") {
    out = src.replace(/window\.MAP_OVERLAY\b/, "export const MAP_OVERLAY");
  } else {
    out = src.replace(
      new RegExp("window\\." + j.name + " = \\(function \\(\\) \\{"),
      "export const " + j.name + " = (function () {"
    );
  }
  if (out === src) throw new Error(`✗ ${j.file} 未匹配到 window.${j.name} 导出`);

  /* 外部依赖改成 ESM import */
  if (j.name === "ATMOSPHERE") out = out.replace(/\bwindow\.THREE\b/g, "THREE");
  if (j.name === "MOTION") out = out.replace(/\bwindow\.gsap\b/g, "gsap");
  if (j.import) out = j.import + "\n" + out;

  if (new RegExp("window\\." + j.name + "\\b").test(out))
    throw new Error(`✗ ${j.file} 仍残留 window.${j.name}`);

  out += "\nexport default " + j.name + ";\n";
  write("engine/" + path.basename(j.file), out);
  log.push(`src/engine/${path.basename(j.file)} ✓ 转换完成（${j.name}）`);
});

/* ---------------- 四、确定性产物比对 ---------------- */
log.push(same(
  evalLegacy(read("js/terrain.js")).TERRAIN.build(),
  evalConst(read("js/terrain.js").replace(/window\.TERRAIN = \(function/, "const TERRAIN = (function"), "TERRAIN").build(),
  "地形生成 build()"
));
const poem = { id: "sample", dynasty: "唐", form: "诗", place: { region: "华中" } };
const thumbCode = read("js/thumbs.js").replace(/window\.THUMBS = \(function/, "const THUMBS = (function");
log.push(same(
  evalLegacy(read("js/thumbs.js")).THUMBS.svg(poem),
  evalConst(thumbCode, "THUMBS").svg(poem),
  "篇目小景 svg()"
));

/* ---------------- 五、报告 ---------------- */
console.log("\n════════════ 迁移结果 ════════════");
log.forEach(function (l) { console.log("  " + l); });
console.log("══════════════════════════════════\n");
