/* ============================================================
   地图设色：《淡彩水墨》→《青绿重彩》
   ----------------------------------------------------------
   方案里 P0 的第一条就是地图。原来的山体是「灰淡的青绿」，
   石青与石绿之间没有层次。这里按方案的设色表重铺：

     山脊 · 石青   #376b76   （深）
     山腰 · 石绿   #568c78   （中）
     山脚 · 浅石绿 #94b5a0   （浅）
     陆地 · 绢黄   #eadcb5
     河流 · 青碧   #6398ac
     边界 · 赭灰   #c6b78f

   ⚠️ 关键的一处**方向反转**：
   原来的渐变是「山巅最亮 → 山脚最暗」（山巅用 tones[2]、山脚用 tones[0]）。
   而青绿山水的画法是**山脊压石青（深）、往下过渡到石绿、山脚浅石绿**——
   《千里江山图》里的山峰正是顶深底浅。
   所以 TONES 的三元组语义保持不变（[山阴, 山腰, 山巅]），
   只把值换成 [浅石绿, 石绿, 石青]，渐变代码一行不用动，
   方向自然就反过来了。

   用法：node tools/recolor-map.js [--dry]
   ============================================================ */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DRY = process.argv.includes("--dry");
const log = [];

function edit(file, pairs) {
  const p = path.join(ROOT, file);
  let src = fs.readFileSync(p, "utf8");
  const before = src;
  pairs.forEach(function (pr) {
    /* ⚠️ 多行匹配必须同时试 LF 与 CRLF。
       仓库里的文件是 CRLF（git 的 autocrlf），而脚本里写的字符串是 LF，
       直接 indexOf 会「看起来一模一样却匹配不到」——踩过一次。 */
    const variants = [pr[0], pr[0].replace(/\n/g, "\r\n")];
    const hit = variants.find(function (v) { return src.indexOf(v) !== -1; });
    if (!hit) { log.push(["⚠ 没匹配到", file + "  " + pr[0].slice(0, 46)]); return; }
    const to = hit === pr[0] ? pr[1] : pr[1].replace(/\n/g, "\r\n");
    src = src.split(hit).join(to);
    log.push(["改", file + "  " + (pr[2] || pr[0].slice(0, 46))]);
  });
  if (src !== before && !DRY) fs.writeFileSync(p, src, "utf8");
}

/* ---------- 1) 省区设色：向绢黄靠，保留地区差异 ================
   方案：「省份底色可以继续以浅赭、米黄为主」，陆地基准 #eadcb5。
   原来那组偏青绿（#dce2bf 之类），现在整体挪到绢黄一侧，
   只留一点点地区冷暖差（西北偏沙、江南偏绿）。 */
