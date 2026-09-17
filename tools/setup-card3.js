(function () {
  var names = document.querySelectorAll(".dot-name");
  for (var i = 0; i < names.length; i++) {
    if (names[i].textContent.indexOf("黄州") > -1) {
      var icon = names[i].closest(".leaflet-marker-icon") || names[i].closest(".mk-wrap");
      if (icon) {
        icon.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
        break;
      }
    }
  }
  var items = document.querySelectorAll("#poemList .pl-item");
  for (var j = 0; j < items.length; j++) {
    var t = items[j].textContent;
    if (t.indexOf("赤壁") > -1 && t.indexOf("念奴娇") === -1) {
      items[j].dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      return "opened-card:赤壁";
    }
  }
  return "no-item";
})()
