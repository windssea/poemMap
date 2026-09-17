/* 量诗词卡：窗口尺寸 + 可读性（字号/行高/字距/对比）
   用法：CDP_SETUP=tools/steps/_pre.js,tools/steps/place.js,tools/steps/pick.js \
        CDP_STEP_ARG='长安,|last' node tools/cdp.js <url> --eval @tools/probes/card-read.js 2600 */
(function () {
  var q = function (s) { return document.querySelector(s); };
  var c = q("#card");
  if (!c || !c.classList.contains("on")) return { cardOn: false };

  var px = function (el, prop) { return el ? parseFloat(getComputedStyle(el)[prop]) : null; };
  var cs = getComputedStyle(c);
  var r = c.getBoundingClientRect();

  var poem = q("#cardPoem");
  var cols = document.querySelectorAll("#cardPoem .col");
  var col = cols[0] || null;
  var colCs = col ? getComputedStyle(col) : null;

  /* 列宽＝字号 × 行高 + 左右 padding（竖排时 line-height 管的是「列间距」） */
  var colBox = col ? col.getBoundingClientRect() : null;
  var tallest = 0, widest = 0;
  for (var i = 0; i < cols.length; i++) {
    var b = cols[i].getBoundingClientRect();
    if (b.height > tallest) tallest = Math.round(b.height);
    if (b.width > widest) widest = Math.round(b.width);
  }
  var pr = poem ? poem.getBoundingClientRect() : null;

  return {
    cardOn: true,
    title: (q("#cardTitle") || {}).textContent || "",
    box: { l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
    /** ① 窗口是否变大：算出「占可视区面积比的平方根」与绝对尺寸 */
    cardW: Math.round(r.width), cardH: Math.round(r.height),
    maxW: Math.round(parseFloat(cs.maxWidth)),
    maxH: Math.round(parseFloat(cs.maxHeight)),
    pad: cs.padding,
    viewBoxShareW: Math.round(r.width / innerWidth * 1000) / 10,
    viewBoxShareH: Math.round(r.height / innerHeight * 1000) / 10,
    fitsViewport: r.height <= innerHeight && r.width <= innerWidth,

    /** ② 诗词部分是主角：正文字号 + 列几何 */
    poemFontSize: px(col, "fontSize"),
    poemLineHeight: px(col, "lineHeight"),
    poemLetterSpacing: colCs ? colCs.letterSpacing : null,
    poemFontWeight: colCs ? colCs.fontWeight : null,
    poemColor: colCs ? colCs.color : null,
    poemFontFamily: colCs ? colCs.fontFamily.split(",")[0] : null,
    colCount: cols.length,
    colWidth: widest,
    colTallest: tallest,
    poemPanelMinH: px(poem, "minHeight"),

    /** ③ 纵向阅读：是否有物理滚动条（有则歌词被切断） */
    poemClipX: poem ? poem.scrollWidth > poem.clientWidth + 2 : null,
    poemClipY: poem ? poem.scrollHeight > poem.clientHeight + 2 : null,
    poemScrollW: poem ? poem.scrollWidth : null,
    poemClientW: poem ? poem.clientWidth : null,

    /** ④ 标题/辅文/注解 的字号 */
    titleFontSize: px(q("#cardTitle"), "fontSize"),
    subFontSize: px(q("#cardSub"), "fontSize"),
    metaFontSize: px(q("#card .c-meta"), "fontSize"),
    secH3FontSize: px(q("#card .c-sec h3"), "fontSize"),
    secPFontSize: px(q("#card .c-sec p"), "fontSize"),
    moreFontSize: px(q("#cardMore"), "fontSize"),
    othersFontSize: px(q("#cardOthers button"), "fontSize"),
    tagFontSize: px(q("#cardTags span"), "fontSize"),

    /** ⑤ 正文与标题的字号梯度：正文不该比副文还小 */
    poemVsSub: px(col, "fontSize") / px(q("#cardSub"), "fontSize"),
    poemVsSec: px(col, "fontSize") / px(q("#card .c-sec p"), "fontSize"),

    /** ⑥ 与可视区的关系（居中用 card-center 探针，这里只看是否越界/压到侧栏） */
    overlapsSidebar: (function () {
      var s = q("#sidebar");
      if (!s || !document.body.classList.contains("side-open")) return null;
      var sb = s.getBoundingClientRect();
      return sb.right > r.left + 1;
    })(),
    poemPanel: pr ? { w: Math.round(pr.width), h: Math.round(pr.height) } : null,
  };
})()
