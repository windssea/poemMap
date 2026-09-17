/* 把省区/国界的点抽稀容差调大，看 SVG 顶点能省多少（软渐变填充下通常看不出来） */
(function () {
  var m = window.__map, L = window.L, n = 0;
  m.eachLayer(function (l) {
    if (!(l instanceof L.Path) || !l.options || !l.options.pane) return;
    var p = l.options.pane;
    if (p === "prov") { l.setStyle({ smoothFactor: 2.6 }); n++; }
    else if (p === "border") { l.setStyle({ smoothFactor: 3 }); n++; }
  });
  return "smoothed " + n;
})();
