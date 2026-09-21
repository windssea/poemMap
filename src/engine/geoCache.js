/* ============================================================
   地图几何缓存
   ----------------------------------------------------------
   ⚠️ 先说结论，免得后来的人对它抱错期望：
   实测（tools/probes/zoom-js-time.js）缩放一次，Leaflet 渲染链上的
   JS 总耗时只有 **8.5ms**（投影 7.5ms + 拼 path 字符串 1.6ms），
   而同期帧间隔合计 **893ms** —— JS 只占 **1%**。
   也就是说：**这个文件能省的最多就是那 1%**。
   缩放的耗时在浏览器那边（159 条 SVG 路径的样式重算与重绘，
   其中 34 个省区路径各引用一个 objectBoundingBox 渐变，最贵）。

   那为什么还要写它？因为它省的是**真浪费**，而且几乎零风险：
   Leaflet 每次重投影都会重新做一遍球面墨卡托投影
   （每点一次 log + tan）。而这一步**只跟经纬度有关**——
   与缩放级别、与平移都无关。同一个点无论重投影多少次，
   结果都一样。所以用 WeakMap 按 LatLng 对象记下来。

   WeakMap 而不是 Map：键是 LatLng 实例，用 WeakMap 才不会
   把已经不在用的点一直留在内存里。图层是静态的，
   _latlngs 里的对象在多次重投影之间是同一批，命中率接近 100%。

   用法：在 mapEngine 里 import 一次即可（有副作用）。
   ============================================================ */
import L from "leaflet";

/* ⚠️ 缓存的是**数值**，不是 Point 实例。这一点是这个文件里最要紧的事。
   ------------------------------------------------------------
   Leaflet 的 Transformation._transform 是**破坏性**的（源码注释就写着
   "destructive transform (faster)"）：

       _transform: function (point, scale) {
         point.x = scale * (this._a * point.x + this._b);   // 就地改
         point.y = scale * (this._c * point.y + this._d);
         return point;
       }

   而 CRS.latLngToPoint 正是把 projection.project() 的返回值喂给它。
   所以如果缓存并返回**同一个 Point 实例**，它会被反复就地变换：
   第一次是「投影 → 缩放」，第二次拿到的已经是缩放过的值，再缩一次……
   于是所有坐标滚成一团。实测症状：生产构建里 34 个省区路径全部塌成
   一个点——`d="M712 403L712 403z"`（零面积），整张地图空白。

   写这个缓存时的推理是「project() 是纯函数，可以安全缓存」。
   推理没错，但**调用方不纯**：它改了返回值。缓存共享可变对象，
   等于把「纯函数」变成了「有状态函数」。
   现在只存 x/y 两个数，每次返回一个新 Point，下游怎么改都无所谓。 */

const cache = new WeakMap();
let hits = 0, misses = 0;

const orig = L.Projection.SphericalMercator.project;

L.Projection.SphericalMercator.project = function (latlng) {
  const hit = cache.get(latlng);
  if (hit !== undefined) {
    hits++;
    return new L.Point(hit.x, hit.y);
  }
  misses++;
  const p = orig.call(this, latlng);
  cache.set(latlng, { x: p.x, y: p.y });
  return p;                       // 首次的 p 还没被别人改过，可以直接给
};

/* 诊断：命中率。tools/probes/zoom-js-time.js 会读它 */
if (typeof window !== "undefined") {
  Object.defineProperty(window, "__geoCache", {
    get: function () {
      return {
        hits: hits, misses: misses,
        rate: hits + misses ? +(hits / (hits + misses) * 100).toFixed(1) + "%" : "—",
        size: "WeakMap（不可枚举）",
      };
    },
  });
}
