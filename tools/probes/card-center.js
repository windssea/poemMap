/* 量诗词卡片：是否居中于可视区、是否竖排右起、是否会横向溢出
   用法：CDP_SETUP=tools/steps/_pre.js,tools/steps/place.js,tools/steps/pick.js \
        CDP_STEP_ARG='长安,|last' node tools/cdp.js <url> --eval @tools/probes/card-center.js [waitMs] */
(function () {
  var q = function (s) { return document.querySelector(s); };
  var c = q("#card");
  if (!c || !c.classList.contains("on")) return { cardOn: false };

  var r = c.getBoundingClientRect();
  var vw = innerWidth, vh = innerHeight;
  var cx = r.left + r.width / 2, cy = r.top + r.height / 2;

  /* 竖排落在每一列 .col 上，容器自己就是竖排块（列依次向左叠） */
  var poem = q("#cardPoem");
  var col = q("#cardPoem .col");
  var cols = document.querySelectorAll("#cardPoem .col").length;
  /* 竖排右起：第一列应贴容器右边 */
  var rightmost = null;
  if (col && poem) {
    var first = poem.querySelector(".col").getBoundingClientRect();
    var pr = poem.getBoundingClientRect();
    rightmost = Math.abs((pr.right - first.right)) < Math.abs((first.left - pr.left)) + 1;
  }

  return {
    cardOn: true,
    box: { l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
    cardCx: Math.round(cx), cardCy: Math.round(cy),
    viewCx: Math.round(vw / 2), viewCy: Math.round(vh / 2),
    dx: Math.round(cx - vw / 2), dy: Math.round(cy - vh / 2),
    /* 居中误差：卡片中心与可视区中心距离。placeCard() 会在安全区（避开工具栏/底栏）内居中，
       所以 dy 允许有小量偏移；dx 应接近 0 */
    centerErrPx: Math.round(Math.sqrt(Math.pow(cx - vw / 2, 2) + Math.pow(cy - vh / 2, 2)) * 10) / 10,
    fitsViewport: r.height <= vh && r.width <= vw,
    title: (q("#cardTitle") || {}).textContent || "",
    cols: cols,
    colWritingMode: col ? getComputedStyle(col).writingMode : "",
    poemWritingMode: poem ? getComputedStyle(poem).writingMode : "",
    startsFromRight: rightmost,
    poemOverflowX: poem ? poem.scrollWidth > poem.clientWidth + 2 : null,
  };
})()
