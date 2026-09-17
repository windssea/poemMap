/* ============================================================
   地标聚合：同一处的诗词并为一个地标
   ----------------------------------------------------------
   合并阈值 0.15° 纬 / 0.2° 经（约 15–20 公里），与旧版一致。
   结果按首次出现的顺序稳定生成，保证地标 id 不变（书签可用）。
   ============================================================ */
import { POEMS } from "./index.js";

const LAT_TOL = 0.15;
const LNG_TOL = 0.2;

/** 计数（保留首次出现的顺序） */
function tally(list) {
  const count = {};
  list.forEach(function (v) { count[v] = (count[v] || 0) + 1; });
  return count;
}

/** 地名去重：取最多的一个；并列时取**字面更短**的（如「黄州」优于「湖北·黄州」） */
function pickName(list) {
  const count = tally(list);
  let best = null;
  Object.keys(count).forEach(function (k) {
    if (best === null || count[k] > count[best] || (count[k] === count[best] && k.length < best.length)) {
      best = k;
    }
  });
  return best;
}

/** 省份去重：取最多的一个；并列时取**先出现**的（与旧版排序取首一致） */
function pickRegion(list) {
  const count = tally(list);
  return Object.keys(count).sort(function (a, b) { return count[b] - count[a]; })[0] || "";
}

export const PLACES = (function buildPlaces() {
  const nodes = [];
  POEMS.forEach(function (p) {
    let hit = null;
    for (let i = 0; i < nodes.length; i++) {
      const c = nodes[i];
      if (Math.abs(c.lat - p.place.lat) < LAT_TOL && Math.abs(c.lng - p.place.lng) < LNG_TOL) {
        hit = c;
        break;
      }
    }
    if (!hit) {
      hit = { id: "pl" + nodes.length, lat: p.place.lat, lng: p.place.lng, poems: [] };
      nodes.push(hit);
    }
    hit.poems.push(p);
  });

  nodes.forEach(function (n) {
    /* 地标坐标取该处所有诗作的平均 */
    n.lat = n.poems.reduce(function (s, p) { return s + p.place.lat; }, 0) / n.poems.length;
    n.lng = n.poems.reduce(function (s, p) { return s + p.place.lng; }, 0) / n.poems.length;
    n.name = pickName(n.poems.map(function (p) { return p.place.name; }));
    /* 省份取出现最多的那个 */
    n.region = pickRegion(n.poems.map(function (p) { return p.place.region; }));
    n.poems.forEach(function (p) { p.__placeId = n.id; });
  });

  return nodes;
})();

export const PLACE_BY_ID = PLACES.reduce(function (m, n) {
  m[n.id] = n;
  return m;
}, {});

/** 地标数量 */
export const PLACE_COUNT = PLACES.length;
