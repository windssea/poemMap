/* 命令面板里点一首诗：走 goToPlace（飞行 1.05s）+ openDetail 两条路同时发生。
   这是最容易「两段动画打架」的一条路径——
   量飞行结束后地标的位置，以及之后 900ms 内它有没有被二次挪动。 */
(async function () {
  var s = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var map = window.__map;
  var places = window.__places;

  // 找一个当前落在屏幕右侧 60% 以外的地标（飞过去才有位移可测）
  var size = map.getSize(), target = null;
  places.forEach(function (p) {
    if (target) return;
    var pt = map.latLngToContainerPoint([p.lat, p.lng]);
    if (pt.x > size.x * 0.62 && pt.y > 120 && pt.y < size.y - 120) target = p;
  });
  if (!target) return { err: "没有合适的落点" };
  var title = target.poems[0].title;

  // ⌘K 打开命令面板，输入诗名，回车
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true, cancelable: true }));
  await s(600);
  var input = document.querySelector("#palette input");
  if (!input) return { err: "命令面板没打开" };
  // React 受控输入：用原生 setter 触发 onChange
  var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  setter.call(input, title);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await s(700);
  var item = document.querySelector("#palette .pal-item");
  if (!item) return { err: "面板里没搜到：" + title };
  item.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));

  await s(2400);                                     // 飞行 1.05s + 抽屉 0.4s + 余量
  var a = map.latLngToContainerPoint([target.lat, target.lng]);
  await s(900);
  var b = map.latLngToContainerPoint([target.lat, target.lng]);
  var d = document.querySelector("#detail");
  var visTo = size.x - d.offsetWidth;
  return {
    place: target.id + " / " + target.name,
    detailOn: d.classList.contains("on"),
    drawerW: d.offsetWidth, visibleTo: Math.round(visTo),
    x1: Math.round(a.x), x2: Math.round(b.x), y1: Math.round(a.y),
    driftAfterFlight: Math.round(Math.hypot(b.x - a.x, b.y - a.y)),
    insideVisible: a.x > 0 && a.x < visTo,
    margin: Math.round(visTo - a.x),
  };
})()
