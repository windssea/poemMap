/* ============================================================
   跨层动作
   ----------------------------------------------------------
   有些操作同时牵动「状态」与「地图」（比如点篇目要飞过去点亮地标），
   集中放这里，组件只管调用，不必知道谁负责哪一半。
   ============================================================ */
import { POEMS, POEM_BY_ID, ERA_COUNT, AUTHOR_COUNT, FORM_COUNT } from "./data/index.js";
import { PLACE_BY_ID, PLACE_COUNT } from "./data/places.js";
import { selectFiltered } from "./data/select.js";
import { MOTION } from "./engine/motion.js";
import { ATMOSPHERE } from "./engine/atmosphere.js";
import { getEngine } from "./engine/mapEngine.js";
import {
  getState, openDetail, openPoemList, locatePoem, closePanel, closeMenu,
  dismissOverlays, setMotionOn, showToast, openPanel, toggleSide, setTag,
} from "./store.js";

/** 点地标：一处多诗先列出来，独此一首直接开抽屉 */
export function openPlace(node) {
  if (!node) return;
  if (node.poems.length > 1) openPoemList(node.id);
  else openDetail(node.poems[0].id, node.id);
}

/** 浮动列表里选中一首 → 直接开抽屉 */
export function choosePoem(placeId, poemId) {
  openDetail(poemId, placeId);
}

/** 卡片底部「此处另有 N 首 ›」→ 回到浮层 */
export function backToPlaceList(placeId) {
  openPoemList(placeId);
}

/** 从篇目/索引里挑一首：只飞到地标并点亮，不打开抽屉 */
export function goToPoem(poemId) {
  const p = POEM_BY_ID[poemId];
  if (!p) return;
  const node = PLACE_BY_ID[p.__placeId];
  if (!node) return;
  getEngine() && getEngine().goToPlace(node.id);
  locatePoem(node.id, poemId);
}

/** 换一批：在当前筛选结果里随机点亮一首 */
export function pickRandom() {
  const list = selectFiltered(getState());
  if (!list.length) { showToast("当前筛选下没有诗词"); return; }
  const pick = list[Math.floor(Math.random() * list.length)];
  const node = PLACE_BY_ID[pick.__placeId];
  if (!node) return;
  getEngine() && getEngine().goToPlace(node.id);
  openDetail(pick.id, node.id);
  showToast("偶遇一首：" + pick.title);
}

/** 回到全国 */
export function resetView() {
  dismissOverlays();
  closePanel();
  getEngine() && getEngine().fitChina();
  showToast("已回到全国");
}

/** 动效开关：同时管住 GSAP 与云气层 */
export function toggleMotion() {
  const next = !getState().motionOn;
  MOTION.setEnabled(next);
  if (ATMOSPHERE.ok) ATMOSPHERE.setEnabled(next && MOTION.on);
  setMotionOn(MOTION.on);
  showToast(MOTION.on ? "动效已开启" : "动效已关闭");
}

export function about() {
  const parts = [];
  if (ERA_COUNT.先唐) parts.push("先唐 " + ERA_COUNT.先唐);
  parts.push("唐诗 " + (ERA_COUNT.唐 || 0));
  parts.push("宋词 " + (ERA_COUNT.宋 || 0));
  showToast(
    "收录 " + POEMS.length + " 首（" + parts.join(" · ") + "）· " +
    FORM_COUNT.诗 + " 诗 / " + FORM_COUNT.词 + " 词 · " +
    PLACE_COUNT + " 处地标 · " + AUTHOR_COUNT + " 位作者 · 全部离线",
    4800
  );
}

/** 关闭右上菜单（各处都会顺手调一下） */
export function dismissMenu() {
  closeMenu();
}

/* ---------------- 命令面板用的几个动作 ----------------
   面板是「一句话就能到任何地方」的入口，所以这些动作要自己把
   挡路的浮层收干净，不能指望调用方记得。 */

/** 打开索引面板（顺手收起菜单） */
export function openPanelSafe(mode) {
  closeMenu();
  openPanel(mode);
}

/** 展开 / 收起左侧篇目栏 */
export function toggleSidebar() {
  const open = !getState().sideOpen;
  toggleSide();
  if (open) MOTION.sideIn();
}

/** 按主题筛（顺手把面板开到篇目，让人看见筛出了什么） */
export function focusTag(tag) {
  closeMenu();
  setTag(tag);
  openPanel("list");
}
