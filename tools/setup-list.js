(function () {
  var names = document.querySelectorAll(".dot-name");
  for (var i = 0; i < names.length; i++) {
    if (names[i].textContent.indexOf("黄州") > -1) {
      var icon = names[i].closest(".leaflet-marker-icon") || names[i].closest(".mk-wrap");
      if (icon) {
        icon.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
        return "opened-list:" + names[i].textContent;
      }
    }
  }
  return "not-found";
})()
