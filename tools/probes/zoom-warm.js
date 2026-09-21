/* 缩放的尖峰是一次性的「预热」，还是每次都有？
   ----------------------------------------------------------
   这决定了该怎么修：
     · 一次性  → 启动时先偷偷做一次缩放把它预热掉，用户就再也碰不到
     · 每次都有 → 只能从「点更少 / 换渲染器」下手
   用法：node tools/cdp.js <url> --eval "@tools/probes/zoom-warm.js" 7000 */
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const raf = () => new Promise((r) => requestAnimationFrame(r));
  const map = window.__map;
  if (!map) return JSON.stringify({ error: "没有 window.__map" });

  async function oneZoom(dir) {
    const gaps = [];
    let last = performance.now();
    const t0 = last;
    const p = (async () => {
      while (performance.now() - t0 < 1000) {
        await raf();
        const now = performance.now();
        gaps.push(now - last);
        last = now;
      }
    })();
    await sleep(50);
    if (dir > 0) map.zoomIn(0.6); else map.zoomOut(0.6);
    await p;
    gaps.shift();
    const s = gaps.slice().sort((a, b) => a - b);
    return {
      p95: +(s[Math.floor(s.length * 0.95)] || 0).toFixed(1),
      max: +Math.max(...gaps).toFixed(1),
      over100: gaps.filter((g) => g > 100).length,
    };
  }

  const out = { rounds: [] };
  map.setZoom(4.3, { animate: false });
  await sleep(500);

  /* 连续放大 5 次，再连续缩小 5 次，看尖峰是否衰减 */
  for (let i = 0; i < 5; i++) {
    out.rounds.push({ dir: "in" + (i + 1), ...(await oneZoom(1)) });
    await sleep(320);
  }
  for (let i = 0; i < 5; i++) {
    out.rounds.push({ dir: "out" + (i + 1), ...(await oneZoom(-1)) });
    await sleep(320);
  }
  return JSON.stringify(out, null, 1);
})()
