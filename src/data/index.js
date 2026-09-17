/* ============================================================
   数据入口：把各分册汇总成运行期的单一数据源
   ----------------------------------------------------------
   诗词按「唐诗 → 宋词」原顺序拼接，与旧版脚本的加载顺序一致。
   ============================================================ */
import AUTHORS from "./authors.js";
import POEM_TAGS from "./tags.js";
import { TANG_POEMS } from "./poems.tang.js";
import { SONG_POEMS } from "./poems.song.js";
import CHINA_GEO from "./china.geo.js";
import GEO_EXTRAS from "./geo-extras.js";

export { AUTHORS, POEM_TAGS, CHINA_GEO, GEO_EXTRAS, TANG_POEMS, SONG_POEMS };

/** 全部诗词（唐在前、宋在后，与旧版一致） */
export const POEMS = TANG_POEMS.concat(SONG_POEMS);

/** id → 诗作 */
export const POEM_BY_ID = POEMS.reduce(function (m, p) {
  m[p.id] = p;
  return m;
}, {});

/** 主题标签：id → string[] */
export function tagsOf(id) {
  return POEM_TAGS[id] || [];
}

/** 朝代统计 */
export const DYNASTY_COUNT = POEMS.reduce(
  function (m, p) {
    if (p.dynasty === "唐") m.tang++;
    else if (p.dynasty === "宋") m.song++;
    return m;
  },
  { tang: 0, song: 0 }
);

/** 作者人数 */
export const AUTHOR_COUNT = new Set(POEMS.map(function (p) { return p.author; })).size;
