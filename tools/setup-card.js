(function () {
  var items = document.querySelectorAll("#list .item");
  for (var i = 0; i < items.length; i++) {
    var t = items[i].querySelector(".it-t");
    if (t && t.textContent.indexOf("早发白帝城") > -1) { items[i].click(); return "clicked:" + i; }
  }
  return "not-found";
})()
