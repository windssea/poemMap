/* Popup 扁平化之后，点击与键盘行为必须一点没变（方案 §4 的硬要求）。
   走真实路径：点地标 → 浮层弹出 → 点某一行 → 抽屉打开、浮层收起。
   顺带验：整行的可点区域有没有被缩小（新增的 ::after 箭头不能吃掉点击）。 */
(async function () {
  var s = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  window.__map.setView([39.9, 116.3], 6.4, { animate: false });
  window.__map.fire("moveend");
  await s(500);
  var names = document.querySelectorAll(".dot-name");
  for (var i = 0; i < names.length; i++) {
    if (names[i].textContent.indexOf("蓟城") > -1) {
      var ic = names[i].closest(".leaflet-marker-icon") || names[i].closest(".mk-wrap");
      if (ic) ic.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      break;
    }
  }
  await s(900);
  var pl = document.querySelector("#poemList");
  var items = pl.querySelectorAll(".pl-item");
  var rects = [].map.call(items, function (b) {
    var r = b.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height),
             /* 浮层内宽 - 行宽：行是否仍然通宽 */
             pad: Math.round(pl.getBoundingClientRect().width - r.width) };
  });

  /* 点「最右侧」（箭头所在位置）—— 若箭头吃掉了点击，这里就点不动 */
  var b0 = items[1];
  var r0 = b0.getBoundingClientRect();
  var target = document.elementFromPoint(Math.round(r0.right - 4), Math.round(r0.top + r0.height / 2));
  var hitIsRow = !!(target && target.closest(".pl-item"));

  b0.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  await s(1200);
  return {
    popupOpened: pl.classList.contains("on") || document.querySelectorAll("#poemList .pl-item").length > 0,
    items: items.length,
    rowRects: rects,
    clickAtFarRight_hitsRow: hitIsRow,
    hitTag: target ? target.tagName.toLowerCase() + (target.className && typeof target.className === "string" ? "." + target.className.split(" ")[0] : "") : null,
    afterClick_detailOn: document.querySelector("#detail").classList.contains("on"),
    afterClick_title: (document.getElementById("dTitle") || {}).textContent,
    afterClick_popupGone: !document.querySelector("#poemList").classList.contains("on"),
  };
})()
