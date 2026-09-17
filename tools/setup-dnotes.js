/* 打开「赤壁」详情后，再点开「查看完整注释」——验证注释开关可用、布局仍与诗同宽 */
(function () {
  var names = document.querySelectorAll(".dot-name");
  for (var i = 0; i < names.length; i++) {
    if (names[i].textContent.indexOf("黄州") > -1) {
      var icon = names[i].closest(".leaflet-marker-icon") || names[i].closest(".mk-wrap");
      if (icon) { icon.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window })); break; }
    }
  }
  var items = document.querySelectorAll("#poemList .pl-item");
  var hit = null;
  for (var j = 0; j < items.length; j++) {
    if (items[j].textContent.indexOf("赤壁") > -1 && items[j].textContent.indexOf("念奴娇") < 0) { hit = items[j]; break; }
  }
  if (hit) hit.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  var d = document.querySelector("#detail");
  if (!d.classList.contains("on")) {
    var more = document.querySelector("#cardMore");
    if (more) more.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  }
  var btn = document.querySelector("#btnMore");
  if (btn) btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  return "notes-open=" + !document.querySelector("#dMore").hidden;
})();
