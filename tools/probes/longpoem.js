/* 长诗「连续阅读」体检（方案 §3 的强制验收情景）
   ----------------------------------------------------------
   方案的红线：不得分段、分页、截断、缩字硬塞；从头到尾是同一篇连续文本；
   首句从正确位置开始、末句可达；上下篇切换后不继承上一首的滚动位置。

   这里逐句量几何，不看截图猜：
     · 句数对不对（DOM 里的 .line 数 vs 数据里的 lines 数）
     · 有没有句子的盒子跑到阅读容器之外（被 overflow:hidden 裁掉）
     · 首句是否贴着容器的起始边（竖排右起：首句在最右）
     · 横向滚到两端时，首句/末句是否都真的进得来
     · 纵向能不能滚到地点、标签、背景故事
   用法：CDP_SETUP=tools/probes/longpoem.js CDP_STEP_ARG=<poemId> ... */
(async function () {
  var s = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var id = window.__stepArg || "pipa-xing";
  var p = window.__poemById[id];
  if (!p) return { err: "没有这首诗：" + id };

  location.hash = "#/p/" + id;
  await s(1400);

  var el = document.querySelector("#dPoem");
  var body = document.querySelector(".detail-body");
  var lines = [].slice.call(el.querySelectorAll(".line"));
  var box = el.getBoundingClientRect();

  /* 每句相对阅读容器的位置 */
  var outside = [];
  lines.forEach(function (ln, i) {
    var r = ln.getBoundingClientRect();
    /* 竖排：句子之间沿 x 轴排开，纵向应当都在容器高度内 */
    if (r.top < box.top - 1 || r.bottom > box.bottom + 1) outside.push({ i: i, off: "纵向出界" });
  });

  /* 首句（最右）与末句（最左）的可达性 */
  el.scrollLeft = 0;
  await s(60);
  var firstR = lines[0].getBoundingClientRect();
  var firstVisibleAtStart = firstR.right <= box.right + 1 && firstR.left >= box.left - 1;
  el.scrollLeft = -(el.scrollWidth - el.clientWidth);
  await s(60);
  var lastR = lines[lines.length - 1].getBoundingClientRect();
  var lastVisibleAtEnd = lastR.left >= box.left - 1 && lastR.right <= box.right + 1;
  var scrolledTo = Math.round(el.scrollLeft);

  /* 纵向能否抵达下方内容（地点 / 标签 / 背景故事）。
     ⚠️ 不能"滚到最底再看故事在不在视口里"—— 背景故事后面还有
     诗意简析、作者、落款、收束按钮，滚到最底时故事已经翻上去了。
     这里改成把目标滚进视口，问的是"够不够得着"。
     ⚠️ 滚动之后要**重新取 rect**，滚动前拿到的是旧位置。 */
  function reachable(sel) {
    var t = document.querySelector(sel);
    if (!t) return null;
    var b = body.getBoundingClientRect();
    var r = t.getBoundingClientRect();
    body.scrollTop += (r.top - b.top) - 40;      // 让它落到视口顶部附近
    var b2 = body.getBoundingClientRect();
    var r2 = t.getBoundingClientRect();
    return r2.top < b2.bottom && r2.bottom > b2.top;
  }
  var storyReachable = reachable(".sec-story");
  var whereReachable = reachable(".d-where");
  var tagsReachable = reachable(".d-tags");
  body.scrollTop = 0;
  await s(80);

  return {
    诗: p.title,
    数据句数: p.lines.length,
    DOM句数: lines.length,
    句数一致: p.lines.length === lines.length,
    重复或缺漏: p.lines.length !== lines.length,
    纵向出界的句子: outside.length,
    阅读容器高: Math.round(box.height),
    横向溢出量: el.scrollWidth - el.clientWidth,
    可横向滚动: el.scrollWidth - el.clientWidth > 2,
    首句起点可见: firstVisibleAtStart,
    末句终点可达: lastVisibleAtEnd,
    滚到末尾时scrollLeft: scrolledTo,
    纵向可滚: body.scrollHeight - body.clientHeight > 2,
    "下方「地点」可达": whereReachable,
    "下方「背景故事」可达": storyReachable,
    "下方「分类标签」可达": tagsReachable,
    文档横向溢出: document.documentElement.scrollWidth - innerWidth,
  };
})()
