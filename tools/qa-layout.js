(function () {
  var out = {};
  var el = function (s) { var e = document.querySelector(s); return e ? e.getBoundingClientRect().toJSON() : null; };
  out.viewport = [innerWidth, innerHeight];
  out.sideW = getComputedStyle(document.body).getPropertyValue("--side-w");
  out.sidebar = el("#sidebar");
  out.bottomBar = el("#bottomBar");
  out.tools = el("#tools");
  out.mount = el(".p-mount");
  out.pine = el(".p-pine");
  out.wave = el(".p-wave");
  out.crane = el(".p-crane");
  var sv = document.querySelector("#sideVerse");
  out.sideVerse = sv ? { box: sv.getBoundingClientRect().toJSON(), lines: Array.prototype.map.call(sv.querySelectorAll(".sv-line"), function (n) { return n.getBoundingClientRect().toJSON(); }) } : null;
  out.provShown = document.body.classList.contains("show-prov");
  out.zoom = window.__map ? window.__map.getZoom() : null;
  out.errors = window.__errs || [];
  return JSON.stringify(out);
})()
