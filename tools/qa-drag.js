/* ============================================================
   拖动负载（配合 tools/cdp.js --eval 使用）
   ----------------------------------------------------------
   模拟「连续拖地图」：每帧改中心（抑制 Leaflet 事件）+ 触发 move，
   跑完复位。用 CDP_TRACE=1 套跟踪即可看到这段负载的光栅/合成耗时。

   可选开关（在 driver 里用 CDP_SETUP 或前置 eval 设置）：
     window.__qaFrames     帧数，默认 90
     window.__qaKillFilter = 1 → 关掉 prov / terrain 两个 pane 的 CSS blur，
                            用来 A/B 对比「滤镜 vs 几何羽化」的光栅开销
   ============================================================ */
(async () => {
  const map = window.__map, L = window.L;
  if (!map) return { error: "no map" };
  const N = Number(window.__qaFrames || 90);
  const killed = !!window.__qaKillFilter;
  if (killed) {
    ["prov", "terrain"].forEach((p) => {
      const el = map.getPane(p);
      if (el) el.style.filter = "none";
    });
  }
  const c0 = map.getCenter(), z0 = map.getZoom();
  const frame = () => new Promise((r) => requestAnimationFrame(r));
  const t0 = performance.now();
  for (let i = 0; i < N; i++) {
    await frame();
    map._move(L.latLng(c0.lat + Math.sin(i * 0.006) * 0.5, c0.lng + i * 0.012), z0, undefined, true);
    map.fire("move");
  }
  await new Promise((r) => setTimeout(r, 80));
  const ms = performance.now() - t0;
  map.setView(c0, z0, { animate: false });
  await new Promise((r) => setTimeout(r, 120));
  return {
    frames: N,
    wallMs: +ms.toFixed(1),
    msPerFrame: +(ms / N).toFixed(2),
    killFilter: killed,
    paneFilter: map.getPane("prov").style.filter,
  };
})();
