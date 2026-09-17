/* ============================================================
   开发期诊断钩子
   ----------------------------------------------------------
   地图 / 云气 / 动效是命令式模块，tools/ 下的无头探针（cdp.js +
   qa-*.js）需要直接够到它们。生产构建里 import.meta.env.DEV 为 false，
   整段会被打掉——所以线上不会有任何全局泄漏。
   ============================================================ */
import L from "leaflet";
import { MOTION } from "./engine/motion.js";
import { ATMOSPHERE } from "./engine/atmosphere.js";
import { TERRAIN } from "./engine/terrain.js";
import { THUMBS } from "./engine/thumbs.js";
import { getState } from "./store.js";
import { PLACES, PLACE_BY_ID } from "./data/places.js";
import { POEMS, POEM_BY_ID } from "./data/index.js";
import { selectFiltered } from "./data/select.js";

export function exposeDiagnostics() {
  if (!import.meta.env.DEV) return;
  window.L = L;
  window.MOTION = MOTION;
  window.ATMOSPHERE = ATMOSPHERE;
  window.TERRAIN = TERRAIN;
  window.THUMBS = THUMBS;
  window.__store = getState;          // 状态快照（tools/steps/_pre.js 里的 __state 是 DOM 快照，两者不冲突）
  window.__select = selectFiltered;
  window.__poems = POEMS;
  window.__poemById = POEM_BY_ID;
  window.__places = PLACES;
  window.__placeById = PLACE_BY_ID;
}
