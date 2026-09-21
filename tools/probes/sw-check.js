/* Service Worker 实测
   ----------------------------------------------------------
   要验证三件事，缺一不可：
     ① SW 注册成功并接管了页面（navigator.serviceWorker.controller）
     ② 二次加载的资源**来自缓存**（transferSize 为 0 = 没走网络）
     ③ 断网后仍能打开（CDP 里 setOfflineMode）
   只在生产构建 + 预览服务器上成立——vite dev 不注册 SW。

   用法：node tools/cdp.js http://127.0.0.1:4180/ --eval "@tools/probes/sw-check.js" 9000 */
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};

  out.secureContext = window.isSecureContext;
  out.hasSW = "serviceWorker" in navigator;

  const reg = await navigator.serviceWorker.getRegistration();
  out.registered = !!reg;
  if (reg) {
    out.scope = reg.scope;
    out.active = !!reg.active;
    out.activeState = reg.active ? reg.active.state : null;
    out.waiting = !!reg.waiting;
  }

  /* 等 controller：首次注册后要等一个 tick 或 reload 才会接管 */
  out.controller = !!navigator.serviceWorker.controller;
  if (!out.controller) {
    await Promise.race([
      new Promise((r) => navigator.serviceWorker.addEventListener("controllerchange", r, { once: true })),
      sleep(2500),
    ]);
    out.controllerAfterWait = !!navigator.serviceWorker.controller;
  }

  /* 资源是否来自缓存：transferSize === 0 且 decodedBodySize > 0 说明走的是缓存 */
  const res = performance.getEntriesByType("resource");
  out.resourceCount = res.length;
  out.fromCache = res.filter((r) => r.transferSize === 0 && r.decodedBodySize > 0).length;
  out.fromNetwork = res.filter((r) => r.transferSize > 0).length;
  out.samples = res.slice(0, 8).map((r) => ({
    name: r.name.split("/").pop().slice(0, 34),
    transfer: r.transferSize,
    decoded: r.decodedBodySize,
    dur: Math.round(r.duration),
  }));

  /* 缓存里存了什么 */
  if (window.caches) {
    const keys = await caches.keys();
    out.cacheKeys = keys;
    if (keys.length) {
      const c = await caches.open(keys[0]);
      const reqs = await c.keys();
      out.cachedCount = reqs.length;
      out.cachedSample = reqs.slice(0, 6).map((r) => r.url.split("/").pop().slice(0, 34));
    }
  }

  /* ---- 主动走一遍缓存路径 ----
     首次加载的那批请求发生在 SW 接管之前，所以没被拦截（cacheKeys 为空）。
     这里在 SW 已接管的前提下再请求一次，验证它确实进了缓存。 */
  const asset = res.find((r) => /\.js$/.test(r.name) && r.transferSize > 0);
  if (asset) {
    const name = new URL(asset.name).pathname;
    const t0 = performance.now();
    const r1 = await fetch(name, { cache: "no-store" });   // 绕过 HTTP 缓存，强制走 SW
    out.assetFetch1 = { ms: +(performance.now() - t0).toFixed(1), status: r1.status };
    const c = await caches.open((await caches.keys())[0]);
    out.assetNowCached = !!(await c.match(name));

    const t1 = performance.now();
    const r2 = await fetch(name, { cache: "no-store" });
    out.assetFetch2 = { ms: +(performance.now() - t1).toFixed(1), status: r2.status };
    out.secondFasterOrEqual = out.assetFetch2.ms <= out.assetFetch1.ms + 1;
  }

  /* 导航请求也走一遍 */
  try {
    const t2 = performance.now();
    const nav = await fetch("/", { cache: "no-store" });
    out.navFetch = { ms: +(performance.now() - t2).toFixed(1), status: nav.status, type: nav.type };
    const c2 = await caches.open((await caches.keys())[0]);
    out.navNowCached = !!(await c2.match("/"));
  } catch (e) {
    out.navFetch = { error: String(e) };
  }

  return JSON.stringify(out, null, 1);
})()
