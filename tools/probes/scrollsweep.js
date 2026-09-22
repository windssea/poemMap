/* 把 scrollLeft 从大负值扫到大正值，每档记「首句」的屏幕位置。
   内容真的动了 → 那一档就是有效方向与量程。 */
(async function () {
  var s = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var el = document.querySelector("#dPoem");
  var first = el.querySelector(".line");
  var max = el.scrollWidth - el.clientWidth;
  var out = { sw: el.scrollWidth, cw: el.clientWidth, max: max,
              writingMode: getComputedStyle(el).writingMode, dir: getComputedStyle(el).direction,
              firstLeft0: Math.round(first.getBoundingClientRect().left), sweep: [] };
  var vals = [-max, -max / 2, -100, 0, 100, max / 2, max];
  for (var i = 0; i < vals.length; i++) {
    var v = vals[i];
    el.scrollLeft = v; await s(90);
    out.sweep.push({ 设: Math.round(v), 读: Math.round(el.scrollLeft),
                     首句left: Math.round(first.getBoundingClientRect().left) });
  }
  el.scrollLeft = 0; await s(60);
  /* 键盘 / 滚轮路径是否可用 */
  el.focus && el.focus();
  el.dispatchEvent(new WheelEvent("wheel", { deltaX: -300, bubbles: true, cancelable: true }));
  await s(150);
  out.afterWheel = { scrollLeft: Math.round(el.scrollLeft), 首句left: Math.round(first.getBoundingClientRect().left) };
  return out;
})()
