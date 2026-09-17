/* 交互延迟探针：点「宋」筛选，量 React 重渲染到列表刷新的耗时 + 期间长任务
   用法：node tools/cdp.js <url> --eval @tools/probes/interact.js [waitMs] */
new Promise(function (resolve) {
  var longTasks = [];
  try {
    new PerformanceObserver(function (l) {
      l.getEntries().forEach(function (e) { longTasks.push(+e.duration.toFixed(1)); });
    }).observe({ entryTypes: ["longtask"] });
  } catch (e) {}

  var out = {};
  var q = function (s) { return document.querySelector(s); };

  /* 先量一次基线：篇目条数与地标数 */
  out.before = {
    items: document.querySelectorAll("#list .item").length,
    dots: document.querySelectorAll(".dot").length,
    statPoems: (function () { var e = q("#statPoems"); return e ? e.textContent : null; })(),
  };

  /* 找到「宋」这个 chip */
  var chips = document.querySelectorAll("#tools .chips button");
  var chip = null;
  for (var i = 0; i < chips.length; i++) {
    if (chips[i].textContent.indexOf("宋") > -1) { chip = chips[i]; break; }
  }
  if (!chip) { out.error = "chip-not-found"; out.chips = [].map.call(chips, function (c) { return c.textContent; }); resolve(JSON.stringify(out)); return; }

  var t0 = performance.now();
  chip.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));

  /* 轮询到列表条数变化为止 */
  var deadline = t0 + 1500;
  (function poll() {
    var n = document.querySelectorAll("#list .item").length;
    if ((n !== out.before.items && n > 0) || performance.now() > deadline) {
      out.switchLatencyMs = Math.round((performance.now() - t0) * 10) / 10;
      /* 再等两帧，让样式/布局落定 */
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          out.after = {
            items: document.querySelectorAll("#list .item").length,
            dots: document.querySelectorAll(".dot").length,
            statPoems: (function () { var e = q("#statPoems"); return e ? e.textContent : null; })(),
            statPlaces: (function () { var e = q("#statPlaces"); return e ? e.textContent : null; })(),
            chipActive: chip.getAttribute("aria-pressed") || chip.className,
          };
          out.longTaskCount = longTasks.length;
          out.longTaskMaxMs = longTasks.length ? Math.max.apply(null, longTasks) : 0;
          out.longTasks = longTasks;
          resolve(JSON.stringify(out));
        });
      });
    } else requestAnimationFrame(poll);
  })();
})
