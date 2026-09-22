/* 地标四态的实际取值（方案 P0-C：默认 / 悬停 / 选中 / 非匹配）
   ----------------------------------------------------------
   ⚠️ 悬停态**不能**用 dispatchEvent(new MouseEvent("mouseover")) 量：
   合成事件不会让浏览器进入 CSS 的 :hover 状态，量到的其实是默认态
   （踩过一次：探针报「hover = 默认绿」，差点当成 CSS 没生效）。
   所以悬停这一档从 CSSOM 里读规则本身，其余三档量真实渲染值。
   用法：node tools/cdp.js <url> --eval "@tools/probes/_markerstates.js" */
(function () {
  var out = {};

  /* ---- 从样式表里读 :hover 与 .on 的声明（不分媒体查询，只看主表） ---- */
  function findRules(sel) {
    var hits = [];
    for (var i = 0; i < document.styleSheets.length; i++) {
      var rules;
      try { rules = document.styleSheets[i].cssRules; } catch (e) { continue; }
      for (var j = 0; j < rules.length; j++) {
        var r = rules[j];
        if (!r.selectorText) continue;
        if (r.selectorText.split(",").some(function (s) { return s.trim() === sel; })) {
          hits.push({
            selector: r.selectorText,
            background: r.style.background || r.style.backgroundImage || "",
            boxShadow: r.style.boxShadow || "",
          });
        }
      }
    }
    return hits;
  }
  out.hoverRule = findRules(".dot-wrap:hover .dot");
  out.onRule = findRules(".dot-wrap.on .dot");

  /* ---- 真实渲染：默认态 / 选中态 / 非匹配（去糊）态 ----
     ⚠️ .recede 是打在 **.dot-wrap** 上的，不是 .dot 上——
     写成 `.dot:not(.recede)` 会永远匹配，量到的「默认态」其实可能是
     一颗去糊的珠子（踩过一次）。 */
  var dot = document.querySelector(".dot-wrap:not(.on):not(.recede) .dot") ||
            document.querySelector(".dot-wrap:not(.on) .dot");
  if (dot) {
    var cs = getComputedStyle(dot);
    out.defaultDot = {
      dotVar: cs.getPropertyValue("--dot").trim(),
      size: cs.width,
      background: cs.backgroundImage.slice(0, 90),
      boxShadow: cs.boxShadow,
      opacity: cs.opacity,
      transform: cs.transform,
    };
  }
  var rec = document.querySelector(".dot-wrap.recede .dot");
  out.recedeDot = rec ? { opacity: getComputedStyle(rec).opacity, transform: getComputedStyle(rec).transform } : null;

  var on = document.querySelector(".dot-wrap.on .dot");
  out.activeDot = on ? { boxShadow: getComputedStyle(on).boxShadow, transform: getComputedStyle(on).transform } : null;
  var glow = document.querySelector(".dot-wrap.on .dot-glow");
  out.activeGlow = glow ? getComputedStyle(glow).backgroundImage.slice(0, 90) : null;

  out.zoomClass = document.body.className.split(" ").filter(function (c) {
    return c.indexOf("zoom-") === 0;
  }).join(" ");
  return out;
})()
