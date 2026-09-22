/* 配合 bleed.js：把地图挪到第 N 个位置，其余一律不动，然后截图。
   用法：CDP_STEP_ARG=0|1 CDP_SETUP=tools/probes/bleedshot.js \
           node tools/cdp.js "<url>#/p/<id>" shots/bleed-<n>.png 8000 */
(async function () {
  var s = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var spots = [[25, 102], [45, 120]];
  var i = Number(window.__stepArg || 0);
  window.__map.setView(spots[i], 6, { animate: false });
  window.__map.fire("moveend");
  await s(900);
  return "moved to " + JSON.stringify(spots[i]);
})()
