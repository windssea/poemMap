/* 量详情抽屉：是否打开、宽度、磨砂玻璃参数、竖排是否生效、卡片是否已让位
   用法：CDP_SETUP=tools/steps/_pre.js,tools/steps/place.js,tools/steps/pick.js,tools/steps/detail.js \
        CDP_STEP_ARG='长安,|last,' node tools/cdp.js <url> --eval @tools/probes/detail-geo.js [waitMs] */
(function () {
  var q = function (s) { return document.querySelector(s); };
  var d = q("#detail");
  if (!d || !d.classList.contains("on")) return { detailOn: false };

  var body = q("#detail .d-body") || d;
  var cs = getComputedStyle(body);
  var poem = q("#dPoem");
  var b = d.getBoundingClientRect();
  var card = q("#card");

  return {
    detailOn: true,
    cardOn: !!(card && card.classList.contains("on")),   // 进详情应自动收起卡片
    width: Math.round(b.width),
    height: Math.round(b.height),
    bodyBackdrop: cs.backdropFilter || cs.webkitBackdropFilter,
    bodyColor: cs.backgroundColor,
    poemWritingMode: poem ? getComputedStyle(poem).writingMode : "",
    poemWidthMode: poem ? getComputedStyle(poem).width : "",
    lines: document.querySelectorAll("#dPoem .line").length,
    poemScrollW: poem ? poem.scrollWidth : null,
    poemClientW: poem ? poem.clientWidth : null,
    /* 诗超高时只应在诗栏内横向滚动，而不是整抽屉出现竖向滚动条 */
    willScrollHorizontally: poem ? poem.scrollWidth > poem.clientWidth + 2 : null,
    title: (q("#dTitle") || {}).textContent || "",
    /* #dNotes 是 <dl>，一对 dt/dd 记一条注释 */
    notesOpen: !!(q("#dMore") && !q("#dMore").hidden),
    notes: document.querySelectorAll("#dNotes dt").length,
  };
})()
