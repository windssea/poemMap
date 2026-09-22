/* 像素级文字判读（工具，配合 tools/probes/_textrects.js）
   ----------------------------------------------------------
   用法：
     node tools/cdp.js <url> --eval "@tools/probes/_textrects.js" > rects.json
     node tools/text-contrast.js <png> rects.json [scale]

   量三件事，比"对比度"这个词本身更说明问题：

     minLum   框内最暗像素的亮度。**这是判"发灰"的关键**：
              拿它和声明色的亮度比 —— 够得到（或接近）说明笔画压得住色；
              差一大截说明笔画根本没到达那个颜色。
     ink%     落在声明色 ±25 之内的像素占比。小字天然很低（笔画细），
              但**为 0 就是另一回事**：那说明整块字里没有一个像素是本色。
     ratio    声明色与该区域其余像素中位色的对比度 —— 这是**设计意图**
              上的对比度，用于核对令牌，不是"实际观感"。

   ⚠️ 有污染（pollutants 非空）的框只打印数值，**不给结论**。
   地标珠子自带比文字更暗的内收边，混进取样框后会伪装成"字的笔画"，
   报出一个很像真的但完全错误的低对比度。这种情况必须换一块干净的字去量。
   ============================================================ */
const { decode } = require("./pnglib");
const fs = require("fs");

const lum = (r, g, b) => {
  const f = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => {
  const la = lum(a[0], a[1], a[2]), lb = lum(b[0], b[1], b[2]);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};
const median = (arr) => [0, 1, 2].map((i) => {
  const v = arr.map((p) => p[i]).sort((x, y) => x - y);
  return v[Math.floor(v.length / 2)];
});

const [png, json, scaleArg] = process.argv.slice(2);
const S = Number(scaleArg || 1);          // 截图的设备像素比：矩形是 CSS px，要乘上去
const img = decode(png);
const rects = JSON.parse(fs.readFileSync(json, "utf8"));

console.log("像素级文字判读  (" + png + ", dpr " + S + ")\n");
console.log("  角色            字号/字重   声明色            最暗像素          亮度(声明/实测)   全墨%   设计对比度");
console.log("  " + "-".repeat(104));

rects.forEach((it) => {
  const [x0, y0, w, h] = it.rect.map((v) => Math.round(v * S));
  const px = [];
  for (let y = Math.max(0, y0); y < Math.min(img.height, y0 + h); y++) {
    for (let x = Math.max(0, x0); x < Math.min(img.width, x0 + w); x++) {
      const o = (y * img.width + x) * 4;
      px.push([img.rgba[o], img.rgba[o + 1], img.rgba[o + 2]]);
    }
  }
  if (px.length < 20) { console.log("  ? " + it.what + "  取样太少"); return; }
  const target = it.color.match(/\d+/g).map(Number);
  const sorted = px.slice().sort((a, b) => lum(a[0], a[1], a[2]) - lum(b[0], b[1], b[2]));
  const min = sorted[0];
  const near = px.filter((p) =>
    Math.abs(p[0] - target[0]) < 25 && Math.abs(p[1] - target[1]) < 25 && Math.abs(p[2] - target[2]) < 25
  ).length;
  const bg = median(sorted.slice(Math.max(1, Math.floor(sorted.length * 0.5))));
  const dirty = (it.pollutants || []).length;

  const pad = (s, n) => String(s).padEnd(n);
  console.log("  " + (dirty ? "⚠" : " ") + " " + pad(it.what, 15) +
    pad(it.fontSize + "/" + it.fontWeight, 11) +
    pad(it.color, 18) +
    pad("[" + min.join(",") + "]", 18) +
    pad(lum(target[0], target[1], target[2]).toFixed(0) + " / " + lum(min[0], min[1], min[2]).toFixed(0), 17) +
    pad((100 * near / px.length).toFixed(1) + "%", 8) +
    ratio(target, bg).toFixed(2) + ":1");
  if (dirty) {
    console.log("      ⚠ 取样框内还有 " + it.pollutants.join("、") +
      " —— 这些图元自带更暗的像素，本行**不作数**，要换一块干净的字再量");
  }
});
console.log("\n判读要点：最暗亮度接近声明色 → 笔画压得住色；差一大截 → 该处本来就在发灰。");
console.log("全墨% 为 0 且框干净 → 整块字没有任何一个像素达到本色。");
