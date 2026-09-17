/* 抽屉开着时点外侧地图 —— 抽屉应自动收起（需求 3） */
(async function () {
  var before = __state();
  var at = __press(document.querySelector("#map"));
  await __raf(); await __wait(320);
  return "outside-click@" + at + " detailBefore=" + before.detail + " detailAfter=" + __state().detail;
})();
