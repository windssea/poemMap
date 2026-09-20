/* ============================================================
   左侧篇目栏（默认收起，从左下 dock 的「篇目」唤出）
   ----------------------------------------------------------
   153 行篇目，每行带一幅程序生成的小景。所以这里做了两件事：
     1. 小景 SVG 按篇目 id 全局缓存，筛来筛去不必重画；
     2. 行组件 memo 化——选中项一变只有两行重渲染，其余 151 行动都不动。
   ============================================================ */
import { memo, useCallback, useEffect, useRef } from "react";
import { useStore, toggleDynasty } from "../store.js";
import { placeText } from "../data/select.js";
import { ERAS } from "../data/eras.js";
import { ERA_COUNT } from "../data/index.js";
import { useFilteredPoems } from "../hooks/useFiltered.js";
import { THUMBS } from "../engine/thumbs.js";
import { els } from "../engine/refs.js";
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

const Item = memo(function Item({ poem, on, pick }) {
  return (
    <button className={"item" + (on ? " on" : "")} type="button" data-id={poem.id}
      onClick={() => pick(poem.id)}>
      <span className="thumb" dangerouslySetInnerHTML={{ __html: thumbOf(poem) }} />
      <span className="it-main">
        <span className="it-t">{poem.title}</span>
        <span className="it-a">{poem.dynasty} · {poem.author}</span>
        <span className="it-p">
          <IconPin />
          {placeText(poem)}
        </span>
      </span>
      <IconChevron />
    </button>
  );
});

export default function Sidebar() {
  const dynasty = useStore("dynasty");
  const openPoemId = useStore("openPoemId");
  const ref = useRef(null);
  const list = useFilteredPoems();

  useEffect(function () {
    els.sidebar = ref.current;
    return function () { els.sidebar = null; };
  }, []);

  const pick = useCallback(function (id) {
    /* 目录只定位到地标，不打开抽屉 */
    goToPoem(id);
  }, []);

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

      <div className="side-list" id="list">
        {list.length ? (
          list.map(function (p) {
            return <Item key={p.id} poem={p} on={p.id === openPoemId} pick={pick} />;
          })
        ) : (
          <div className="side-empty">没有找到呢。<br />换个关键词，或试试「全部」。</div>
        )}
      </div>
    </aside>
  );
}
