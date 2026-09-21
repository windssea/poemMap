/* ============================================================
   派生计算（纯函数）
   ----------------------------------------------------------
   React 与地图引擎共用同一套筛选逻辑，保证「侧栏列出的」与
   「地图上点亮的」永远是同一批诗。
   ============================================================ */
import { POEMS, POEM_TAGS } from "./index.js";
import { PLACES } from "./places.js";
import { inEra } from "./eras.js";
import { schoolOf } from "./schools.js";

/** 按筛选条件取诗（与旧版 filtered() 完全一致的匹配规则） */
export function selectFiltered(s) {
  const q = (s.q || "").trim().toLowerCase();
  return POEMS.filter(function (p) {
    if (!inEra(p.dynasty, s.dynasty)) return false;
    if (s.form !== "全部" && p.form !== s.form) return false;
    if (s.author && p.author !== s.author) return false;
    if (s.school && schoolOf(p.author) !== s.school) return false;
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

/* 诗人 / 主题索引：**算一次就够**
   ----------------------------------------------------------
   POEMS 是模块级常量，运行期不会变，所以这两个索引是纯派生数据。
   原来每次调用都全量遍历 325 首——而 Panel.jsx 是在渲染里直接调的，
   等于每开一次面板、每换一次筛选都要重算一遍。
   改成惰性缓存：第一次调用时算，之后直接返回同一个数组。
   （不冻结返回值：调用方只读，但冻结会在 dev 里把 map/sort 也挡掉，得不偿失。） */
let _poetIndex = null;
let _themeIndex = null;

/** 诗人索引：姓名 → 首数（按首数降序） */
export function poetIndex() {
  if (_poetIndex) return _poetIndex;
  const counts = {};
  POEMS.forEach(function (p) { counts[p.author] = (counts[p.author] || 0) + 1; });
  _poetIndex = Object.keys(counts)
    .sort(function (a, b) { return counts[b] - counts[a]; })
    .map(function (name) { return { name: name, count: counts[name] }; });
  return _poetIndex;
}

/** 主题索引：标签 → 首数（按首数降序） */
export function themeIndex() {
  if (_themeIndex) return _themeIndex;
  const counts = {};
  POEMS.forEach(function (p) {
    (POEM_TAGS[p.id] || []).forEach(function (t) { counts[t] = (counts[t] || 0) + 1; });
  });
  _themeIndex = Object.keys(counts)
    .sort(function (a, b) { return counts[b] - counts[a]; })
    .map(function (tag) { return { tag: tag, count: counts[tag] }; });
  return _themeIndex;
}
