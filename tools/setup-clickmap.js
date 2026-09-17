/* 打开某首诗的详情后，点一下地图空白处 —— 验证抽屉是否自动收起
   用法： CDP_SETUP=tools/setup-clickmap.js CDP_SETUP_WAIT=1400 node tools/cdp.js <url> --eval "..." */
(function () {
  var d = document.querySelector("#detail");
  if (!d.classList.contains("on")) return "detail-not-open";
  var mapEl = document.querySelector("#map");
  var r = mapEl.getBoundingClientRect();
  var x = Math.round(r.left + 140);
  var y = Math.round(r.top + r.height * 0.72);
  ["mousedown", "mousemove", "mouseup", "click"].forEach(function (t) {
    mapEl.dispatchEvent(new MouseEvent(t, {
      bubbles: true, cancelable: true, clientX: x, clientY: y, view: window,
    }));
  });
  return "clicked " + x + "," + y;
})();
