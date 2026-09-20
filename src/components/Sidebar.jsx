/* ============================================================
   左侧篇目栏（默认收起，从左下 dock 的「篇目」唤出）
   ----------------------------------------------------------
   300 行篇目，每行带一幅程序生成的小景。所以这里做了三件事：
     1. 小景 SVG 按篇目 id 全局缓存，筛来筛去不必重画；
     2. 行组件 memo 化——选中项一变只有两行重渲染，其余 298 行动都不动；
     3. 选中项自动滚进视野 + ↑↓ 键上下走，不必先用鼠标去够。
   ============================================================ */
import { memo, useCallback, useEffect, useRef } from "react";
import { useStore, toggleDynasty } from "../store.js";
import { placeText } from "../data/select.js";
import { ERAS } from "../data/eras.js";
import { ERA_COUNT } from "../data/index.js";
import { useFilteredPoems } from "../hooks/useFiltered.js";
import { THUMBS } from "../engine/thumbs.js";
import { els } from "../engine/refs.js";
import { MOTION } from "../engine/motion.js";
import { goToPoem } from "../actions.js";
import { IconChevron, IconPin } from "./icons.jsx";

const TABS = ERAS;

/* 小景：一首诗一辈子只画一次 */
const thumbCache = new Map();
function thumbOf(p) {
  let s = thumbCache.get(p.id);
  if (s === undefined) {
    s = THUMBS.svg(p);
    thumbCache.set(p.id, s);
  }
  return s;
}

/** 把命中的那几个字标出来。搜「李白」时整屏都是行，
    没有高亮就得自己逐行去找那两个字在哪。 */
function Hl({ text, q }) {
  if (!q) return text;
  const i = String(text).toLowerCase().indexOf(q);
  if (i === -1) return text;
  const s = String(text);
  return (
    <>
      {s.slice(0, i)}
      <mark className="hl">{s.slice(i, i + q.length)}</mark>
      {s.slice(i + q.length)}
    </>
  );
}

const Item = memo(function Item({ poem, on, pick, q }) {
  const place = placeText(poem);
  return (
    <button className={"item" + (on ? " on" : "")} type="button" data-id={poem.id}
      onClick={() => pick(poem.id)}>
      <span className="thumb" dangerouslySetInnerHTML={{ __html: thumbOf(poem) }} />
      <span className="it-main">
        <span className="it-t"><Hl text={poem.title} q={q} /></span>
        <span className="it-a">
          <Hl text={poem.dynasty + " · " + poem.author} q={q} />
        </span>
        <span className="it-p">
          <IconPin />
          <Hl text={place} q={q} />
        </span>
      </span>
      <IconChevron />
    </button>
  );
});

export default function Sidebar() {
  const dynasty = useStore("dynasty");
  const openPoemId = useStore("openPoemId");
  const sideOpen = useStore("sideOpen");
  const q = useStore("q");
  const ref = useRef(null);
  const listRef = useRef(null);
  const list = useFilteredPoems();
  const needle = (q || "").trim().toLowerCase();

  useEffect(function () {
    els.sidebar = ref.current;
    return function () { els.sidebar = null; };
  }, []);

  const pick = useCallback(function (id) {
    /* 目录只定位到地标，不打开抽屉 */
    goToPoem(id);
  }, []);

  /* 选中项滚进视野：点索引面板跳过来、或按 ↑↓ 时，
     选中行可能在一屏之外，不滚过去等于没选中 */
  useEffect(function () {
    if (!openPoemId || !sideOpen) return;
    const box = listRef.current;
    if (!box) return;
    const el = box.querySelector('[data-id="' + openPoemId + '"]');
    if (!el) return;
    const b = box.getBoundingClientRect(), r = el.getBoundingClientRect();
    if (r.top >= b.top && r.bottom <= b.bottom) return;   // 已经看得见，别乱滚
    box.scrollTop += (r.top - b.top) - (b.height - r.height) / 2;
  }, [openPoemId, sideOpen]);

  /* ↑↓ 上下走篇目。页面本身不滚动（body overflow:hidden），
     所以这两个键不会和「翻页」打架。 */
  useEffect(function () {
    if (!sideOpen) return;
    function onKey(e) {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (!list.length) return;
      e.preventDefault();
      const cur = list.findIndex(function (p) { return p.id === openPoemId; });
      let n;
      if (cur === -1) n = e.key === "ArrowDown" ? 0 : list.length - 1;
      else n = Math.max(0, Math.min(list.length - 1, cur + (e.key === "ArrowDown" ? 1 : -1)));
      if (list[n]) pick(list[n].id);
    }
    document.addEventListener("keydown", onKey);
    return function () { document.removeEventListener("keydown", onKey); };
  }, [sideOpen, list, openPoemId, pick]);

  return (
    <aside id="sidebar" ref={ref} aria-label="篇目索引">
      <div className="tabs" id="tabs" role="group" aria-label="按朝代筛选">
        {TABS.filter(function (t) {
          /* 先唐页签只在全库真有先唐作品时出现。
             判据必须用全量计数而不是当前筛选结果——否则一筛到唐诗，
             这个页签自己就消失，再也切不回去。 */
          return t.val !== "先唐" || (ERA_COUNT.先唐 || 0) > 0;
        }).map(function (t) {
          return (
            <button key={t.val} type="button" data-val={t.val}
              aria-pressed={dynasty === t.val}
              onClick={() => toggleDynasty(t.val)}>
              {t.label}
            </button>
          );
        })}
        <span className="tabs-n" title="当前筛选下的篇目数">{list.length} 首</span>
      </div>

      <div className="side-list" id="list" ref={listRef}>
        {list.length ? (
          list.map(function (p) {
            return <Item key={p.id} poem={p} on={p.id === openPoemId} pick={pick} q={needle} />;
          })
        ) : (
          <div className="side-empty">没有找到呢。<br />换个关键词，或试试「全部」。</div>
        )}
      </div>

      {/* 键盘提示：↑↓ 这两个键不写出来没人会去试 */}
      <div className="side-foot" aria-hidden="true">
        <kbd>↑</kbd><kbd>↓</kbd> 浏览 · <kbd>↵</kbd> 定位
      </div>
    </aside>
  );
}
