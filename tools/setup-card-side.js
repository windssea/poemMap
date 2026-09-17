/* 开一张诗词卡，再展开左侧篇目栏 —— 验证卡片会在「剩余可视区」里重新居中 */
(function () {
  var names = document.querySelectorAll(".dot-name");
  for (var i = 0; i < names.length; i++) {
    if (names[i].textContent.indexOf("黄州") > -1) {
      var icon = names[i].closest(".leaflet-marker-icon") || names[i].closest(".mk-wrap");
      if (icon) { icon.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window })); break; }
    }
  }
  var items = document.querySelectorAll("#poemList .pl-item");
  for (var j = 0; j < items.length; j++) {
    if (items[j].textContent.indexOf("念奴娇") > -1) {
      items[j].dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      break;
    }
  }
  var tog = document.querySelector("#sideToggle");
  if (tog) tog.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  return "card+side";
})();
