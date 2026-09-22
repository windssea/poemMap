/* 「点开一首诗，左边地图上找得到是哪一处吗」
   ----------------------------------------------------------
   步骤：
     1) 把地图移到某个地标**正落在抽屉将要盖住的那块**上；
     2) 点它（走真实的 openNode 路径，不是深链）；
     3) 等抽屉动画走完，量这颗珠子在屏幕上的位置，
        看它是否落在「抽屉左缘以左」的可见区里。
   用法：CDP_SETUP=tools/probes/_occlusion.js CDP_STEP_ARG=<placeId> ...
   不带参数则自动挑一个「当前落在屏幕右半边」的地标。 */
(async function () {
  var s = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var map = window.__map;
  var places = window.__places;
  var want = window.__stepArg;

  /* 抽屉大概会盖掉右侧多少：取最短的抽屉宽度（min-width 420）保守估计 */
  var w = map.getSize().x;
  var target = null;
  if (want) {
    target = places.filter(function (p) { return p.id === want; })[0];
  } else {
    /* 挑一个落在「画面 62%~92% 宽」之间的地标——点开之后它一定被抽屉压住 */
    var lo = w * 0.62, hi = w * 0.92;
    places.forEach(function (p) {
      if (target) return;
      var pt = map.latLngToContainerPoint([p.lat, p.lng]);
      if (pt.x > lo && pt.x < hi && pt.y > 120 && pt.y < map.getSize().y - 120) target = p;
    });
  }
  if (!target) return { err: "没有合适的落点" };

  var before = map.latLngToContainerPoint([target.lat, target.lng]);
  var el = target.marker.getElement().querySelector(".dot-wrap");
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));

  /* 若这一个地标有多首，会先弹篇目浮层——挑第一首 */
  await s(700);
  var item = document.querySelector("#poemList .pl-item");
  if (item) item.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  await s(1400);   // 抽屉 0.4s 滑入 + ensurePlaceVisible 的 0.45s 平移

  var d = document.querySelector("#detail");
  var after = map.latLngToContainerPoint([target.lat, target.lng]);
  var dw = d.offsetWidth;
  return {
    viewport: w + "x" + map.getSize().y,
    place: target.id + " / " + target.name,
    poems: target.poems.length,
    drawerOn: d.classList.contains("on"),
    drawerW: dw,
    visibleTo: Math.round(w - dw),          // 可见区右界
    beforeX: Math.round(before.x), beforeY: Math.round(before.y),
    afterX: Math.round(after.x), afterY: Math.round(after.y),
    insideVisible: after.x < w - dw && after.x > 0,
    marginFromDrawer: Math.round(w - dw - after.x),
  };
})()
