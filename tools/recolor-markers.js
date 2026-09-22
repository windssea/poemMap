/* ============================================================
   地标：玉石感（方案第五节的 Marker 色彩规范）
   ----------------------------------------------------------
   结构不变（圆点 + 外环），只换色并收敛外圈：

     默认内芯 #507e6e（中石绿）· 外环 #faf7ed 2px
     悬停内芯 #376b76（石青）· 光晕 石青 17%
     选中内芯 #a94f3c（朱砂）· 光晕 朱砂 18%
     地点标签 #293f3b（墨青）

   方案里「不要通过大量增大 marker 来强化古风」——所以外圈继续收着，
   只在悬停/选中时放大。新增的一点是**内芯顶部的高光**：
   径向渐变的第一档比内芯亮一档，珠子才像石头而不是色块。

   用法：node tools/recolor-markers.js [--dry]
   ============================================================ */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const FILE = "src/styles/style.css";
const DRY = process.argv.includes("--dry");

let src = fs.readFileSync(path.join(ROOT, FILE), "utf8");
const before = src;
const log = [];

function rep(from, to, label) {
  const variants = [from, from.replace(/\n/g, "\r\n")];
  const hit = variants.find(function (v) { return src.indexOf(v) !== -1; });
  if (!hit) { log.push(["⚠ 没匹配到", label]); return; }
  src = src.split(hit).join(hit === from ? to : to.replace(/\n/g, "\r\n"));
  log.push(["改", label]);
}

/* 默认珠：中石绿内芯 + 顶部高光，外环收到 2px */
rep(
`  background: radial-gradient(circle at 34% 28%,
    #a8c6b3 0%, #568c78 44%, #376b60 74%, #2f5a51 100%);
  /* 外圈减薄：原来是 2.5px 纸白 + 3.5px 环 + 投影，视觉直径接近 19px，
     密处一叠就显得「厚重」。收到 2px + 2.6px，珠子本身仍是 12px。 */
  box-shadow:
    inset 0 0 0 .5px rgba(38, 54, 46, .5),
    0 0 0 2px rgba(255, 252, 245, .92),
    0 0 0 2.6px var(--dot-ring),
    0 1px 2px rgba(41, 63, 59, .3);`,
`  /* 玉石感：内芯是中石绿，顶部再亮一档当高光，底部压深一档收边。
     方案给的内芯 #507e6e，高光与收边在它两侧各让开一档。 */
  background: radial-gradient(circle at 34% 28%,
    #7fa896 0%, #507e6e 46%, #3f6a5c 78%, #345a4e 100%);
  /* 外环用暖绢白、收到 2px —— 方案要求「收敛白色外圈和阴影」，
     密处（江南）才不会糊成一片白点。 */
  box-shadow:
    inset 0 0 0 .5px rgba(38, 62, 54, .45),
    0 0 0 2px rgba(250, 247, 237, .94),
    0 0 0 2.6px var(--dot-ring),
    0 1px 2px rgba(41, 63, 59, .28);`,
  "默认珠 → 中石绿玉石感",
);

/* 悬停：换成石青 + 石青光晕 */
rep(
`.dot-wrap:hover .dot {
  transform: scale(1.28);
  box-shadow:
    inset 0 0 0 .5px rgba(38, 54, 46, .55),
    0 0 0 3px rgba(255, 252, 245, .96),
    0 0 0 4.5px var(--dot-ring),
    0 2px 7px rgba(41, 63, 59, .42);
}`,
`/* 悬停：内芯换石青、加一圈 17% 石青光晕（方案的值）。
   这是**唯一**用到石青的交互态，与选中的朱砂分得清清楚楚。 */
.dot-wrap:hover .dot {
  background: radial-gradient(circle at 34% 28%,
    #5f97a2 0%, #376b76 46%, #2c5a63 78%, #24505a 100%);
  transform: scale(1.28);
  box-shadow:
    inset 0 0 0 .5px rgba(31, 66, 74, .5),
    0 0 0 3px rgba(250, 247, 237, .96),
    0 0 0 4.5px rgba(55, 107, 118, .17),
    0 2px 7px rgba(41, 63, 59, .38);
}`,
  "悬停 → 石青 + 17% 光晕",
);

/* 选中：朱砂 + 18% 光晕（原来 .3，按方案收到 .18） */
rep(
`.dot-wrap.on .dot {
  background: radial-gradient(circle at 34% 28%,
    #e0b8a8 0%, #a94f3c 44%, #8f4030 72%, #8f4030 100%);
  transform: scale(1.16);
  box-shadow:
    inset 0 0 0 .5px rgba(143, 64, 48, .5),
    0 0 0 3px rgba(255, 252, 242, .95),
    0 0 0 4.5px rgba(169, 79, 60, .3),
    0 2px 7px rgba(143, 64, 48, .4);
}`,
`.dot-wrap.on .dot {
  background: radial-gradient(circle at 34% 28%,
    #dda393 0%, #a94f3c 44%, #8f4030 72%, #8f4030 100%);
  transform: scale(1.16);
  box-shadow:
    inset 0 0 0 .5px rgba(143, 64, 48, .5),
    0 0 0 3px rgba(250, 247, 237, .95),
    0 0 0 4.5px rgba(169, 79, 60, .18),
    0 2px 7px rgba(143, 64, 48, .4);
}`,
  "选中 → 朱砂 + 18% 光晕",
);

/* 远视野下的珠子：外环同步换成暖绢白 */
rep(
`body.zoom-far .dot {
  box-shadow:
    inset 0 0 0 .5px rgba(38, 54, 46, .5),
    0 0 0 3px rgba(255, 252, 245, .95),`,
`body.zoom-far .dot {
  box-shadow:
    inset 0 0 0 .5px rgba(38, 62, 54, .45),
    0 0 0 3px rgba(250, 247, 237, .95),`,
  "远视野外环 → 暖绢白",
);

if (src !== before && !DRY) fs.writeFileSync(path.join(ROOT, FILE), src, "utf8");
console.log((DRY ? "（--dry，未写入）\n" : "") + "地标设色：");
log.forEach(function (l) { console.log("  " + l[0] + "  " + l[1]); });
