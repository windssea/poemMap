/* ============================================================
   派生计算（纯函数）
   ----------------------------------------------------------
   React 与地图引擎共用同一套筛选逻辑，保证「侧栏列出的」与
   「地图上点亮的」永远是同一批诗。
   ============================================================ */
import { POEMS, POEM_TAGS } from "./index.js";
import { PLACES } from "./places.js";
import { inEra } from "./eras.js";

/** 按筛选条件取诗（与旧版 filtered() 完全一致的匹配规则） */
export function selectFiltered(s) {
  const q = (s.q || "").trim().toLowerCase();
  return POEMS.filter(function (p) {
    if (!inEra(p.dynasty, s.dynasty)) return false;
    if (s.form !== "全部" && p.form !== s.form) return false;
    if (s.author && p.author !== s.author) return false;
    if (s.tag && (POEM_TAGS[p.id] || []).indexOf(s.tag) === -1) return false;
    if (q) {
      const hay = (
        p.title + " " + p.author + " " + p.dynasty + p.form + " " +
        (p.lines || []).join("") + " " +
        (p.place.name || "") + " " + (p.place.region || "")
      ).toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  });
}

/** 篇目行的地点文案：省份里已含地名时不重复 */
export function placeText(p) {
  const region = p.place.region || "";
  const name = p.place.name || "";
  if (!name || region.indexOf(name) !== -1) return region;
  return region + "（" + name + "）";
}

/** 地标文案：省份（地名） */
export function placeLabel(node) {
  return node.region + "（" + node.name + "）";
}

/** 由筛选结果推出「哪些地标还亮着」 */
export function visiblePlaceIds(poems) {
  const alive = new Set();
  poems.forEach(function (p) { alive.add(p.__placeId); });
  return alive;
}

export function visiblePlaces(poems) {
  const alive = visiblePlaceIds(poems);
  return PLACES.filter(function (n) { return alive.has(n.id); });
}

/** 诗人索引：姓名 → 首数（按首数降序） */
export function poetIndex() {
  const counts = {};
  POEMS.forEach(function (p) { counts[p.author] = (counts[p.author] || 0) + 1; });
  return Object.keys(counts)
    .sort(function (a, b) { return counts[b] - counts[a]; })
    .map(function (name) { return { name: name, count: counts[name] }; });
}

/** 主题索引：标签 → 首数（按首数降序） */
export function themeIndex() {
  const counts = {};
  POEMS.forEach(function (p) {
    (POEM_TAGS[p.id] || []).forEach(function (t) { counts[t] = (counts[t] || 0) + 1; });
  });
  return Object.keys(counts)
    .sort(function (a, b) { return counts[b] - counts[a]; })
    .map(function (tag) { return { tag: tag, count: counts[tag] }; });
}
