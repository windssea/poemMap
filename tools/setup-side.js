(function () {
  var t = document.querySelector("#sideToggle");
  if (t) {
    t.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    return "side-open";
  }
  return "no-toggle";
})()
