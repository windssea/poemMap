/* 「已经露着的就别动」——ensurePlaceVisible 的另一半
   ----------------------------------------------------------
   方案 P0-D：「避免每次打开都无意义地移动地图」。
   步骤：挑一个**当前就在可见区里**的地标 → 点开 → 量它有没有被挪动。
   只要地图动了，说明「已经露着也照挪」，就是把读诗的人从字上拽走。 */
(async function () {
  var s = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var map = window.__map;
  var places = window.__places;
  var size = map.getSize();

  var target = null;
  places.forEach(function (p) {
    if (target) return;
    var pt = map.latLngToContainerPoint([p.lat, p.lng]);
    /* 落在画面左侧 8%~40% 处，离抽屉远远的 */
    if (pt.x > size.x * 0.08 && pt.x < size.x * 0.40 && pt.y > 150 && pt.y < size.y - 150) target = p;
  });
  if (!target) return { err: "没有合适的落点" };

  var before = map.latLngToContainerPoint([target.lat, target.lng]);
  var el = target.marker.getElement().querySelector(".dot-wrap");
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  await s(700);
  var item = document.querySelector("#poemList .pl-item");
  if (item) item.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  await s(1400);

  var d = document.querySelector("#detail");
  var after = map.latLngToContainerPoint([target.lat, target.lng]);
  return {
    place: target.id + " / " + target.name,
    drawerOn: d.classList.contains("on"),
    px: target.poems.length,
    beforeX: Math.round(before.x), beforeY: Math.round(before.y),
    afterX: Math.round(after.x), afterY: Math.round(after.y),
    movedPx: Math.round(Math.hypot(after.x - before.x, after.y - before.y)),
    moved: Math.hypot(after.x - before.x, after.y - before.y) > 2,
  };
})()