edit("src/engine/mapEngine.js", [
  [
`const TINTS = {
  东北: ["#e0dbbc", "#d9d5b5"],
  华北: ["#e5dbbc", "#ded4b4"],
  华东: ["#dce2bf", "#d6dcb9"],   // 江南
  华中: ["#e0e0bd", "#d9d9b7"],
  华南: ["#d6e0bb", "#d0dbb4"],
  西南: ["#d9e2bf", "#d3dcb9"],
  西北: ["#ebe2c5", "#e4dbbc"],
  其他: ["#e2dec0", "#dcd8b9"],
};`,
`const TINTS = {
  /* 以陆地绢黄 #eadcb5 为基准，各区只留一点冷暖差：
     西北偏沙、江南偏青绿、其余居中。整体比原来暖，青绿让给山体。 */
  东北: ["#e9dcb6", "#e3d7ae"],
  华北: ["#ebddb4", "#e5d8ac"],
  华东: ["#e6e0b8", "#e0dab0"],   // 江南：略偏青绿
  华中: ["#e8ddb6", "#e2d8ae"],
  华南: ["#e3dfb4", "#ddd9ac"],
  西南: ["#e5dfb6", "#dfdaae"],
  西北: ["#efe3c2", "#e9ddb9"],
  其他: ["#e8ddb8", "#e2d8b0"],
};`,
    "省区设色 → 绢黄系",
  ],
  [
`const PROV_FIX = {
  西藏自治区: ["#f2efe3", "#eeece1"],
  新疆维吾尔自治区: ["#ede3c9", "#e6dec1"],
  青海省: ["#e9e3cc", "#e4dec2"],
  内蒙古自治区: ["#e7dbb9", "#e0d5b1"],
  四川省: ["#d8dfbc", "#d2dab5"],
  云南省: ["#d7e0b9", "#d1dab3"],
};`,
`const PROV_FIX = {
  /* 高原偏白、戈壁偏沙——与 TINTS 同一套绢黄基准 */
  西藏自治区: ["#f3efe0", "#efeadd"],
  新疆维吾尔自治区: ["#f0e4c4", "#eadfbb"],
  青海省: ["#ece4c8", "#e7dfbe"],
  内蒙古自治区: ["#eadcb4", "#e4d7ac"],
  四川省: ["#e2deb2", "#dcd8aa"],
  云南省: ["#e1dfb0", "#dbd9a8"],
};`,
    "六省特例 → 绢黄系",
  ],
  /* 山脊墨线：石青系 */
  ['const RIDGE_INK = ["#617b69", "#698570", "#6e8c76", "#667c6c"];',
   'const RIDGE_INK = ["#3f6a74", "#446f78", "#4a747c", "#3d6870"];',
   "山脊墨线 → 石青系"],
  /* 山脚收进的雾色：接近新的省区底色 */
  ['const RIDGE_MIST = "#e6e3c9";', 'const RIDGE_MIST = "#ece2c4";', "山脚雾色 → 绢黄"],
  /* 背光坡：比主山最深的石青再暗一档 */
  ['const FACE_INK = "#4f695a";', 'const FACE_INK = "#2c5a63";', "背光坡 → 深石青"],
  /* 国境线：赭灰 */
  ['style: { color: "#a8ae95", weight: 1.5, fill: false, lineJoin: "round", opacity: 0.8 },',
   'style: { color: "#c6b78f", weight: 1.5, fill: false, lineJoin: "round", opacity: 0.85 },',
   "国境线 → 赭灰"],
  /* 河流：青碧。方案原值 #6398ac 压在陆地绢黄上只有 2.33:1，
     压到 #518498 = 3.02:1（线状图形要 3:1） */
  ['L.polyline(pts, { pane: "hydro", color: "#93b4c5", weight: 3.6, opacity: 0.26, lineCap: "round", lineJoin: "round", interactive: false }).addTo(map);',
   'L.polyline(pts, { pane: "hydro", color: "#8fb2bf", weight: 3.6, opacity: 0.26, lineCap: "round", lineJoin: "round", interactive: false }).addTo(map);',
   "河流外晕 → 青碧浅"],
  ['L.polyline(pts, { pane: "hydro", color: "#659db2", weight: 1.5, opacity: 0.92, lineCap: "round", lineJoin: "round", interactive: false }).addTo(map);',
   'L.polyline(pts, { pane: "hydro", color: "#518498", weight: 1.5, opacity: 0.92, lineCap: "round", lineJoin: "round", interactive: false }).addTo(map);',
   "河流主线 → 青碧（3.02:1）"],
  /* 运河：青碧浅色虚线 */
  ['L.polyline(cpts, { pane: "hydro", color: "#a0bfc8", weight: 1.1, opacity: 0.6, dashArray: "4 4", lineCap: "round", lineJoin: "round", interactive: false }).addTo(map);',
   'L.polyline(cpts, { pane: "hydro", color: "#8fb2bf", weight: 1.1, opacity: 0.7, dashArray: "4 4", lineCap: "round", lineJoin: "round", interactive: false }).addTo(map);',
   "运河 → 青碧浅"],
]);

/* ---------- 2) 山体三档：方向反转 ---------- */
edit("src/engine/terrain.js", [
  [
`  var TONES = [
    ["#90ab9c", "#b0c8b4", "#d5e5d1"],
    ["#96b1a1", "#b5ccb8", "#d9e6d6"],
    ["#9ebaa7", "#bbd1bb", "#dde9db"],
    ["#97afa1", "#b7cdb6", "#d9e6d5"],
  ];`,
`  /* ⚠️ 三元组的语义是 [山阴, 山腰, 山巅]，而渐变的画法是
     「offset 0 用 [2]、offset 0.58 之后用 [0]」——
     也就是 [2] 在顶上、[0] 在底下。
     青绿山水是**山脊压石青（深）、山脚浅石绿（浅）**，
     所以这里填 [浅石绿, 石绿, 石青]，方向自然就是顶深底浅。
     四个变体只在色相上微调，让相邻山系不至于一模一样。 */
  var TONES = [
    ["#94b5a0", "#568c78", "#376b76"],
    ["#9ab8a6", "#5c907d", "#3a6f7c"],
    ["#8fb2a0", "#528a78", "#346873"],
    ["#98b6a3", "#5a8e7b", "#38707a"],
  ];`,
    "山体三档 → 石青/石绿/浅石绿（方向反转）",
  ],
  [
`  var FAR_TONES = [
    ["#bed2c7", "#d0ded5", "#e0e9e3"],
    ["#c2d3ca", "#d3e0d8", "#e2ece6"],
    ["#c6d6cd", "#d6e2da", "#e5eee8"],
    ["#bfd3c9", "#d1dfd6", "#e1eae4"],
  ];`,
`  /* 远山：空气透视——比主山整体更淡、更偏青灰，但**方向与主山一致**
     （山顶略深、往下没入雾）。原来远山是顶浅底深，与主山反着，
     现在统一。 */
  var FAR_TONES = [
    ["#c6d4c4", "#a8c0b0", "#8aa6a6"],
    ["#c9d6c7", "#adc3b4", "#8fa9aa"],
    ["#c4d3c5", "#a5bdb0", "#86a3a4"],
    ["#c7d5c6", "#abc2b2", "#8ca7a8"],
  ];`,
    "远山色阶 → 同向、更淡",
  ],
]);

console.log((DRY ? "（--dry，未写入）\n" : "") + "地图设色：");
log.forEach(function (l) { console.log("  " + l[0] + "  " + l[1]); });
