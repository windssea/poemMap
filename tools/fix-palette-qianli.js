/* 算出「保持色相饱和度、只压暗到刚好达标」的替换值 */
const C = require("./contrast-lib.js");

const TARGETS = [
  // [名称, 原值, 背景, 阈值, 用途]
  ["辅助文字 / 副标题", "#748078", "#F3EFDF", 4.5, "绢本上的小字"],
  ["辅助文字（暖绢白上）", "#748078", "#FAF7ED", 4.5, "面板里的小字"],
  ["竖排题词", "#7A7768", "#F3EFDF", 4.5, "品牌右侧竖排"],
  ["石绿 当文字用", "#568C78", "#F3EFDF", 4.5, "主题色文字"],
  ["石绿 当文字（陆地）", "#568C78", "#EADCB5", 4.5, "二级地名压在陆地上"],
  ["石青 当文字（陆地）", "#376B76", "#EADCB5", 4.5, "二级地名压在陆地上"],
  ["赭金（勾边/分割线）", "#B39460", "#F3EFDF", 3.0, "图形，3:1 即可"],
  ["青碧（河流）", "#6398AC", "#F3EFDF", 3.0, "线状图形"],
  ["青碧 压在陆地绢黄上", "#6398AC", "#EADCB5", 3.0, "河流实际在陆地上"],
  ["赭金 压在陆地绢黄上", "#B39460", "#EADCB5", 3.0, "山纹勾边在陆地上"],
  ["禁用文字", "#9A9B91", "#E9E8DF", 3.0, "WCAG 对禁用态豁免，但提一档更好"],
];

console.log("原值 → 压暗后（色相饱和度不变）\n");
TARGETS.forEach(function (t) {
  const [name, fg, bg, target, why] = t;
  const now = C.ratio(fg, bg);
  const fix = C.darkenTo(fg, bg, target);
  const after = C.ratio(fix, bg);
  const hsl = C.rgbToHsl(C.hexToRgb(fg));
  const hsl2 = C.rgbToHsl(C.hexToRgb(fix));
  console.log("  " + name);
  console.log("     " + fg + " → " + fix + "    " + now.toFixed(2) + ":1 → " + after.toFixed(2) + ":1" +
    "   明度 " + (hsl[2] * 100).toFixed(0) + "% → " + (hsl2[2] * 100).toFixed(0) + "%");
  console.log("     " + why);
});

/* 反白场景 */
console.log("\n反白（实底 + 白字）：\n");
[["石绿实底", "#568C78", "#FFFFFF", 4.5], ["朱砂实底", "#A94F3C", "#FFFFFF", 4.5]].forEach(function (t) {
  const [name, bg, fg, target] = t;
  const now = C.ratio(fg, bg);
  if (now >= target) { console.log("  ✔ " + name + "  " + now.toFixed(2) + ":1  达标，无需改"); return; }
  const fix = C.darkenTo(bg, "#FFFFFF", target);
  console.log("  " + name + " 底色 " + bg + " → " + fix + "   " + now.toFixed(2) + ":1 → " + C.ratio(fix, "#FFFFFF").toFixed(2) + ":1");
});

/* 地图山体：这三档是大面积填色，不受 WCAG 约束，
   但要检查它们**互相之间**是否分得开（层次能不能看出来） */
console.log("\n山体三档之间的可分辨度（面积填色，无 WCAG 要求，只看是否分得开）：\n");
const TONES = [["山脊 石青", "#376B76"], ["山腰 石绿", "#568C78"], ["山脚 浅石绿", "#94B5A0"]];
for (let i = 0; i < TONES.length; i++) {
  for (let j = i + 1; j < TONES.length; j++) {
    const r = C.ratio(TONES[i][1], TONES[j][1]);
    console.log("  " + TONES[i][0] + " vs " + TONES[j][0] + "  " + r.toFixed(2) + ":1  " +
      (r >= 1.25 ? "分得开 ✔" : "偏近，层次可能糊"));
  }
}
