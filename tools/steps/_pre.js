/* 共用小工具：等 React 提交（两帧），再继续下一步 */
window.__raf = function () {
  return new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(r); }); });
};
window.__wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
window.__click = function (el) {
  if (!el) return false;
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  return true;
};
window.__press = function (el) {          // 点地图用：要带 pointerdown
  if (!el) return false;
  var r = el.getBoundingClientRect();
  var x = Math.round(r.left + r.width * 0.18);
  var y = Math.round(r.top + r.height * 0.78);
  var opt = { bubbles: true, cancelable: true, clientX: x, clientY: y, view: window };
  try { el.dispatchEvent(new PointerEvent("pointerdown", opt)); } catch (e) {
    el.dispatchEvent(new MouseEvent("mousedown", opt));
  }
  ["mousemove", "mouseup", "click"].forEach(function (t) {
    el.dispatchEvent(new MouseEvent(t, opt));
  });
  return x + "," + y;
};
window.__marker = function (name) {
  var names = document.querySelectorAll(".dot-name");
  for (var i = 0; i < names.length; i++) {
    if (names[i].textContent.indexOf(name) > -1) {
      return names[i].closest(".leaflet-marker-icon") || names[i].closest(".mk-wrap");
    }
  }
  return null;
};
window.__pick = function (name, fallback) {
  var items = document.querySelectorAll("#poemList .pl-item");
  var hit = null;
  for (var i = 0; i < items.length; i++) {
    var t = items[i].textContent;
    if (name && t.indexOf(name) > -1) { hit = items[i]; break; }
  }
  if (!hit && fallback && items.length) hit = items[items.length - 1];
  return hit;
};
window.__state = function () {
  var q = function (s) { return document.querySelector(s); };
  var c = q("#card"), d = q("#detail"), pl = q("#poemList"), sb = q("#sidebar");
  return {
    card: c ? c.classList.contains("on") : null,
    detail: d ? d.classList.contains("on") : null,
    list: pl ? pl.classList.contains("on") : null,
    listCount: document.querySelectorAll("#poemList .pl-item").length,
    side: document.body.classList.contains("side-open"),
    sidebarOpacity: sb ? getComputedStyle(sb).opacity : null,
    title: (q("#dTitle") || q("#cardTitle") || {}).textContent || "",
    items: document.querySelectorAll("#list .item").length,
  };
};
