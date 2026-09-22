/* 状态：地图放大到近景 */
(async function () {
  var s = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  window.__map.setView([34.2, 108.9], 6.6, { animate: false });
  window.__map.fire("moveend");
  await s(900);
  return "zoom=" + window.__map.getZoom().toFixed(2);
})()
