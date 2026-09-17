/* ============================================================
   性能探针（配合 tools/cdp.js 使用，不参与站点运行）
   ----------------------------------------------------------
   量三件事：
     1) 空转帧时间 baseline
     2) 模拟地图拖动（直接改中心、抑制 Leaflet 事件）→ 只测「光栅化」
     3) 拖动 + move 事件 → 额外叠加「地名签避让」开销
   再量一次关闭云气层后的同一负载，用来分辨瓶颈在 SVG 还是 WebGL。

   用法：
     node tools/cdp.js http://127.0.0.1:5179/ --eval "@tools/qa-perf.js" 6000
   ============================================================ */
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const map = window.__map;
  const L = window.L;
  if (!map) return { error: "no map" };

  function stat(d) {
    d = d.slice().sort((a, b) => a - b);
    const avg = d.reduce((a, b) => a + b, 0) / d.length;
    return {
      avg: +avg.toFixed(2),
      p50: +d[Math.floor(d.length * 0.5)].toFixed(2),
      p95: +d[Math.floor(d.length * 0.95)].toFixed(2),
      max: +d[d.length - 1].toFixed(2),
    };
  }
  function run(frames, step) {
    return new Promise((res) => {
      const ts = [];
      let i = 0;
      (function f() {
        ts.push(performance.now());
        if (step) { try { step(i); } catch (e) { /* 忽略单帧异常 */ } }
        i++;
        if (i < frames) requestAnimationFrame(f);
        else {
          const d = [];
          for (let k = 1; k < ts.length; k++) d.push(ts[k] - ts[k - 1]);
          res(stat(d));
        }
      })();
    });
  }

  const c0 = map.getCenter();
  const z0 = map.getZoom();
  const at = (i) => L.latLng(c0.lat + Math.sin(i * 0.006) * 0.6, c0.lng + i * 0.012);

  const out = {};
  out.atmo = window.ATMOSPHERE ? window.ATMOSPHERE.stats() : null;
  out.geom = (function () {
    const panes = ["prov", "terrain", "hydro", "wall", "geoLabels"];
    const g = {};
    panes.forEach(function (p) {
      const pane = map.getPane(p);
      const paths = pane ? pane.querySelectorAll("path") : [];
      let len = 0;
      for (let i = 0; i < paths.length; i++) len += (paths[i].getAttribute("d") || "").length;
      g[p] = { nodes: paths.length, pathChars: len, filter: pane ? pane.style.filter : "" };
    });
    g.markers = document.querySelectorAll(".mk-wrap").length;
    return g;
  })();

  out.idle = await run(40);

  // 拖动：只动中心（suppress event）→ 只测光栅 + Leaflet 变换
  out.drag_raster = await run(70, (i) => { map._move(at(i), z0, undefined, true); });

  // 拖动 + move 事件 → 叠加地名签避让
  out.drag_events = await run(70, (i) => { map._move(at(i), z0, undefined, true); map.fire("move"); });

  // 关掉云气层对照
  const atmoOn = !!(window.ATMOSPHERE && window.ATMOSPHERE.enabled);
  if (window.ATMOSPHERE && window.ATMOSPHERE.ok) {
    window.ATMOSPHERE.setEnabled(false);
    await sleep(350);
    out.drag_events_noAtmo = await run(70, (i) => { map._move(at(i), z0, undefined, true); map.fire("move"); });
    out.idle_noAtmo = await run(40);
    if (atmoOn) { window.ATMOSPHERE.setEnabled(true); await sleep(350); }
  }

  // 地名签避让单次开销（直接量函数本体）
  if (window.__layout) {
    const t = [];
    for (let k = 0; k < 25; k++) { const a = performance.now(); window.__layout(); t.push(performance.now() - a); }
    const s = stat(t);
    out.layout = { perCall_ms: s.avg, p95_ms: s.p95, repeats: 25 };
  }

  map.setView(c0, z0, { animate: false });
  return out;
})();
