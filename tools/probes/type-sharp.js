/* 全站字体清晰度体检
   ----------------------------------------------------------
   「整体字体不清晰」通常不是一个原因，而是几个叠在一起。这里逐项量：
     ① 字体栈实际落到哪个字体（栈里有 macOS 专有名，Windows 会落到别的）
     ② 字号是不是整数 —— 11.5px / 13.5px 这种会让字形按分数比例光栅化
     ③ 字体平滑与 text-rendering 设置
     ④ 有没有半透明层盖在文字上面（纸纹 / 晕染 / 蒙版）
     ⑤ 字重与字距的分布
   用法：node tools/cdp.js <url> --eval "@tools/probes/type-sharp.js" 7000 */
(() => {
  const out = {};

  /* ① 字体栈里的每个名字在这台机器上到底存不存在 */
  const STACKS = {
    serif: ["Songti SC", "STSong", "Noto Serif SC", "Source Han Serif SC", "SimSun"],
    sans: ["PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei", "Hiragino Sans GB", "Noto Sans SC", "system-ui"],
  };
  out.fontsAvailable = {};
  Object.keys(STACKS).forEach(function (k) {
    out.fontsAvailable[k] = STACKS[k].map(function (f) {
      let ok = false;
      try { ok = document.fonts.check('12px "' + f + '"'); } catch (e) { ok = "err"; }
      return f + ": " + ok;
    });
  });

  /* 用 canvas 量同一个字在不同候选字体下的宽度：与实际渲染宽度对上的就是真身 */
  const cv = document.createElement("canvas").getContext("2d");
  const probe = "中华诗词地图永";
  const widths = {};
  ["Songti SC", "STSong", "Noto Serif SC", "SimSun", "serif",
   "PingFang SC", "Microsoft YaHei", "Noto Sans SC", "system-ui", "sans-serif"].forEach(function (f) {
    cv.font = '13px "' + f + '"';
    widths[f] = +cv.measureText(probe).width.toFixed(2);
  });
  out.widthByFont = widths;

  /* ② 字号分布：有多少是分数 */
  const sizes = new Map();
  document.querySelectorAll("body *").forEach(function (el) {
    if (!el.childNodes.length) return;
    const hasText = [...el.childNodes].some(function (n) { return n.nodeType === 3 && n.textContent.trim(); });
    if (!hasText) return;
    const fs = getComputedStyle(el).fontSize;
    sizes.set(fs, (sizes.get(fs) || 0) + 1);
  });
  const sizeList = [...sizes.entries()].sort(function (a, b) { return b[1] - a[1]; });
  out.fontSizes = sizeList.slice(0, 18).map(function (e) { return e[0] + " ×" + e[1]; });
  out.fractionalSizeCount = sizeList.filter(function (e) { return parseFloat(e[0]) % 1 !== 0; })
    .reduce(function (s, e) { return s + e[1]; }, 0);
  out.integerSizeCount = sizeList.filter(function (e) { return parseFloat(e[0]) % 1 === 0; })
    .reduce(function (s, e) { return s + e[1]; }, 0);

  /* ③ 平滑与渲染设置 */
  const b = getComputedStyle(document.body);
  out.bodyType = {
    fontFamily: b.fontFamily.slice(0, 90),
    webkitFontSmoothing: b.webkitFontSmoothing || b.getPropertyValue("-webkit-font-smoothing"),
    mozOsxFontSmoothing: b.getPropertyValue("-moz-osx-font-smoothing"),
    textRendering: b.textRendering,
    fontSize: b.fontSize,
    letterSpacing: b.letterSpacing,
    dpr: window.devicePixelRatio,
    platform: navigator.platform,
    ua: navigator.userAgent.slice(0, 110),
  };

  /* ④ 盖在文字上的层：找出所有 fixed/absolute 且 z-index 较高的元素，
        看它们是否覆盖页面中央的文字、是否带半透明背景 */
  const coverers = [];
  const probeEl = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
  document.querySelectorAll("body > *, body > * > *").forEach(function (el) {
    const cs = getComputedStyle(el);
    if (cs.position !== "fixed" && cs.position !== "absolute") return;
    const z = parseInt(cs.zIndex, 10);
    if (isNaN(z) || z < 600) return;
    const bg = cs.backgroundColor;
    const alpha = (bg.match(/rgba?\([^)]*?([\d.]+)\)$/) || [])[1];
    const semi = alpha !== undefined && parseFloat(alpha) > 0 && parseFloat(alpha) < 1;
    if (semi || cs.backgroundImage !== "none" || cs.mixBlendMode !== "normal") {
      coverers.push({
        sel: el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/)[0] : ""),
        z: z, bg: bg, blend: cs.mixBlendMode, op: cs.opacity,
        img: cs.backgroundImage === "none" ? null : cs.backgroundImage.slice(0, 40),
      });
    }
  });
  out.overlaysAboveContent = coverers.slice(0, 12);
  out.centerElement = probeEl ? probeEl.tagName + (probeEl.id ? "#" + probeEl.id : "") : null;

  /* ⑤ 字重与字距 */
  const weights = new Map(), tracks = new Map();
  document.querySelectorAll("body *").forEach(function (el) {
    if (!el.childNodes.length) return;
    const hasText = [...el.childNodes].some(function (n) { return n.nodeType === 3 && n.textContent.trim(); });
    if (!hasText) return;
    const cs = getComputedStyle(el);
    weights.set(cs.fontWeight, (weights.get(cs.fontWeight) || 0) + 1);
    if (cs.letterSpacing !== "normal") tracks.set(cs.letterSpacing, (tracks.get(cs.letterSpacing) || 0) + 1);
  });
  out.fontWeights = [...weights.entries()].sort(function (a, b) { return b[1] - a[1]; }).map(function (e) { return e[0] + " ×" + e[1]; });
  out.letterSpacings = [...tracks.entries()].sort(function (a, b) { return b[1] - a[1]; }).slice(0, 10).map(function (e) { return e[0] + " ×" + e[1]; });

  return JSON.stringify(out, null, 1);
})()
