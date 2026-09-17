/* 性能探针：持续帧率、帧间隔、长任务、DOM 规模、云气层限帧状态
   用法：node tools/cdp.js <url> --eval @tools/probes/perf.js [waitMs]
   返回 Promise，cdp.js 会 awaitPromise 等它跑完。 */
new Promise(function (resolve) {
  var out = { longTasks: [], frames: 0, durMs: 0 };

  /* 长任务（>50ms 阻塞主线程） */
  try {
    new PerformanceObserver(function (list) {
      list.getEntries().forEach(function (e) {
        out.longTasks.push(+e.duration.toFixed(1));
      });
    }).observe({ entryTypes: ["longtask"] });
  } catch (e) { out.longTaskUnsupported = true; }

  /* 连续帧间隔统计 */
  var t0 = performance.now(), times = [];
  function step(now) {
    times.push(now);
    if (now - t0 < 2000) requestAnimationFrame(step);
    else {
      var gaps = [];
      for (var i = 1; i < times.length; i++) gaps.push(times[i] - times[i - 1]);
      gaps.sort(function (a, b) { return a - b; });
      out.frames = times.length;
      out.durMs = Math.round(times[times.length - 1] - times[0]);
      out.fps = Math.round((times.length - 1) / ((times[times.length - 1] - times[0]) / 1000) * 10) / 10;
      out.gapMedianMs = Math.round(gaps[Math.floor(gaps.length / 2)] * 100) / 100;
      out.gapP95Ms = Math.round(gaps[Math.floor(gaps.length * 0.95)] * 100) / 100;
      out.gapMaxMs = Math.round(gaps[gaps.length - 1] * 100) / 100;

      out.perf = window.__perf || null;
      out.domNodes = document.getElementsByTagName("*").length;
      out.markers = document.querySelectorAll(".leaflet-marker-icon").length;
      out.geoLabels = document.querySelectorAll(".geo-label").length;
      var cv = document.querySelectorAll("#atmo canvas, .atmo canvas, canvas");
      var info = [];
      for (var j = 0; j < cv.length; j++) {
        info.push({ w: cv[j].width, h: cv[j].height, display: getComputedStyle(cv[j]).display });
      }
      out.canvases = info;
      out.longTaskCount = out.longTasks.length;
      out.longTaskMaxMs = out.longTasks.length ? Math.max.apply(null, out.longTasks) : 0;
      out.longTaskTotalMs = Math.round(out.longTasks.reduce(function (a, b) { return a + b; }, 0) * 10) / 10;
      resolve(JSON.stringify(out));
    }
  }
  requestAnimationFrame(step);
})
