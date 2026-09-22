/* 窄屏：点开「篇目」把篇目栏推出来，看看谁被谁盖住 */
(async function () {
  var s = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var btn = document.querySelector("#sideToggle");
  if (btn) btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  await s(900);
  return "side-open=" + document.body.classList.contains("side-open");
})()
