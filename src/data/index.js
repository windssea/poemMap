/* ============================================================
   数据入口：把各分册汇总成运行期的单一数据源
   ----------------------------------------------------------
   诗词按「先唐 → 唐 → 宋」的时间顺序拼接：地图上的地标是
   按首次出现顺序建 id 的，把更早的朝代放前面，地标 id 才稳定
   对应「从古到今」的次序。
   ============================================================ */
import AUTHORS from "./authors.js";
import POEM_TAGS from "./tags.js";
import { PRE_POEMS } from "./poems.pre.js";
import { TANG_POEMS } from "./poems.tang.js";
import { SONG_POEMS } from "./poems.song.js";
import CHINA_GEO from "./china.geo.js";
import GEO_EXTRAS from "./geo-extras.js";
import { eraOf } from "./eras.js";

export { AUTHORS, POEM_TAGS, CHINA_GEO, GEO_EXTRAS, PRE_POEMS, TANG_POEMS, SONG_POEMS };

/** 全部诗词（先唐 → 唐 → 宋） */
export const POEMS = PRE_POEMS.concat(TANG_POEMS, SONG_POEMS);

/** id → 诗作 */
export const POEM_BY_ID = POEMS.reduce(function (m, p) {
  m[p.id] = p;
  return m;
}, {});

/** 主题标签：id → string[] */
export function tagsOf(id) {
  return POEM_TAGS[id] || [];
}

/** 时代组统计：{ 先唐, 唐, 宋 }，键与 data/eras.js 的 ERAS 一致 */
export const ERA_COUNT = POEMS.reduce(function (m, p) {
  const e = eraOf(p.dynasty);
  m[e] = (m[e] || 0) + 1;
  return m;
}, {});

/** 体裁统计：{ 诗, 词 } */
export const FORM_COUNT = POEMS.reduce(function (m, p) {
  m[p.form] = (m[p.form] || 0) + 1;
  return m;
}, {});

/** 作者人数 */
export const AUTHOR_COUNT = new Set(POEMS.map(function (p) { return p.author; })).size;
