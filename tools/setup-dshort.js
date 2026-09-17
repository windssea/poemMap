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
  if (!hit && items.length) hit = items[items.length - 1];
  if (hit) hit.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  var more = document.querySelector("#cardMore");
  if (more && document.querySelector("#card").classList.contains("on")) {
    more.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  }
  var d = document.querySelector("#detail");
  return "short:" + (document.querySelector("#dTitle") || {}).textContent + " on=" + d.classList.contains("on");
})()
