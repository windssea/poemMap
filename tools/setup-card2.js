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
    if (items[j].textContent.indexOf("念奴娇") > -1) {
      items[j].dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      return "opened-card:念奴娇";
    }
  }
  if (items.length) {
    items[0].dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    return "opened-card:first";
  }
  return "no-list";
})()
