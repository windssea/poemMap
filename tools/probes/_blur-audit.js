/* 文字「发灰发虚」根因体检（方案 §1.1 的逐项取证）
   ----------------------------------------------------------
   对每一处关键文字，沿祖先链往上查四类可疑因素，并把证据带回来：

     A 祖先链上的 opacity < 1     —— 文字整块被合成后降透明，笔画会变灰
     B 祖先链上的 filter / backdrop-filter
                                  —— 强制自建合成层；**半透明底会关掉
                                     Chrome 的 LCD 次像素抗锯齿**，中文细画
                                     在灰阶 AA 下比不透明底上细一档
     C 残留 transform（含小数）    —— 入场动画没清干净，字被重采样
     D 落点是不是整数像素          —— 半像素定位会让 12px 的字糊一层

   另量：实际平台字体、画布 CSS 尺寸与像素尺寸是否匹配 DPR、
   以及有没有伪元素盖在文字**上面**。

   ⚠️ 量之前先等动画落定。开场的时间线（云气 + 数字从 0 滚到 325）跑完之前，
   `bsTick` 正停在 from 帧上（opacity .35 / translateY(-2px)），
   直接量会把它报成「长期半透明 + 残留位移」——那是**自己骗自己**。
   这里轮询到页面上一帧动画都没有了（或 4s 超时）再取数。
   用法：node tools/cdp.js <url> --eval "@tools/probes/_blur-audit.js" */
(async function () {
  var settle = function () {
    return new Promise(function (done) {
      var t0 = Date.now();
      (function tick() {
        var running = document.getAnimations().filter(function (a) {
          return a.playState === "running";
        });
        if (!running.length || Date.now() - t0 > 4000) return done(running.length);
        requestAnimationFrame(tick);
      })();
    });
  };
  var stillRunning = await settle();

  var TARGETS = [
    [".dot-name", "地图·一级地名"],
    [".dot-count", "地图·数量角标"],
    [".prov-label span", "地图·省名"],
    [".mtn-label span", "地图·山名"],
    ["#dTitle", "详情·诗词标题"],
    [".d-poem .line", "详情·竖排诗句"],
    [".d-sub", "详情·朝代作者"],
    [".pl-item .pl-t", "浮层·诗名"],
    [".pl-item .pl-m", "浮层·作者行"],
    [".pl-head b", "浮层·地点标题"],
    [".bs-counts b", "底栏·统计数字"],
    [".bs-counts i", "底栏·单位"],
    [".b-text h1", "顶栏·品牌名"],
    [".c-poem .col", "诗词卡·竖排"],
  ];

  var out = { env: {}, items: [], canvases: [], overlays: [], stillRunning: stillRunning };

  out.env = {
    ua: navigator.userAgent,
    platform: navigator.platform,
    dpr: window.devicePixelRatio,
    zoom: Math.round((window.outerWidth / window.innerWidth) * 100) / 100,
    innerW: innerWidth, innerH: innerHeight,
    fontSmoothing: getComputedStyle(document.body).webkitFontSmoothing,
    textRendering: getComputedStyle(document.body).textRendering,
  };

  /* 祖先链上四类可疑因素 */
  function chain(el) {
    var op = [], filt = [], bdf = [], tr = [];
    var n = el, guard = 0;
    while (n && n.nodeType === 1 && guard++ < 40) {
      var cs = getComputedStyle(n);
      if (cs.opacity !== "1") op.push(tag(n) + "=" + cs.opacity);
      if (cs.filter && cs.filter !== "none") filt.push(tag(n) + "=" + cs.filter);
      if (cs.backdropFilter && cs.backdropFilter !== "none") bdf.push(tag(n) + "=" + cs.backdropFilter);
      if (cs.transform && cs.transform !== "none") tr.push(tag(n) + "=" + cs.transform.slice(0, 40));
      n = n.parentElement;
    }
    return { opacity: op, filter: filt, backdrop: bdf, transform: tr };
  }
  function tag(el) {
    return el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") +
      (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/)[0] : "");
  }
  /* 沿祖先链把背景色合成到不透明为止，返回最终是否完全不透明 */
  function bgOpaque(el) {
    var a = 0, n = el, guard = 0, layers = [];
    while (n && n.nodeType === 1 && guard++ < 40 && a < 0.999) {
      var cs = getComputedStyle(n);
      var m = String(cs.backgroundColor).match(/rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\)/);
      if (m) {
        var al = m[4] === undefined ? 1 : parseFloat(m[4]);
        if (al > 0.001) { layers.push(tag(n) + ":" + (m[1] === "0" && m[2] === "0" && m[3] === "0" && al === 0 ? "" : al)); a = a + al * (1 - a); }
      }
      if (cs.backgroundImage && cs.backgroundImage !== "none") layers.push(tag(n) + ":img");
      n = n.parentElement;
    }
    return { alpha: Math.round(a * 1000) / 1000, layers: layers };
  }

  TARGETS.forEach(function (t) {
    var el = document.querySelector(t[0]);
    if (!el) { out.items.push({ what: t[1], sel: t[0], missing: true }); return; }
    var cs = getComputedStyle(el);
    var r = el.getBoundingClientRect();
    out.items.push({
      what: t[1],
      sel: t[0],
      text: (el.textContent || "").trim().slice(0, 10),
      color: cs.color,
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      fontFamily: cs.fontFamily.split(",")[0].replace(/"/g, ""),
      letterSpacing: cs.letterSpacing,
      textShadow: cs.textShadow === "none" ? "none" : cs.textShadow.slice(0, 70),
      xFrac: +(r.x % 1).toFixed(2),
      yFrac: +(r.y % 1).toFixed(2),
      wFrac: +(r.width % 1).toFixed(2),
      bg: bgOpaque(el),
      chain: chain(el),
    });
  });

  /* 画布：CSS 尺寸 vs 像素尺寸 */
  document.querySelectorAll("canvas").forEach(function (c) {
    var r = c.getBoundingClientRect();
    out.canvases.push({
      cls: c.className || c.id,
      css: Math.round(r.width) + "x" + Math.round(r.height),
      px: c.width + "x" + c.height,
      matched: Math.abs(c.width - r.width * devicePixelRatio) < 2 && Math.abs(c.height - r.height * devicePixelRatio) < 2,
    });
  });

  /* 伪元素盖在文字上：inset 覆盖整块且有背景 */
  [["#detail", "::before"], ["#mapWash", null], ["#mount", "::before"], ["#atmosphere", null], ["#paint", null]].forEach(function (p) {
    var el = document.querySelector(p[0]);
    if (!el) return;
    var cs = p[1] ? getComputedStyle(el, p[1]) : getComputedStyle(el);
    var bg = cs.backgroundImage && cs.backgroundImage !== "none" ? "url/img" : cs.backgroundColor;
    if (cs.content === "none" && !p[1]) return;
    out.overlays.push({
      what: p[0] + (p[1] || ""),
      position: cs.position,
      zIndex: cs.zIndex,
      pointerEvents: cs.pointerEvents,
      opacity: cs.opacity,
      background: String(bg).slice(0, 40),
    });
  });

  return out;
})()
