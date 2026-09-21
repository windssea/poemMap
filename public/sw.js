/* ============================================================
   Service Worker：本地缓存
   ----------------------------------------------------------
   这个应用的数据全部随包发布（325 首诗词 + 155 个地标 + 索引），
   所以「本地缓存」要解决的不是「少下载数据」，而是两件更实在的事：

     ① 二次打开**不再重新下载与解析** —— 资源走 cache-first，
        命中的话连网络都不碰
     ② **断网也能打开** —— 这本来就是「全离线」这个定位该有的能力，
        在此之前它只是「不需要后端」，断网还是白屏

   策略（刻意简单，不做 precache manifest）：
     · 导航请求（HTML）  network-first，失败回落缓存 ——
       保证拿到最新版本，同时断网可用
     · 同源静态资源       cache-first —— 文件名带内容哈希，
       内容一变文件名就变，所以「缓存优先」不会拿到旧代码
     · 其它（跨域等）     不拦截

   ⚠️ 为什么不用 Workbox / vite-plugin-pwa：
     本项目有成文约束「依赖极少、全离线、零外链」。一个 SW 文件
     （不到 100 行、无依赖）就够了，引入构建插件反而是负担。
     哈希文件名让 cache-first 天然安全，不需要版本清单。

   ⚠️ 改这个文件后必须**改 CACHE 版本号**，否则 activate 里的
     清理逻辑不会淘汰旧缓存。开发环境（vite dev）不注册，见 main.jsx。
   ============================================================ */

const CACHE = "poemmap-v2";

/* 安装：立刻接管，不等旧页面关闭 */
self.addEventListener("install", function (e) {
  self.skipWaiting();
});

/* 激活：清掉非当前版本的缓存 */
self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  /* 只碰同源。外链一概不拦——本项目本来也没有外链，这行是保险 */
  if (url.origin !== self.location.origin) return;

  e.respondWith((async function () {
    /* 导航请求：network-first，断网回落缓存 */
    if (req.mode === "navigate") {
      try {
        const res = await fetch(req);
        const copy = res.clone();
        await put(req, copy);
        return res;
      } catch (err) {
        return (await caches.match(req)) || (await caches.match("/index.html"));
      }
    }

    /* 静态资源：cache-first。文件名带内容哈希，所以不会拿到旧代码 */
    const hit = await caches.match(req);
    if (hit) return hit;
    const res = await fetch(req);
    /* 只缓存成功的同源响应；opaque / 错误响应不入库 */
    if (res && res.status === 200 && res.type === "basic") {
      await put(req, res.clone());
    }
    return res;
  })());
});

/* ⚠️ 必须 await 写完再返回响应。
   原来写成 `caches.open(CACHE).then(c => c.put(...))` 不 await——
   响应先回、写在后台跑，结果是「刚请求过的资源，此刻 caches.match 还查不到」。
   实测就是这么翻车的：assetNowCached 一直是 false。
   写入本身很快（本地），等它的代价远小于「缓存状态不可预测」。 */
async function put(req, res) {
  try {
    const c = await caches.open(CACHE);
    await c.put(req, res);
  } catch (err) {
    /* 存不下就算了（配额、不可缓存的请求头等），不能因此让响应失败 */
  }
}
