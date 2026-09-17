(function () {
  // 点开「浔阳江」地标（琵琶行）
  var names = document.querySelectorAll(".dot-name");
  for (var i = 0; i < names.length; i++) {
    var t = names[i].textContent;
    if (t.indexOf("浔阳") > -1 || t.indexOf("江州") > -1) {
      var icon = names[i].closest(".leaflet-marker-icon") || names[i].closest(".mk-wrap");
      if (icon) { icon.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window })); break; }
    }
  }
  // 若弹出多地浮层，找「琵琶行」
  var items = document.querySelectorAll("#poemList .pl-item");
  var hit = null;
  for (var j = 0; j < items.length; j++) {
    if (items[j].textContent.indexOf("琵琶行") > -1) { hit = items[j]; break; }
  }
  if (hit) hit.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  var cardOn = document.querySelector("#card").classList.contains("on");
  // 打开详情抽屉
  var more = document.querySelector("#cardMore");
  if (more && cardOn) more.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  var d = document.querySelector("#detail");
  var poem = document.querySelector("#dPoem");
  return "long:title=" + (document.querySelector("#dTitle") || {}).textContent +
         "; detail-on=" + d.classList.contains("on") +
         "; card-on=" + document.querySelector("#card").classList.contains("on") +
         "; poemScrollW=" + poem.scrollWidth + "/" + poem.clientWidth +
         "; bodyScrollH=" + document.querySelector(".detail-body").scrollHeight + "/" + document.querySelector(".detail-body").clientHeight;
})()
