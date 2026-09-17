/* 把地图移到指定视野（截图前用）
   CDP_STEP_ARG = "lat|lng|zoom"（用竖线，逗号是 cdp.js 的步骤分隔符） */
(async function () {
  var a = String(window.__stepArg || "").split("|");
  var m = window.__map;
  if (!m || a.length < 3) return { skipped: String(window.__stepArg || "") };
  m.setView([Number(a[0]), Number(a[1])], Number(a[2]), { animate: false });
  m.fire("moveend");
  await window.__raf();
  await window.__wait(600);
  m.fire("moveend");
  await window.__raf();
  await window.__wait(600);
  return { z: m.getZoom(), lat: +m.getCenter().lat.toFixed(2), lng: +m.getCenter().lng.toFixed(2) };
})();
