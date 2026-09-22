/* 关键文字的屏幕矩形 → 交给 tools/text-contrast.js 做像素级判读
   ----------------------------------------------------------
   为什么不在 DOM 里算对比度：DOM 那套要找"第一个不透明祖先背景"，
   而地图地名压在渐变/图案/山体上，根本找不到"那个背景色"——
   现有的 tools/probes/contrast.js 对这类元素是**跳过**的
   （实跑报 skipped 83 处）。所以地图上那些字的对比度一直没被真正验过。
   这里改成取矩形，由截图里的真实像素来判。

   ⚠️ 同时标出**取样框是否被别的深色图元污染**（地标珠子、标记图标）。
   这一步不能省：地标珠子带一圈深色内收边（#345a4e，亮度比地名文字还低），
   名签的框又常常和邻近珠子重叠 —— 不标出来就会把"珠子边缘"当成"字的笔画"，
   得出"文字只有 2.2:1"这种**看起来很像真的**的错误结论（2026-09-22 踩过）。
   用法：node tools/cdp.js <url> --eval "@tools/probes/_textrects.js" > rects.json */
(function () {
  var T = [
    [".dot-name", "地图·地名"],
    [".dot-count", "地图·数量角标"],
    [".prov-label span", "地图·省名"],
    [".mtn-label span", "地图·山名"],
    ["#bottomBar .bs-counts b", "底栏·数字"],
    ["#bottomBar .bs-counts i", "底栏·单位"],
    [".b-text h1", "顶栏·品牌名"],
    [".d-poem .line", "详情·诗句"],
    [".d-sub", "详情·朝代作者"],
    [".d-head h2", "详情·标题"],
    [".pl-item .pl-t", "浮层·诗名"],
    [".pl-item .pl-m", "浮层·作者"],
    [".sec-story p", "详情·故事正文"],
    ["#dTr", "详情·简析"],
    [".d-where b", "详情·地点名"],
    [".dn-btn .dn-t", "详情·翻页按钮"],
    [".dc-meta", "详情·落款小字"],
  ];
  /* 框里只要沾到这些，结论就不可信：地标珠子自带一圈深色内收边
     （#345a4e），亮度比地名文字还低，混进框里会**伪装成字的笔画**。
     ⚠️ 不要把 svg / img 放进这个名单：地图的 SVG 图层面覆盖整个视口，
     放进去等于每个框都被判为污染，这个提示就废了（踩过一次）。
     装饰图（云、鹤、波浪）本来就压在文字上、且都很淡，不构成污染。 */
  var POLLUTANTS = ".dot, .leaflet-marker-icon, .dot-wrap";

  function hits(rect) {
    var out = [];
    document.querySelectorAll(POLLUTANTS).forEach(function (p) {
      var r = p.getBoundingClientRect();
      if (!r.width || !r.height) return;
      if (!(r.right < rect.left || r.left > rect.right ||
            r.bottom < rect.top || r.top > rect.bottom)) {
        var t = p.tagName.toLowerCase() + (p.className && typeof p.className === "string"
          ? "." + p.className.trim().split(/\s+/)[0] : "");
        if (out.indexOf(t) < 0) out.push(t);
      }
    });
    return out;
  }

  var out = [];
  T.forEach(function (t) {
    var els = document.querySelectorAll(t[0]);
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none") continue;
      if (parseFloat(cs.opacity) < 0.9) continue;
      var r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      if (r.right < 0 || r.bottom < 0 || r.left > innerWidth || r.top > innerHeight) continue;
      if (!el.textContent.trim()) continue;
      out.push({
        what: t[1], sel: t[0],
        text: el.textContent.trim().slice(0, 10),
        color: cs.color, fontSize: cs.fontSize, fontWeight: cs.fontWeight,
        rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
        pollutants: hits(r),
      });
      break;
    }
  });
  return out;
})()
