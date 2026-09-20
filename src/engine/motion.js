import gsap from "gsap";
/* ============================================================
   动效层（GSAP）
   ----------------------------------------------------------
   统一管理开场序列、地标入场、篇目与诗卡的动效。
   三条安全约定：
     1. 初始隐藏态写在 CSS（html.motion-prep），JS 只负责「动到明处」；
     2. 任何异常、关闭动效、或 3 秒超时，都会立刻移除 motion-prep；
     3. 全部动画使用明确的终值，结束时清掉内联样式，避免与 :hover 打架。
   ============================================================ */
export const MOTION = (function () {
  "use strict";

  var root = document.documentElement;
  var api = { on: false, hasGsap: false };
  var guard = 0;
  var introTl = null;

  function g() { return gsap; }

  function killVeil() {
    var v = document.getElementById("veil");
    if (v && v.parentNode) v.parentNode.removeChild(v);
  }

  /* 开场动过的这些元素，收尾时要把 GSAP 写上去的内联样式清掉。
     ------------------------------------------------------------
     不清的后果不是「留着也无所谓」，而是**内联样式压过样式表**：
     #bottomBar 被写上 opacity:1 之后，body.panel-open #bottomBar{opacity:0}
     再也盖不过它，索引面板滑出时底栏就赖着不走；
     .search 上的 transform 同理，会把 :hover 的效果一并吃掉。 */
  var INTRO_SEL = ".seal-big, .b-text h1, .b-text p, .couplet, .search, .chipbar, " +
    "#bottomBar, #sideVerse, #compass, #zoomer, #paint";
  function clearIntroProps() {
    try { g().set(INTRO_SEL, { clearProps: "opacity,transform,filter" }); } catch (e) {}
  }

  /* ⚠️ 清内联样式必须挂在 clearPrep 里，不能只挂在时间线的 onComplete 上。
     3.2 秒的兜底超时是直接调 clearPrep 的——如果那一刻时间线还没跑完
     （弱机、或以后又往开场里加了东西），走 onComplete 的那条路根本不会执行，
     元素就永久卡在动画中间的那个透明度上（比如底栏停在 0.05）。
     所以这里先把时间线掐掉、再清样式，让「兜底」真的兜得住。 */
  function clearPrep() {
    root.classList.remove("motion-prep");
    root.classList.add("motion-done");
    if (guard) { clearTimeout(guard); guard = 0; }
    if (introTl) { try { introTl.kill(); } catch (e) {} introTl = null; }
    clearIntroProps();
    killVeil();
  }

  function reduced() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  /* ---------------- 初始化 ---------------- */
  api.init = function () {
    api.hasGsap = typeof gsap !== "undefined";
    api.on = root.classList.contains("motion-on") && api.hasGsap && !reduced();
    if (!api.on) { clearPrep(); return api; }
    guard = setTimeout(clearPrep, 3200);
    return api;
  };

  /* ---------------- 开场 ---------------- */
  api.intro = function (ctx) {
    ctx = ctx || {};
    if (!api.on) { clearPrep(); return; }
    var tl;
    try {
      tl = g().timeline({
        defaults: { ease: "power3.out" },
        onComplete: function () { introTl = null; clearPrep(); },
        onInterrupt: function () { introTl = null; clearPrep(); },
      });
      introTl = tl;

      // 题名：朱印落定 → 题名浮出 → 小联
      tl.fromTo(".seal-big", { opacity: 0, scale: 1.7, rotation: 12 },
                  { opacity: 1, scale: 1, rotation: 0, duration: 0.66, ease: "back.out(1.7)" }, 0.1)
        .fromTo(".b-text h1", { opacity: 0, y: 12, filter: "blur(6px)" },
                  { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.72 }, 0.12)
        .fromTo(".b-text p", { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.5 }, 0.4)
        .fromTo(".couplet", { opacity: 0, x: -8 }, { opacity: 1, x: 0, duration: 0.6 }, 0.46);

      // 右上：搜索 → 筛选条
      tl.fromTo(".search", { opacity: 0, y: -8, scale: 0.96 },
                  { opacity: 1, y: 0, scale: 1, duration: 0.5 }, 0.4)
        .fromTo(".chipbar", { opacity: 0, y: -8 },
                  { opacity: 1, y: 0, duration: 0.5 }, 0.5);

      // 左侧篇目栏：默认收起（收在左下 dock 的「篇目」按钮里），开场不揭示；
      // 展开时的篇目行依次浮现由 side-in 处理（见篇目栏开关）。

      // 左下统计胶囊（含「篇目」开关）
      tl.fromTo("#bottomBar", { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.6 }, 0.7);

      // 右缘题词 · 罗盘 · 缩放
      tl.fromTo("#sideVerse", { opacity: 0, x: 10 }, { opacity: 1, x: 0, duration: 0.6 }, 0.66)
        .fromTo("#compass", { opacity: 0, x: 10 }, { opacity: 1, x: 0, duration: 0.5 }, 0.76)
        .fromTo("#zoomer", { opacity: 0, x: 10 }, { opacity: 1, x: 0, duration: 0.5 }, 0.82);

      // 长卷点景：远山与仙鹤
      tl.fromTo("#paint", { opacity: 0 }, { opacity: 1, duration: 0.9 }, 0.2);

      // 地标：自西向东依次点出
      if (ctx.markers && ctx.markers.length) {
        /* 步长按地标数反算，让这一段的总时长稳定在 **0.9 秒**左右。
           写死 each: 0.011 时，收 80 个地标是 0.88 秒、收 141 个就变成 1.55 秒，
           开场会跟着数据量一起变长（超过 3.2 秒的兜底超时还会被硬切）。
           上限仍取 0.011：地标少的时候保持原来那点从容，多的时候自动加密。 */
        const each = Math.max(0.0022, Math.min(0.011, 0.9 / ctx.markers.length));
        tl.add(api.markersIn(ctx.markers, { each: each, duration: 0.5 }), 0.6);
      }
    } catch (err) {
      clearPrep();
    }
  };

  /* ---------------- 数字滚动 ---------------- */
  api.countTo = function (el, to, dur) {
    if (!el) return;
    var target = Number(to) || 0;
    if (!api.on || !dur) { el.textContent = String(target); return; }
    var o = { v: 0 };
    g().to(o, {
      v: target, duration: dur, ease: "power2.out",
      onUpdate: function () { el.textContent = String(Math.round(o.v)); },
      onComplete: function () { el.textContent = String(target); },
    });
  };

  /* ---------------- 地标入场 ---------------- */
  api.markersIn = function (els, opts) {
    opts = opts || {};
    if (!api.on || !els || !els.length) return null;
    var list = Array.prototype.slice.call(els);
    if (!list.length) return null;
    g().killTweensOf(list);
    return g().fromTo(list,
      { opacity: 0, scale: 0.35 },
      {
        opacity: 1, scale: 1,
        duration: opts.duration === undefined ? 0.5 : opts.duration,
        ease: "back.out(1.7)",
        delay: opts.delay || 0,
        stagger: { each: opts.each === undefined ? 0.014 : opts.each, from: "start" },
        clearProps: "opacity,transform",
      });
  };

  /* ---------------- 篇目列表 ---------------- */
  api.listIn = function (rootEl) {
    if (!api.on || !rootEl) return;
    var items = rootEl.querySelectorAll(".item");
    if (!items.length) return;
    var head = Array.prototype.slice.call(items, 0, 30);
    g().killTweensOf(head);
    g().fromTo(head,
      { x: -14, opacity: 0 },
      {
        x: 0, opacity: 1, duration: 0.36, ease: "power2.out",
        stagger: 0.02, clearProps: "opacity,transform",
      });
  };

  /* ---------------- 篇目栏展开：面板由 CSS 滑入，行依次浮现 ---------------- */
  api.sideIn = function () {
    if (!api.on) return;
    var side = document.querySelector("#sidebar");
    if (!side) return;
    var items = side.querySelectorAll(".item");
    if (!items.length) return;
    var head = Array.prototype.slice.call(items, 0, 30);
    g().killTweensOf(head);
    g().fromTo(head,
      { x: -14, opacity: 0 },
      {
        x: 0, opacity: 1, duration: 0.38, ease: "power2.out",
        delay: 0.06, stagger: 0.02, clearProps: "opacity,transform",
      });
  };

  /* ---------------- 诗卡内容 ---------------- */
  api.cardIn = function (card) {
    if (!api.on || !card) return;
    var lines = card.querySelectorAll(".c-poem .col, .d-poem .line");
    var blocks = card.querySelectorAll(".c-seal, .c-head, .c-others, .c-place, .c-tags, .c-rule, .c-sec, .c-link, .d-head, .d-sub, .d-prologue, .d-where, .d-tags, .sec, .btn-solid");
    var all = Array.prototype.slice.call(lines).concat(Array.prototype.slice.call(blocks));
    if (!all.length) return;
    g().killTweensOf(all);
    var tl = g().timeline();
    if (lines.length) {
      tl.fromTo(lines,
        { y: -16, opacity: 0, rotate: function (i) { return i % 2 ? 2 : -2; } },
        { y: 0, opacity: 1, rotate: 0, duration: 0.5, ease: "back.out(1.5)", stagger: 0.05,
          clearProps: "opacity,transform" }, 0);
    }
    if (blocks.length) {
      tl.fromTo(blocks,
        { y: 12, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.44, ease: "power3.out", stagger: 0.04,
          clearProps: "opacity,transform" }, lines.length ? 0.1 : 0);
    }
  };

  /* ---------------- 选中涟漪 ---------------- */
  api.pulse = function (host) {
    if (!api.on || !host) return;
    var ring = document.createElement("span");
    ring.className = "mk-ripple";
    host.appendChild(ring);
    g().fromTo(ring,
      { scale: 0.3, opacity: 0.9 },
      { scale: 2.6, opacity: 0, duration: 0.9, ease: "power2.out", onComplete: function () { ring.remove(); } });
  };

  /* ---------------- 地图飞行 ---------------- */
  api.fly = function (m, latlng, zoom) {
    if (!m) return;
    if (!api.on) { m.setView(latlng, zoom, { animate: false }); return; }
    m.flyTo(latlng, zoom, { duration: 1.15, easeLinearity: 0.26 });
  };

  /* ---------------- 开关 ---------------- */
  api.setEnabled = function (on) {
    on = !!on;
    try { localStorage.setItem("poemmap:motion", on ? "1" : "0"); } catch (e) {}
    root.classList.toggle("motion-on", on);
    api.on = on && api.hasGsap && !reduced();
    if (!api.on) {
      try {
        g().globalTimeline.getChildren(true, true, true).forEach(function (t) { t.kill(); });
        g().set(".seal-big, .b-text h1, .b-text p, .couplet, .search, .chipbar, #sidebar, #sidebar .item, #bottomBar, #sideVerse, #compass, #zoomer, #paint, .mk-anim, .dot-name, .item, .c-poem .col, .d-poem .line",
          { clearProps: "opacity,transform,filter" });
      } catch (e) {}
      clearPrep();
    }
    return api;
  };
  api.status = function () {
    return { on: api.on, hasGsap: api.hasGsap, prep: root.classList.contains("motion-prep") };
  };

  return api;
})();

export default MOTION;
