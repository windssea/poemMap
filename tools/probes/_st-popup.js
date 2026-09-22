/* 状态：地点浮层（多地）打开 */
(async function () {
  var s = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var names = document.querySelectorAll(".dot-name");
  for (var i = 0; i < names.length; i++) {
    if (names[i].textContent.indexOf("黄州") > -1) {
      var icon = names[i].closest(".leaflet-marker-icon") || names[i].closest(".mk-wrap");
      if (icon) icon.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      break;
    }
  }
  await s(1000);
  return "poemList-on=" + document.querySelector("#poemList").classList.contains("on");
})()
