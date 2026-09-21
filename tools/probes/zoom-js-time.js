/* 缩放的耗时到底在 JS 还是在浏览器渲染？
   ----------------------------------------------------------
   这决定了「缓存几何」有没有用：
     · 如果耗时在 JS（投影 / 拼 path 字符串）→ 缓存几何能直接省掉
     · 如果耗时在浏览器（setAttribute 触发的样式重算与重绘）→
       缓存 JS 侧的东西一点用没有，只能减路径数或换渲染方式
   做法：把 Leaflet 渲染链上的几个函数包一层计时，再跑一次缩放，
   把「JS 累计耗时」与「帧间隔」放在一起看。

   用法：node tools/cdp.js <url> --eval "@tools/probes/zoom-js-time.js" 7000 */
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const raf = () => new Promise((r) => requestAnimationFrame(r));
  const map = window.__map;
  if (!map || !window.L) return JSON.stringify({ error: "缺少 __map 或 L" });

  const acc = { project: 0, projectN: 0, updatePoly: 0, updatePolyN: 0, updatePaths: 0, updatePathsN: 0 };

  function wrap(obj, name, key, nkey) {
    const orig = obj[name];
    if (!orig) return false;
    obj[name] = function () {
      const t0 = performance.now();
      const r = orig.apply(this, arguments);
      acc[key] += performance.now() - t0;
      acc[nkey]++;
      return r;
    };
    return true;
  }

  const ok = {
    projectLatlngs: wrap(L.Polyline.prototype, "_projectLatlngs", "project", "projectN"),
    svgUpdatePoly: wrap(L.SVG.prototype, "_updatePoly", "updatePoly", "updatePolyN"),
    rendererUpdatePaths: wrap(L.Renderer.prototype, "_updatePaths", "updatePaths", "updatePathsN"),
  };

  const reset = () => Object.keys(acc).forEach((k) => (acc[k] = 0));

  async function run(ms) {
    const gaps = [];
    let last = performance.now();
    const t0 = last;
    const p = (async () => {
      while (performance.now() - t0 < ms) { await raf(); const n = performance.now(); gaps.push(n - last); last = n; }
    })();
    await sleep(50);
    map.zoomIn(0.6);
    await p;
    gaps.shift();
    const s = gaps.slice().sort((a, b) => a - b);
    return {
      p95: +(s[Math.floor(s.length * 0.95)] || 0).toFixed(1),
      max: +Math.max(...gaps).toFixed(1),
      frameTotal: +gaps.reduce((a, b) => a + b, 0).toFixed(1),
      frames: gaps.length,
    };
  }

  const out = { wrapped: ok, trials: [] };
  map.setZoom(4.3, { animate: false });
  await sleep(500);

  for (let i = 0; i < 4; i++) {
    reset();
    const f = await run(900);
    out.trials.push({
      ...f,
      jsProject: +acc.project.toFixed(1), projectCalls: acc.projectN,
      jsUpdatePoly: +acc.updatePoly.toFixed(1), updatePolyCalls: acc.updatePolyN,
      jsUpdatePaths: +acc.updatePaths.toFixed(1), updatePathsCalls: acc.updatePathsN,
      jsTotal: +(acc.project + acc.updatePoly + acc.updatePaths).toFixed(1),
    });
    await sleep(320);
    map.zoomOut(0.6);
    await sleep(320);
  }

  /* 汇总：JS 占总帧时的比例 */
  const t = out.trials;
  out.summary = {
    avgP95: +(t.reduce((a, b) => a + b.p95, 0) / t.length).toFixed(1),
    avgMax: +(t.reduce((a, b) => a + b.max, 0) / t.length).toFixed(1),
    avgJsTotal: +(t.reduce((a, b) => a + b.jsTotal, 0) / t.length).toFixed(1),
    avgFrameTotal: +(t.reduce((a, b) => a + b.frameTotal, 0) / t.length).toFixed(1),
  };
  out.summary.jsShareOfFrames = +(out.summary.avgJsTotal / out.summary.avgFrameTotal * 100).toFixed(1) + "%";
  return JSON.stringify(out, null, 1);
})()
