/* 抽屉「透景」实测：文字背后到底有没有地图透过来
   ----------------------------------------------------------
   方案 §1.2 提醒："如果抽屉后方根本没有地图，backdrop-filter 不会凭空产生
   透景效果"；§2 要求"文字后不得透出可辨识的地图标签、河流、圆点"。

   这里的判法是把**地图**挪到两个不同的位置（其余一切不动），
   分别在抽屉的同一块区域取样：
     · 若该区域像素随地图而变 → 地图内容确实透到文字底下了
     · 若两帧逐像素相同      → 这一块是不透的
   同时报告「变动幅度」，用来判断是"隐约透一点"还是"看得清地名"。

   用法：CDP_SETUP=tools/probes/bleed.js CDP_SETUP_WAIT=2500 \
           node tools/cdp.js "<url>#/p/<id>" shots/bleed.png */
(async function () {
  var s = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var map = window.__map;
  var SAMPLE = [
    ["诗词正文区（竖排诗所在）", 0],
    ["标题区", 0],
    ["背景故事卡", 0],
    ["左缘 32px 带（边缘）", 0],
  ];

  /* 取两块区域的屏幕矩形：正文所在的内容列，与最左侧一条竖带 */
  var col = document.querySelector(".d-col").getBoundingClientRect();
  var body = document.querySelector(".detail-body").getBoundingClientRect();
  var poem = document.querySelector("#dPoem").getBoundingClientRect();
  var story = document.querySelector(".sec-story").getBoundingClientRect();

  function rectOf(name) {
    if (name.indexOf("正文") === 0) return poem;
    if (name.indexOf("标题") === 0) return document.querySelector(".d-head").getBoundingClientRect();
    if (name.indexOf("故事") === 0) return story;
    return { left: body.left, right: body.left + 32, top: body.top + 200, bottom: body.bottom - 200 };
  }

  var out = { viewport: innerWidth + "x" + innerHeight, detail: {}, samples: [] };
  var d = document.getElementById("detail");
  out.detail = {
    position: getComputedStyle(d).position,
    background: getComputedStyle(d).backgroundColor,
    backdrop: getComputedStyle(d).backdropFilter,
    left: Math.round(d.getBoundingClientRect().left),
    width: Math.round(d.offsetWidth),
    /* 抽屉左缘以左有没有地图：取左缘上一个点，看命中的是不是地图 */
    behindLeft: (function () {
      var el = document.elementFromPoint(Math.round(d.getBoundingClientRect().left) - 20, 300);
      return el ? el.tagName.toLowerCase() + (el.id ? "#" + el.id : "." + String(el.className).split(" ")[0]) : null;
    })(),
  };

  var bodyBg = getComputedStyle(document.querySelector(".detail-body")).backgroundColor;
  out.bodyBackground = bodyBg;

  /* 地图挪到两个完全不同的地方；每次记下取样矩形的屏幕坐标（抽屉不动，
     所以坐标应当一致，顺手验一下） */
  var frames = [];
  var spots = [[25, 102], [45, 120]];   // 塔里木盆地 / 东北，两处地貌差别大
  for (var i = 0; i < spots.length; i++) {
    map.setView(spots[i], 6, { animate: false });
    map.fire("moveend");
    await s(700);
    frames.push({ rects: SAMPLE.map(function (x) { return rectOf(x[0]).toJSON(); }) });
  }
  out.rectsStable = JSON.stringify(frames[0].rects) === JSON.stringify(frames[1].rects);
  out.rects = frames[0].rects.map(function (r) {
    return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)];
  });
  out.labels = SAMPLE.map(function (x) { return x[0]; });
  return out;
})()
