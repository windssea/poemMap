/* 空转负载：只等 2 秒，不改地图。用来量「没人操作时」的常驻开销
   （云气层全屏 WebGL + 若干 backdrop-filter 的逐帧重算）。
   用法： CDP_TRACE=1 node tools/cdp.js <url> --eval "@tools/qa-idle.js" 5000        */
(async () => {
  const frame = () => new Promise((r) => requestAnimationFrame(r));
  const t0 = performance.now();
  let n = 0;
  while (performance.now() - t0 < 2000) { await frame(); n++; }
  await new Promise((r) => setTimeout(r, 100));
  return {
    frames: n,
    wallMs: +(performance.now() - t0).toFixed(1),
    atmo: window.ATMOSPHERE ? window.ATMOSPHERE.stats() : null,
  };
})();
