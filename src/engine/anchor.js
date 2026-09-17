/* ============================================================
   定位：诗词卡 · 多地浮层
   ----------------------------------------------------------
   与旧版算法一致，只把「问 DOM」换成「读登记表」。
   卡片摆在**地图可视区正中**（可视区＝篇目栏右侧 → 屏幕右缘，
   上下让开工具条与底栏），不再吸附地标。
   浮层仍贴着地标弹出——它是「从这一处挑一首」，指向性更重要。
   ============================================================ */
import { els, mapRef } from "./refs.js";
import { narrow } from "../lib/dom.js";

/** 可视区：左让开篇目栏、上让开题名与工具条、下让开底栏 */
function viewBox() {
  const sideOpen = document.body.classList.contains("side-open");
  const sideW = els.sidebar ? els.sidebar.offsetWidth : 0;
  return {
    left: sideOpen && !narrow() ? sideW + 34 : 18,
    right: window.innerWidth - 24,
    top: 84,
    bottom: window.innerHeight - 24,
  };
}

/** 诗词卡居中 */
export function placeCard() {
  const card = els.card;
  if (!card || !card.classList.contains("on")) return;
  if (narrow()) {                     // 窄屏由 CSS 贴底，别写内联定位
    card.style.left = "";
    card.style.top = "";
    card.style.removeProperty("--card-w");
    return;
  }
  const b = viewBox();
  /* 宽上限交给可视区：篇目栏展开时可视区变窄，卡不能顶到右缘外
     （只压 --card-w，CSS 里还有 min(..., 100vw - 44px) 兜底） */
  card.style.setProperty("--card-w", Math.round(b.right - b.left) + "px");
  const w = card.offsetWidth, h = card.offsetHeight;

  let left = b.left + (b.right - b.left - w) / 2;
  left = Math.max(b.left, Math.min(left, b.right - w));   // 卡比可视区宽时靠左
  let top = b.top + (b.bottom - b.top - h) / 2;
  top = Math.max(b.top, Math.min(top, b.bottom - h));

  card.style.left = Math.round(left) + "px";
  card.style.top = Math.round(top) + "px";
}

/** 多地浮层贴着地标弹出 */
export function placePoemList(node) {
  const list = els.poemList;
  if (!list || !node) return;
  if (narrow()) {
    list.style.left = "14px";
    list.style.right = "14px";
    list.style.top = "auto";
    list.style.bottom = "64px";
    return;
  }
  const map = mapRef.map;
  if (!map) return;
  const w = list.offsetWidth, h = list.offsetHeight;
  const pt = map.latLngToContainerPoint([node.lat, node.lng]);

  let left = pt.x + 22;
  if (left + w > window.innerWidth - 16) left = pt.x - w - 22;
  left = Math.max(16, Math.min(left, window.innerWidth - w - 16));
  let top = pt.y - 24;
  top = Math.max(96, Math.min(top, window.innerHeight - h - 16));

  list.style.left = Math.round(left) + "px";
  list.style.top = Math.round(top) + "px";
  list.style.right = "auto";
  list.style.bottom = "auto";
}
