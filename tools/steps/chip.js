/* 点筛选条上某个时代组/体裁按钮。参数：window.__stepArg = "先唐" | "唐诗" | "宋词" | "诗" | "词" | "全部" */
(async function () {
  await __wait(700);
  var want = String(window.__stepArg || "").trim();
  var btns = document.querySelectorAll("#chipsDynasty button, #chipsForm button");
  var hit = null;
  for (var i = 0; i < btns.length; i++) {
    if ((btns[i].textContent || "").trim() === want) { hit = btns[i]; break; }
  }
  if (!hit) return "chip-not-found:" + want;
  __click(hit);
  await __raf(); await __wait(900);
  return {
    picked: want,
    stat: (document.getElementById("statPoems") || {}).textContent,
    places: (document.getElementById("statPlaces") || {}).textContent,
    bs: [].map.call(document.querySelectorAll("#bottomBar .bs"), function (e) { return e.textContent; }),
    markers: document.querySelectorAll(".mk-wrap").length,
  };
})();
