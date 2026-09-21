/* 缩放卡顿：定位到底是谁
   ----------------------------------------------------------
   第一次测量已经排除了 layoutLabels（缩放时只跑 1 次、1.3ms），
   但 zoomIn 里出现了一帧 347ms。所以卡的是别的东西。
   这里用**消融法**：把地图上的图层按类逐个摘掉再缩放，看哪一类摘掉之后不卡。
   比读代码猜快得多，也比 CPU profile 好解释。

   用法：node tools/cdp.js <url> --eval "@tools/probes/zoom-ablate.js" 7000 */
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const raf = () => new Promise((r) => requestAnimationFrame(r));
  const map = window.__map;
  if (!map) return JSON.stringify({ error: "没有 window.__map" });

  async function record(ms) {
    const gaps = [];
    let last = performance.now();
    const t0 = last;
    while (performance.now() - t0 < ms) {
      await raf();
      const now = performance.now();
      gaps.push(now - last);
      last = now;
    }
    gaps.shift();
    const s = gaps.slice().sort((a, b) => a - b);
    return {
      p95: +(s[Math.floor(s.length * 0.95)] || 0).toFixed(1),
      max: +Math.max(...gaps).toFixed(1),
      over33: gaps.filter((g) => g > 33).length,
      over100: gaps.filter((g) => g > 100).length,
    };
  }

  /* 先给图层分类计数 */
  const kinds = {};
  const groups = { line: [], marker: [], other: [] };
  map.eachLayer(function (l) {
    let k = "other";
    if (l instanceof L.Marker) { k = "marker"; groups.marker.push(l); }
    else if (l instanceof L.Polyline || l instanceof L.Polygon) {
      k = "line";
      groups.line.push(l);
    } else groups.other.push(l);
    kinds[k] = (kinds[k] || 0) + 1;
  });

  /* 数一下矢量路径的总点数——这是 SVG 重绘的主要成本来源 */
  let totalPts = 0, maxPts = 0;
  groups.line.forEach(function (l) {
    const ll = l.getLatLngs ? l.getLatLngs() : [];
    const flat = Array.isArray(ll[0]) ? (Array.isArray(ll[0][0]) ? ll.flat(2) : ll.flat(1)) : ll;
    totalPts += flat.length;
    if (flat.length > maxPts) maxPts = flat.length;
  });

  const out = { layerKinds: kinds, vectorPoints: { total: totalPts, max: maxPts } };

  async function zoomTwice(label) {
    map.setZoom(4.3, { animate: false });
    await sleep(320);
    const a = record(1100);
    await sleep(40);
    map.zoomIn(0.8);
    const r1 = await a;
    await sleep(420);
    const b = record(1100);
    await sleep(40);
    map.zoomOut(0.8);
    const r2 = await b;
    await sleep(420);
    return { in: r1, out: r2 };
  }

  /* ① 全量基线 */
  out.baseline = await zoomTwice("baseline");

  /* ② 摘掉所有矢量线（省区 / 山体 / 水系 / 长城） */
  groups.line.forEach(function (l) { map.removeLayer(l); });
  await sleep(420);
  out.withoutVectors = await zoomTwice("no-vectors");

  /* ③ 矢量加回来，摘掉地标 */
  groups.line.forEach(function (l) { map.addLayer(l); });
  groups.marker.forEach(function (l) { map.removeLayer(l); });
  await sleep(420);
  out.withoutMarkers = await zoomTwice("no-markers");

  /* ④ 都加回来 */
  groups.marker.forEach(function (l) { map.addLayer(l); });
  await sleep(420);
  out.restored = await zoomTwice("restored");

  return JSON.stringify(out, null, 1);
})()
