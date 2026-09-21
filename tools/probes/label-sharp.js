/* 地标文字为什么发虚
   ----------------------------------------------------------
   两个常见来源，分别量：
     ① 亚像素定位 —— 元素被放在半像素上（translateX(-50%) 遇到奇数宽度、
        或 transform 出现 .5），浏览器会把字重采样一遍
     ② 描边光晕 —— 多层 text-shadow 的模糊半径过大，小字会糊成一团
   顺带量：字体平滑设置、是否被 GPU 合成层缩放。

   用法：node tools/cdp.js <url> --eval "@tools/probes/label-sharp.js" 7000 */
(() => {
  const out = {};
  const dots = [...document.querySelectorAll(".dot-wrap")].slice(0, 6);

  out.labels = dots.map((d) => {
    const name = d.querySelector(".dot-name");
    const host = d.closest(".leaflet-marker-icon");
    if (!name) return null;
    const cs = getComputedStyle(name);
    const r = name.getBoundingClientRect();
    const hr = host ? host.getBoundingClientRect() : null;
    const hs = host ? getComputedStyle(host) : null;
    return {
      text: name.textContent.trim().slice(0, 8),
      /* 宽高是否落在整数上；x/y 是否落在整数上 */
      w: +r.width.toFixed(2), h: +r.height.toFixed(2),
      x: +r.x.toFixed(2), y: +r.y.toFixed(2),
      xFrac: +(r.x % 1).toFixed(2), yFrac: +(r.y % 1).toFixed(2),
      hostTransform: hs ? hs.transform.slice(0, 46) : null,
      nameTransform: cs.transform,
      fontSize: cs.fontSize,
      textShadow: cs.textShadow,
      fontSmoothing: cs.webkitFontSmoothing || cs.getPropertyValue("-webkit-font-smoothing"),
      willChange: cs.willChange,
      backface: cs.backfaceVisibility,
      /* 元素是否处在会被缩放的祖先里 */
      scaledAncestor: (function () {
        let n = name.parentElement, hops = 0;
        while (n && hops < 8) {
          const t = getComputedStyle(n).transform;
          if (t && t !== "none" && !/^matrix\(1, 0, 0, 1,/.test(t)) return n.className.toString().slice(0, 40) + " → " + t.slice(0, 40);
          n = n.parentElement; hops++;
        }
        return null;
      })(),
    };
  }).filter(Boolean);

  /* 整页的字号 / 平滑设置 */
  const body = getComputedStyle(document.body);
  out.page = {
    fontSmoothing: body.webkitFontSmoothing || body.getPropertyValue("-webkit-font-smoothing"),
    textRendering: body.textRendering,
    devicePixelRatio: window.devicePixelRatio,
    bodyClass: document.body.className,
  };

  /* Leaflet 的 marker 定位是不是整数 */
  const hosts = [...document.querySelectorAll(".leaflet-marker-icon")].slice(0, 6);
  out.markerPos = hosts.map((h) => {
    const t = getComputedStyle(h).transform;
    const m = t.match(/matrix\(([^)]+)\)/);
    const nums = m ? m[1].split(",").map((s) => parseFloat(s.trim())) : [];
    return { transform: t.slice(0, 52), tx: nums[4], ty: nums[5], txFrac: nums[4] !== undefined ? +(nums[4] % 1).toFixed(2) : null };
  });

  return JSON.stringify(out, null, 1);
})()
