/* 从篇目栏点一首「东边」的诗：走的是 goToPlace（明确「去这里」）那条路。
   要验两件事：
     1) 落点在**可见区**里（不是被抽屉压住）——goToPlace 的 visibleFrac；
     2) 落点之后没有被 ensurePlaceVisible 二次挪动（两段动画打架）。
   量法：等飞行结束记一次位置，再等 800ms 记第二次，两次应当一致。 */
(async function () {
  var s = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var map = window.__map;
  var places = window.__places;

  // 打开篇目栏
  document.querySelector("#sideToggle").dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  await s(700);

  // 找一个当前落在屏幕右侧 60% 以外的地标——点它就会「飞过去」
  var size = map.getSize(), target = null;
  places.forEach(function (p) {
    if (target) return;
    var pt = map.latLngToContainerPoint([p.lat, p.lng]);
    if (pt.x > size.x * 0.6 && pt.y > 120 && pt.y < size.y - 120) target = p;
  });
  if (!target) return { err: "没有合适的落点" };

  // 在篇目栏里找一首属于该地标的诗
  var pid = target.poems[0].id;
  var row = document.querySelector('#sidebar .item[data-id="' + pid + '"]') ||
            document.querySelector('#sidebar [data-id="' + pid + '"]');
  if (!row) return { err: "篇目栏里没有 " + pid, place: target.id };
  row.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));

  await s(2200);                                 // 飞行 1.05s + 抽屉 0.4s，留足余量
  var a = map.latLngToContainerPoint([target.lat, target.lng]);
  await s(900);
  var b = map.latLngToContainerPoint([target.lat, target.lng]);
  var d = document.querySelector("#detail");
  var visTo = size.x - d.offsetWidth;
  return {
    place: target.id + " / " + target.name + "（" + target.poems.length + " 首）",
    detailOn: d.classList.contains("on"),
    drawerW: d.offsetWidth, visibleTo: Math.round(visTo),
    x1: Math.round(a.x), y1: Math.round(a.y),
    x2: Math.round(b.x), y2: Math.round(b.y),
    driftAfterFlight: Math.round(Math.hypot(b.x - a.x, b.y - a.y)),
    insideVisible: a.x > 0 && a.x < visTo,
  };
})()
