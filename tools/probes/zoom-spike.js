/* 尖峰到底来自哪一类矢量？逐类摘掉再缩放。
   ----------------------------------------------------------
   上一次按「矢量 / 地标」粗分，只知道是矢量。矢量里有三类：
     prov/grad     34 个省区面，各引用 url(#pg<adcode>) 渐变
     terrain/grad  44 个山体面，各引用 url(#rg*) 渐变
     terrain/solid 纯色描边（皴线 / 脊线 / 受光 / 山脚雾）
   代码注释里前人已经量过「渐变面每次重绘要按各自包围盒重算，帧耗时 8.9→20.8ms」，
   这里直接验证它是不是尖峰的来源。
   用法：node tools/cdp.js <url> --eval "@tools/probes/zoom-spike.js" 7000 */
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const raf = () => new Promise((r) => requestAnimationFrame(r));
  const map = window.__map;
  if (!map) return JSON.stringify({ error: "没有 window.__map" });

  const cats = { provGrad: [], terGrad: [], terSolid: [], hydro: [], wall: [] };
  map.eachLayer(function (l) {
    if (!(l instanceof L.Polyline || l instanceof L.Polygon)) return;
    const pane = l.options.pane;
    const grad = l.options.fillColor && String(l.options.fillColor).startsWith("url(");
    if (pane === "prov" && grad) cats.provGrad.push(l);
    else if (pane === "terrain" && grad) cats.terGrad.push(l);
    else if (pane === "terrain") cats.terSolid.push(l);
    else if (pane === "hydro") cats.hydro.push(l);
    else if (pane === "wall") cats.wall.push(l);
  });

  async function trial(n) {
    const res = [];
    for (let i = 0; i < n; i++) {
      const gaps = [];
      let last = performance.now();
      const t0 = last;
      const p = (async () => {
        while (performance.now() - t0 < 900) { await raf(); const now = performance.now(); gaps.push(now - last); last = now; }
      })();
      await sleep(40);
      map.zoomIn(0.5);
      await p;
      gaps.shift();
      res.push(Math.max(...gaps));
      await sleep(300);
      map.zoomOut(0.5);
      await sleep(300);
    }
    res.sort((a, b) => a - b);
    return { maxOfMax: +res[res.length - 1].toFixed(0), medianMax: +res[Math.floor(res.length / 2)].toFixed(0) };
  }

  const out = {};
  map.setZoom(4.3, { animate: false });
  await sleep(500);
  out.all = await trial(5);

  /* 只摘省区渐变面 */
  cats.provGrad.forEach((l) => map.removeLayer(l));
  await sleep(400);
  out.withoutProvGrad = await trial(5);
  cats.provGrad.forEach((l) => map.addLayer(l));
  await sleep(400);

  /* 只摘山体渐变面 */
  cats.terGrad.forEach((l) => map.removeLayer(l));
  await sleep(400);
  out.withoutTerGrad = await trial(5);
  cats.terGrad.forEach((l) => map.addLayer(l));
  await sleep(400);

  /* 只摘纯色描边 */
  cats.terSolid.forEach((l) => map.removeLayer(l));
  await sleep(400);
  out.withoutTerSolid = await trial(5);
  cats.terSolid.forEach((l) => map.addLayer(l));

  out.counts = Object.keys(cats).reduce((a, k) => (a[k] = cats[k].length, a), {});
  return JSON.stringify(out, null, 1);
})()
