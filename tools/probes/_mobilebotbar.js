/* 窄屏「下方篇目按钮组」与「篇目栏展开态」的几何体检
   ----------------------------------------------------------
   量三件事，都要**具体到像素**，不靠眼睛看截图：
     · 底部 dock 自己多宽、里面每一项各占多宽、空档留在哪
     · dock 与缩放钮 / 罗盘 / 篇目栏 / 搜索框有没有重叠
     · 篇目栏展开后，dock、缩放钮、topbar 圆钮各自被盖住多少
   用法：CDP_MOBILE=1 node tools/cdp.js <url> --eval "@tools/probes/_mobilebotbar.js" */
(function () {
  var out = { viewport: innerWidth + "x" + innerHeight, dpr: devicePixelRatio };
  function box(el) {
    if (!el) return null;
    var r = el.getBoundingClientRect();
    var cs = getComputedStyle(el);
    return {
      x: Math.round(r.x), y: Math.round(r.y),
      w: Math.round(r.width), h: Math.round(r.height),
      right: Math.round(r.right), bottom: Math.round(r.bottom),
      display: cs.display, opacity: cs.opacity, z: cs.zIndex,
    };
  }
  function overlap(a, b) {
    if (!a || !b || a.display === "none" || b.display === "none") return 0;
    var w = Math.min(a.right, b.right) - Math.max(a.x, b.x);
    var h = Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y);
    return w > 0 && h > 0 ? Math.round(w * h) : 0;
  }

  var bb = document.querySelector("#bottomBar");
  out.bottomBar = box(bb);

  /* dock 里的每一项：谁在占位、谁被 display:none 摘掉 */
  out.children = [];
  if (bb) {
    [].forEach.call(bb.children, function (c) {
      var cs = getComputedStyle(c);
      var r = c.getBoundingClientRect();
      out.children.push({
        tag: c.tagName.toLowerCase() + (c.id ? "#" + c.id : "") +
             (c.className ? "." + String(c.className).trim().split(/\s+/)[0] : ""),
        text: (c.textContent || "").trim().slice(0, 14),
        display: cs.display, w: Math.round(r.width),
        x: Math.round(r.x), opacity: cs.opacity,
      });
    });
    /* 内容实际占的横向范围 vs 容器的 */
    var kids = [].filter.call(bb.children, function (c) { return getComputedStyle(c).display !== "none"; });
    if (kids.length) {
      var first = kids[0].getBoundingClientRect(), last = kids[kids.length - 1].getBoundingClientRect();
      out.contentSpan = {
        from: Math.round(first.left), to: Math.round(last.right),
        contentW: Math.round(last.right - first.left),
        containerW: Math.round(bb.getBoundingClientRect().width),
        gapLeft: Math.round(first.left - bb.getBoundingClientRect().left),
        gapRight: Math.round(bb.getBoundingClientRect().right - last.right),
      };
    }
    out.justify = getComputedStyle(bb).justifyContent;
    out.padding = getComputedStyle(bb).padding;
  }

  out.zoomer = box(document.querySelector("#zoomer"));
  out.compass = box(document.querySelector("#compass"));
  out.tools = box(document.querySelector("#tools"));
  out.search = box(document.querySelector(".search"));
  out.sidebar = box(document.querySelector("#sidebar"));
  out.roundBtns = [].map.call(document.querySelectorAll(".round-btn"), function (b) {
    var r = b.getBoundingClientRect();
    return { id: b.id, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  });

  out.overlaps = {
    "dock×zoomer": overlap(out.bottomBar, out.zoomer),
    "dock×compass": overlap(out.bottomBar, out.compass),
    "dock×sidebar": overlap(out.bottomBar, out.sidebar),
    "dock×tools": overlap(out.bottomBar, out.tools),
    "zoomer×compass": overlap(out.zoomer, out.compass),
    "sidebar×search": overlap(out.sidebar, out.search),
    "sidebar×tools": overlap(out.sidebar, out.tools),
  };
  out.sideOpen = document.body.classList.contains("side-open");
  out.panelOpen = document.body.classList.contains("panel-open");
  return out;
})()
