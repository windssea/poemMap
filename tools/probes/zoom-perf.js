/* 缩放卡顿测量
   ----------------------------------------------------------
   光看帧率只知道「卡」，看不出「卡在谁身上」。这里一边做一次真实的
   放大动画，一边逐帧记 rAF 间隔，同时读引擎内部的调用计数：
     __mk.layout   layoutLabels 跑了几次（每次 = 155 次三角换算 + 排序 + O(n²) 碰撞 + DOM 写）
     __mk.rove     syncRove 跑了几次
     __mk.layoutMs layoutLabels 累计耗时
   用法：node tools/cdp.js <url> --eval "@tools/probes/zoom-perf.js" 7000 */
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const raf = () => new Promise((r) => requestAnimationFrame(r));
  const map = window.__map;
  if (!map) return JSON.stringify({ error: "没有 window.__map" });

  const reset = () => { if (window.__mk) { window.__mk.layout = 0; window.__mk.rove = 0; window.__mk.layoutMs = 0; window.__mk.layoutMax = 0; } };
  const snap = () => (window.__mk ? { ...window.__mk } : null);

  /* 逐帧采样：记录每次 rAF 的间隔 */
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
    gaps.shift();                                  // 丢掉第一次
    const sorted = gaps.slice().sort((a, b) => a - b);
    const p = (q) => sorted[Math.floor(sorted.length * q)] || 0;
    return {
      frames: gaps.length,
      avg: +(gaps.reduce((a, b) => a + b, 0) / gaps.length).toFixed(2),
      p50: +p(0.5).toFixed(2),
      p95: +p(0.95).toFixed(2),
      max: +Math.max(...gaps).toFixed(2),
      over33: gaps.filter((g) => g > 33).length,   // 掉到 30fps 以下的帧
      over50: gaps.filter((g) => g > 50).length,
    };
  }

  const out = { startZoom: +map.getZoom().toFixed(2) };

  /* 基线：静止时的帧间隔 */
  reset();
  out.idle = await record(900);
  out.idle.mk = snap();

  /* 放大一次（zoomIn 走 Leaflet 的平滑缩放动画） */
  reset();
  const p1 = record(1400);
  await sleep(60);
  map.zoomIn(0.8);
  out.zoomIn = await p1;
  out.zoomIn.mk = snap();
  out.zoomIn.endZoom = +map.getZoom().toFixed(2);

  await sleep(500);

  /* 缩小一次 */
  reset();
  const p2 = record(1400);
  await sleep(60);
  map.zoomOut(0.8);
  out.zoomOut = await p2;
  out.zoomOut.mk = snap();

  await sleep(400);

  /* 纯平移做对照 */
  reset();
  const p3 = record(1400);
  await sleep(60);
  map.panBy([260, 90], { animate: true, duration: 0.8 });
  out.pan = await p3;
  out.pan.mk = snap();

  return JSON.stringify(out, null, 1);
})()
