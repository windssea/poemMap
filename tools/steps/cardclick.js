/* 卡片开着时点地图空白处 —— 卡片与浮层应一并收起 */
(async function () {
  var before = __state();
  var at = __press(document.querySelector("#map"));
  await __raf(); await __wait(300);
  return "map-click@" + at + " before=" + JSON.stringify(before) + " after=" + JSON.stringify(__state());
})();
