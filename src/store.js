/* ============================================================
   状态中枢（单一数据源）
   ----------------------------------------------------------
   界面的一切「当前状态」都放这里：筛选、选中、卡片、浮层、抽屉、
   面板、篇目栏、动效开关、轻提示。React 用 useStore(key) 订阅，
   地图引擎用 subscribe(fn) 订阅，两边拿到的是同一份真相。

   只存**原始状态**，派生数据（筛选结果、可见地标）由
   data/select.js 的纯函数现算，避免两份状态互相打架。
   ============================================================ */
import { useSyncExternalStore } from "react";

/** 动效开关的初值：以 <html> 上的类为准（index.html 内联脚本已按系统偏好定过） */
function initialMotion() {
  if (typeof document === "undefined") return true;
  return document.documentElement.classList.contains("motion-on");
}

const state = {
  /* 筛选 */
  q: "",
  dynasty: "全部",
  form: "全部",
  author: "",
  tag: "",

  /* 选中与面板 */
  openPoemId: null,        // 当前选中的诗（篇目高亮 / 抽屉正在读的）
  activePlaceId: null,     // 选中的地标
  poemListPlaceId: null,   // 多地浮层对应的地标
  detailPoemId: null,      // 抽屉打开的诗（null = 抽屉关着）
  notesOpen: false,        // 抽屉内「完整注释」是否展开
  panel: null,             // null | "list" | "poet" | "theme"
  sideOpen: false,         // 左侧篇目栏
  menuOpen: false,         // 右上「更多」菜单

  /* 其他 */
  motionOn: initialMotion(),
  toast: null,             // { msg, at }
  perfLevel: "full",       // full | reduced | off（自适应降载结果）
};

const listeners = new Set();

export function getState() {
  return state;
}

export function subscribe(fn) {
  listeners.add(fn);
  return function () { listeners.delete(fn); };
}

/* ---------------- 写 ---------------- */
export function setState(patch) {
  let changed = false;
  for (const k in patch) {
    if (!Object.is(state[k], patch[k])) { changed = true; break; }
  }
  if (!changed) return;
  Object.assign(state, patch);
  listeners.forEach(function (fn) { fn(); });
}

/** React 订阅：只订阅关心的那个键，其他键变化不会触发重渲染 */
export function useStore(key) {
  return useSyncExternalStore(subscribe, function () { return state[key]; });
}

/* ---------------- 动作：筛选 ---------------- */
export const setQuery = (v) => setState({ q: v });

/** 页签/筛选条：再点一次同一个值 = 取消（「全部」除外） */
export function toggleDynasty(v) {
  setState({ dynasty: state.dynasty === v && v !== "全部" ? "全部" : v });
}
export function toggleForm(v) {
  setState({ form: state.form === v && v !== "全部" ? "全部" : v });
}
export const setDynasty = (v) => setState({ dynasty: v });
export const setForm = (v) => setState({ form: v });
export const setAuthor = (v) => setState({ author: v, tag: "", panel: "list" });
export const setTag = (v) => setState({ tag: v, author: "" });
export const clearFacets = () => setState({ author: "", tag: "" });

/* ---------------- 动作：地标 / 卡片 / 浮层 ---------------- */
/* 点某一首诗一律进右侧抽屉，不再经过中央卡片。
   中央卡片组件仍留在树上（旧路径 / 探针兜底），但本动作不再打开它。 */
export function openCard(placeId, poemId) {
  if (poemId) { openDetail(poemId, placeId); return; }
  setState({
    activePlaceId: placeId,
    openPoemId: null,
    poemListPlaceId: null,
  });
}

export function closeCard() {
  setState({ activePlaceId: null, openPoemId: null, poemListPlaceId: null });
}

export function openPoemList(placeId) {
  setState({
    activePlaceId: placeId,
    poemListPlaceId: placeId,
    /* 浮层是「挑一首」，把正在读的抽屉收掉，免得列表和详情叠在一起 */
    detailPoemId: null,
    notesOpen: false,
    openPoemId: null,
  });
}

export function closePoemList() {
  setState({ poemListPlaceId: null });
}

/** 只点亮地标与篇目，不打开抽屉（左侧目录用） */
export function locatePoem(placeId, poemId) {
  setState({
    activePlaceId: placeId || null,
    openPoemId: poemId || null,
    detailPoemId: null,
    notesOpen: false,
    poemListPlaceId: null,
  });
}

/* ---------------- 动作：抽屉 ---------------- */
/** 开抽屉。placeId 可选：从地标/篇目进来时顺手把地标点亮 */
export function openDetail(poemId, placeId) {
  setState({
    detailPoemId: poemId,
    /* 篇目栏 / 索引用来高亮「正在读的这首」 */
    openPoemId: poemId,
    activePlaceId: placeId || state.activePlaceId,
    notesOpen: false,
    /* 进详情即收起浮层：画面只留一张抽屉 */
    poemListPlaceId: null,
  });
}

export function closeDetail() {
  /* 一并清掉 openPoemId：否则关抽屉会留下「正在看这首」的状态，
     中央卡片那条旧显示条件会把它弹出来。 */
  setState({ detailPoemId: null, notesOpen: false, openPoemId: null });
}

/* 点地图空白：卡片 / 多地浮层 / 抽屉**一次性**收起。
   ----------------------------------------------------------
   ⚠️ 必须是「一次 setState」，不能写成 closeCard() + closePoemList() + closeDetail()
   分三次提交——中间态会让浮层/抽屉各自闪一帧。一次写完就没有这个中间态。

   两个入口共用本动作（引擎的 map.on("click") 与 App 的 pointerdown 兜底），
   谁先跑谁清干净，后跑的因状态无变化而被 setState 的 changed 判断直接挡掉。 */
export function dismissOverlays() {
  setState({
    activePlaceId: null,
    openPoemId: null,
    poemListPlaceId: null,
    detailPoemId: null,
    notesOpen: false,
  });
}

export const toggleNotes = () => setState({ notesOpen: !state.notesOpen });

/* ---------------- 动作：面板 / 侧栏 / 菜单 ---------------- */
export const openPanel = (mode) => setState({ panel: mode });
export const closePanel = () => setState({ panel: null });
export const toggleSide = () => setState({ sideOpen: !state.sideOpen });
export const closeSide = () => setState({ sideOpen: false });
export const toggleMenu = () => setState({ menuOpen: !state.menuOpen });
export const closeMenu = () => setState({ menuOpen: false });

/* ---------------- 动作：动效 / 提示 / 降载 ---------------- */
export const setMotionOn = (on) => setState({ motionOn: !!on });
export const setPerfLevel = (lv) => setState({ perfLevel: lv });

let toastSeq = 0;
export function showToast(msg, ms) {
  setState({ toast: { msg: msg, at: ++toastSeq, ms: ms || 2200 } });
}

/* ---------------- 便捷派生 ---------------- */
export const isDetailOpen = () => state.detailPoemId !== null;
