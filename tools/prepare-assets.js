/**
 * 素材整理（工具，非站点运行时依赖）
 * ----------------------------------------------------------
 * 从 tmp/1-素材、tmp/2-素材 中挑选可用素材，改成 ASCII 文件名放入
 * assets/，并对「青绿中国地图」做自动裁切：
 *   1. 取 alpha 通道的前景掩膜
 *   2. 洪水填充分离出最大连通块（即中国版图本体）
 *   3. 按该连通块的外接矩形裁切，去掉画面里的游离山石与空白边
 *
 * 用法：node tools/prepare-assets.js
 */
const fs = require("fs");
const path = require("path");
const png = require("./pnglib.js");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "assets");

/* 选用的素材：源文件 → 目标文件名 */
const PICKS = [
  ["1-素材/亭.png", "marker-pavilion.png"],
  ["1-素材/亭塔-朱红檐.png", "marker-pagoda.png"],
  ["2-素材/亭台-重檐小亭.png", "marker-pavilion2.png"],
  ["1-素材/塔.png", "marker-tower.png"],
  ["2-素材/宝塔-红檐多层.png", "pagoda-tall.png"],
  ["2-素材/牌楼-多层楼阁.png", "archway.png"],
  ["1-素材/定位标-红色大头针.png", "pin.png"],
  ["1-素材/罗盘-红白指针.png", "compass.png"],
  ["1-素材/光晕-金色同心波纹.png", "glow-ring.png"],
  ["1-素材/光环-金色椭圆.png", "glow-oval.png"],
  ["1-素材/星光-四角闪耀.png", "sparkle.png"],
  ["1-素材/光柱-金色水滴.png", "glow-drop.png"],
  ["1-素材/松树丛.png", "pines.png"],
  ["1-素材/迎客松配红枫.png", "pine-maple.png"],
  ["1-素材/仙鹤-独鹤.png", "crane.png"],
  ["2-素材/仙鹤-展翅.png", "crane2.png"],
  ["1-素材/祥云-金色.png", "cloud-gold.png"],
  ["2-素材/祥云-金色长条.png", "cloud-bar.png"],
  ["2-素材/云雾-浅白横带.png", "mist-band.png"],
  ["2-素材/云雾-平铺云带.png", "mist-tile.png"],
  ["1-素材/青蓝云彩.png", "cloud-blue.png"],
  ["1-素材/山水-青绿群山.png", "mountains.png"],
  ["2-素材/山水-雾中群山.png", "mountains-mist.png"],
  ["2-素材/山水-峻岭瀑布.png", "mountains-fall.png"],
  ["1-素材/山海-青绿仙山.png", "isle.png"],
  ["1-素材/海浪-青色波涛.png", "waves.png"],
  ["1-素材/湖海-青蓝波浪.png", "lake-waves.png"],
  ["1-素材/河流-回旋水纹.png", "river-swirl.png"],
  ["1-素材/卷轴-空白横幅.png", "scroll.png"],
  ["2-素材/对话框-金色描边.png", "dialog.png"],
  ["1-素材/圆形印章-朱红实心.png", "seal-round.png"],
  ["2-素材/圆形印章-朱红浮雕.png", "seal-emboss.png"],
  ["2-素材/圆形底纹-浅金.png", "disc-gold.png"],
  ["1-素材/朝阳.png", "sun.png"],
];

/* 地图底图候选（按优先级） */
const MAP_CANDIDATES = ["1-素材/青绿中国地图.png", "2-素材/青绿中国地图.png"];

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }

/* 最大连通块（4 邻域）的外接矩形 */
function mainBBox(rgba, w, h, alphaMin) {
  const seen = new Uint8Array(w * h);
  const stack = [];
  let best = null;
  for (let start = 0; start < w * h; start++) {
    if (seen[start] || rgba[start * 4 + 3] < alphaMin) continue;
    let area = 0, x0 = w, y0 = h, x1 = -1, y1 = -1;
    stack.length = 0;
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop();
      const x = i % w, y = (i - x) / w;
      area++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      if (x > 0 && !seen[i - 1] && rgba[(i - 1) * 4 + 3] >= alphaMin) { seen[i - 1] = 1; stack.push(i - 1); }
      if (x < w - 1 && !seen[i + 1] && rgba[(i + 1) * 4 + 3] >= alphaMin) { seen[i + 1] = 1; stack.push(i + 1); }
      if (y > 0 && !seen[i - w] && rgba[(i - w) * 4 + 3] >= alphaMin) { seen[i - w] = 1; stack.push(i - w); }
      if (y < h - 1 && !seen[i + w] && rgba[(i + w) * 4 + 3] >= alphaMin) { seen[i + w] = 1; stack.push(i + w); }
    }
    if (!best || area > best.area) best = { area: area, x0: x0, y0: y0, x1: x1, y1: y1 };
  }
  return best;
}

function main() {
  ensureDir(OUT);

  let copied = 0;
  const missing = [];
  for (const pair of PICKS) {
    const from = path.join(ROOT, "tmp", pair[0]);
    if (!fs.existsSync(from)) { missing.push(pair[0]); continue; }
    fs.copyFileSync(from, path.join(OUT, pair[1]));
    copied++;
  }
  console.log("已复制素材: " + copied + " 个 -> assets/");
  if (missing.length) console.log("缺失（跳过）: " + missing.join("、"));

  for (const cand of MAP_CANDIDATES) {
    const from = path.join(ROOT, "tmp", cand);
    if (!fs.existsSync(from)) continue;
    const img = png.decode(from);
    const box = mainBBox(img.rgba, img.width, img.height, 24);
    if (!box) { console.log("地图未找到前景: " + cand); continue; }
    const pad = 3;
    const x0 = Math.max(0, box.x0 - pad);
    const y0 = Math.max(0, box.y0 - pad);
    const w = Math.min(img.width - x0, box.x1 - box.x0 + 1 + pad * 2);
    const h = Math.min(img.height - y0, box.y1 - box.y0 + 1 + pad * 2);
    const cropped = png.crop(img.rgba, img.width, img.height, x0, y0, w, h);
    png.write(path.join(OUT, "map-painting.png"), w, h, cropped, 9);
    console.log(
      cand + " 原图 " + img.width + "x" + img.height +
      " -> 主体外接框 " + box.x0 + "," + box.y0 + " " + (box.x1 - box.x0 + 1) + "x" + (box.y1 - box.y0 + 1) +
      " -> assets/map-painting.png " + w + "x" + h
    );
    break;
  }
}

main();
