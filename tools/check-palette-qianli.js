/* 《千里江山图》色板 · 采用值回归检查
   ----------------------------------------------------------
   这个脚本查的是**实际采用的色值**（不是方案里的原始建议），
   所以它是一条回归线：以后谁动了这些颜色，这里会立刻报出来。

   方案原始建议里有 9 处不达标，凡是「要读的字」都压到了阈值，
   凡是「大面积填色」与「禁用态」都按 WCAG 的适用范围保留原值。
   下面每一条都注明了原值 → 采用值 → 实算结果。

   阈值按**用途**给，不是一律 4.5：
     text  正文/说明文字，4.5:1
     gfx   线、描边、图标，3:1（WCAG 1.4.11）
     fill  大面积填色，无要求（1.4.11 只管组件与图形边界）
     off   禁用态，WCAG 明确豁免

   用法：node tools/check-palette-qianli.js
   ============================================================ */
const C = require("./contrast-lib.js");

const P = {
  juan:   "#f3efdf",  // 绢本底色
  warm:   "#faf7ed",  // 暖绢白
  moQing: "#293f3b",  // 墨青
  body:   "#344840",  // 诗词正文
  ink2:   "#3f5149",
  ink3:   "#656f68",  // 辅助  ← 方案 #748078 只有 3.57:1
  shiQing:"#3e6b80",  // 石青 ← 原 #376b76：色相与中石绿只差十几度，山脊读成一片青灰
  shiLv:  "#568c78",  // 石绿（填色）
  shiLvT: "#487565",  // 石绿（当文字用）← 方案 #568c78 只有 3.36:1
  shenLv: "#376b60",  // 深石绿（选中筛选实底）
  qingBi: "#518498",  // 青碧 ← 方案 #6398ac 压在陆地上只有 2.33:1
  zheJin: "#a5854f",  // 赭金 ← 方案 #b39460 只有 2.49:1
  zhuSha: "#a94f3c",  // 朱砂
  land:   "#eadcb5",  // 陆地绢黄
  bian:   "#c6b78f",  // 边界赭灰
  tiCi:   "#706d60",  // 竖排题词 ← 方案 #7a7768 只有 3.91:1
  chipOff:"#eef0e5",
  chipTxt:"#52685b",
  chipSel:"#376b60",
  chipDis:"#e9e8df",
  chipDisTxt:"#85867a", // ← 方案 #9a9b91 只有 2.29:1（豁免，仍提了一档）
  lvLight:"#94b5a0",  // 浅石绿（山脚大面积填色）
};

const CASES = [
  /* ── 文字（4.5:1）── */
  ["text", "墨青 · 标题",        P.moQing, P.juan],
  ["text", "墨青 · 暖绢白上",     P.moQing, P.warm],
  ["text", "诗词正文",           P.body,   P.warm],
  ["text", "次级文字",           P.ink2,   P.juan],
  ["text", "辅助文字（方案 3.57:1）", P.ink3, P.juan],
  ["text", "竖排题词（方案 3.91:1）", P.tiCi, P.juan],
  ["text", "朱砂 · 选中/重点",    P.zhuSha, P.juan],
  ["text", "石绿当文字（方案 3.36:1）", P.shiLvT, P.juan],
  ["text", "石青 · 重点装饰",     P.shiQing, P.juan],
  ["text", "一级地名（陆地绢黄上）", P.moQing, P.land],
  /* ⚠️ 这条要用**代码里实际的值**。原来这里填的是「石绿当文字」#487565，
     而 .prov-label 实际用的是 #546359 —— 检查项和实现脱节，
     于是报了一个根本不存在的失败。查色板要查真值。 */
  ["text", "二级地名 · 省名（陆地绢黄上）", "#546359", P.land],
  /* ── 反白 ── */
  ["text", "选中筛选 白字",       "#ffffff", P.chipSel],
  ["text", "未选中筛选 文字",     P.chipTxt, P.chipOff],
  ["text", "朱砂实底 白字",       "#ffffff", P.zhuSha],
  ["text", "石青实底 白字",       "#ffffff", P.shiQing],
  /* ── 底栏三枚时代小签：反白的小字压在渐变上，
        决定对比度的是**浅端**，所以三组都按浅端查 ── */
  ["text", "底栏小签 先唐 · 深石绿", "#faf7ed", "#376b60"],
  ["text", "底栏小签 唐 · 石绿",     "#faf7ed", "#487565"],
  ["text", "底栏小签 宋 · 石青",     "#faf7ed", "#3e6b80"],
  /* ── 图形（3:1）── */
  ["gfx",  "赭金 勾边/分割（方案 2.49:1）", P.zheJin, P.juan],
  ["gfx",  "赭金 压在陆地绢黄上",  "#967948", P.land],
  ["gfx",  "青碧 河流（方案 2.33:1）", P.qingBi, P.land],
  /* ── 地图边界：**不是** WCAG 1.4.11 意义上的「组件边界」──
     1.4.11 管的是界面组件与其状态的视觉边界，行政边界是地图内容。
     而且相邻省各有略不同的绢黄底色，边界不是唯一的区分手段。
     所以这里不设阈值，只把实际值记下来——但也不能是 0，
     方案要的就是「看得见、但很轻」的一线痕。 */
  ["map",  "省界 赭灰 @70%（合成后）", "#d1c29a", P.land],
  ["map",  "国境 赭灰 @85%（合成后）", "#b2a479", P.land],
  /* ── 大面积填色：WCAG 无要求，只记数值 ── */
  ["fill", "浅石绿 山脚",         P.lvLight, P.juan],
  ["fill", "石绿 山腰",           P.shiLv,  P.juan],
  ["fill", "石青 山脊",           P.shiQing, P.juan],
  ["fill", "陆地绢黄",           P.land,   P.juan],
  /* ── 禁用态：豁免 ── */
  ["off",  "禁用筛选 文字",       P.chipDisTxt, P.chipDis],
];

const NEED = { text: 4.5, gfx: 3.0, map: 1.15, fill: 0, off: 0 };
const LABEL = {
  text: "正文（≥4.5:1）",
  gfx: "图形（≥3:1）",
  map: "地图边界（非组件边界，只要看得见 ≥1.15:1）",
  fill: "大面积填色（无要求）",
  off: "禁用态（豁免）",
};

let fails = 0;
console.log("《千里江山图》采用值 · WCAG 2.1 回归检查\n");
["text", "gfx", "map", "fill", "off"].forEach(function (kind) {
  console.log("── " + LABEL[kind] + " ──");
  CASES.filter(function (c) { return c[0] === kind; }).forEach(function (c) {
    const r = C.ratio(c[2], c[3]);
    const need = NEED[kind];
    const ok = need === 0 || r >= need;
    if (!ok) fails++;
    console.log("  " + (ok ? "✔" : "✘") + " " + c[1].padEnd(30) +
      c[2].padEnd(9) + " on " + c[3].padEnd(9) + "  " + r.toFixed(2).padStart(5) + ":1" +
      (need ? "   需 ≥" + need : ""));
  });
  console.log("");
});
console.log(fails ? "✘ " + fails + " 处低于所需" : "✔ 全部达到各自所需");
process.exit(fails ? 1 : 0);
