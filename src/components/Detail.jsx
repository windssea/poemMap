/* ============================================================
   右侧详情抽屉
   ----------------------------------------------------------
   · 磨砂玻璃（CSS 给 backdrop-filter），地图山水从纸面透过来
   · 宽度由中间那首竖排诗撑出来，标题与注解区自动跟着同宽
   · 竖向不出现滚动条：正文超出时只隐藏滚动条兜底，不裁切内容
   ============================================================ */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useStore, closeDetail, toggleNotes, openDetail } from "../store.js";
import { POEM_BY_ID, AUTHORS, tagsOf, POEMS, AUTHOR_COUNT } from "../data/index.js";
import { PLACE_BY_ID } from "../data/places.js";
import { PLACES } from "../data/places.js";
import { eraOf } from "../data/eras.js";
import { useFilteredPoems } from "../hooks/useFiltered.js";
import { MOTION } from "../engine/motion.js";
import { getEngine } from "../engine/mapEngine.js";
import { backToPlaceList } from "../actions.js";
import { IconChevronDown, IconClose, IconPin } from "./icons.jsx";

export default function Detail() {
  const poemId = useStore("detailPoemId");
  const notesOpen = useStore("notesOpen");
  const bodyRef = useRef(null);
  const ref = useRef(null);
  const poemRef = useRef(null);
  /* 长诗竖排会横向溢出（88 句的《琵琶行》要「展卷」才读得完）。
     溢出时才挂 .scrollable：左缘渐隐 + 一句提示 + 一条进度，读的人知道还有多少。 */
  const [scrollable, setScrollable] = useState(false);
  const [progress, setProgress] = useState(0);

  const p = poemId ? POEM_BY_ID[poemId] : null;
  const node = p ? PLACE_BY_ID[p.__placeId] : null;
  const author = p ? (AUTHORS[p.author] || {}) : {};
  const on = !!p;
  const rest = node && p ? node.poems.filter(function (q) { return q.id !== p.id; }) : [];

  /* 上一篇 / 下一篇按**当前筛选结果**的顺序走：
     筛了「宋词」就只在宋词里翻，不会突然跳到一首唐诗。
     正在读的那首被筛掉时（App 会把抽屉收掉）这里退回 -1，两个按钮自然置灰。 */
  const list = useFilteredPoems();
  const pos = p ? list.findIndex(function (x) { return x.id === p.id; }) : -1;
  const prev = pos > 0 ? list[pos - 1] : null;
  const next = pos >= 0 && pos < list.length - 1 ? list[pos + 1] : null;

  function go(target) {
    if (!target) return;
    const n = PLACE_BY_ID[target.__placeId];
    /* 只在换了地标时才飞过去——同一处连着翻几首，画面不该一直晃 */
    if (n && (!node || n.id !== node.id)) {
      const e = getEngine();
      if (e) e.goToPlace(n.id);
    }
    openDetail(target.id, n ? n.id : undefined);
  }

  useEffect(function () {
    if (on && MOTION.on && ref.current) MOTION.cardIn(ref.current);
  }, [on, poemId]);

  /* 换一首就回到顶部 */
  useLayoutEffect(function () {
    if (on && bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [on, poemId]);

  /* 抽屉一开，把地标挪进「没被抽屉挡住的那块画面」。
     等一帧：抽屉此刻刚拿到 .on，offsetWidth 才是最终宽度。 */
  useEffect(function () {
    if (!on || !node) return;
    const e = getEngine();
    if (!e || !e.revealPlace) return;
    const t = setTimeout(function () { e.revealPlace(node.id); }, 60);
    return function () { clearTimeout(t); };
  }, [on, poemId, node]);

  /* 键盘 ←/→ 翻篇。焦点在输入框里时不抢。 */
  useEffect(function () {
    if (!on) return;
    function onKey(e) {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); go(prev); }
      else if (e.key === "ArrowRight") { e.preventDefault(); go(next); }
    }
    document.addEventListener("keydown", onKey);
    return function () { document.removeEventListener("keydown", onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, prev, next, node]);

  /* 量一次诗栏是否横向溢出 + 重置进度；换诗、改窗口、展开注释都要重量
     （展开注释会改抽屉宽度，诗栏的可用宽度跟着变） */
  useLayoutEffect(function () {
    const el = poemRef.current;
    if (!el) { setScrollable(false); setProgress(0); return; }
    function measure() {
      const over = el.scrollWidth - el.clientWidth;
      setScrollable(over > 2);
      /* 竖排右起：第一列在最右，未读的在左边。
         scrollLeft 从 0（最右）向负方向走，所以进度取 |scrollLeft| / 溢出量。 */
      setProgress(over > 2 ? Math.min(1, Math.abs(el.scrollLeft) / over) : 0);
    }
    el.scrollLeft = 0;
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return function () {
      el.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [on, poemId, notesOpen]);

  return (
    <aside id="detail" ref={ref} className={on ? "on" : ""} aria-hidden={!on} aria-label="诗词详情">
      <button id="detailClose" className="panel-close" type="button" aria-label="关闭" onClick={closeDetail}>
        <IconClose />
      </button>

      <div className="detail-body" ref={bodyRef}>
        <div className="d-col">
          {p && (
            <>
              <header className="d-head">
                <h2 id="dTitle">{p.title}</h2>
                <p id="dSub" className="d-sub">{p.dynasty} · {p.author}</p>
                <button id="btnMore" className="d-more" type="button"
                  aria-expanded={notesOpen} onClick={toggleNotes}>
                  <span>{notesOpen ? "收起注释" : "查看完整注释"}</span>
                  <IconChevronDown />
                </button>
              </header>

              <p id="dPrologue" className="d-prologue" hidden={!p.prologue}>{p.prologue}</p>

              <div id="dPoem" ref={poemRef}
                className={"d-poem" + (scrollable ? " scrollable" : "")}>
                {p.lines.map(function (l, i) {
                  return <span className="line" key={i}>{l}</span>;
                })}
              </div>
              {scrollable && (
                <div className="d-scrollbar" aria-hidden="true">
                  <span className="ds-track">
                    <span className="ds-fill" style={{ transform: "scaleX(" + progress.toFixed(3) + ")" }} />
                  </span>
                  <span className="ds-text">展卷 · 左右拖动读全文</span>
                </div>
              )}

              <div className="d-where">
                <IconPin />
                <b id="dPlaceName">{node ? node.name : p.place.name}</b>
                <span id="dPlaceRegion">（{p.place.region || ""}）</span>
              </div>

              {/* 上一篇 / 下一篇：按当前筛选顺序翻，编号让人知道「读到哪了」 */}
              <nav className="d-nav" aria-label="篇目翻页">
                <button type="button" className="dn-btn" disabled={!prev}
                  title={prev ? "上一篇：" + prev.title + "（←）" : "已经是第一篇"}
                  onClick={() => go(prev)}>
                  <span className="dn-ar">‹</span>
                  <span className="dn-t">{prev ? prev.title : "已是首篇"}</span>
                </button>
                <span className="dn-pos" title="当前筛选下的位置">
                  {pos >= 0 ? pos + 1 : "—"}<i>/</i>{list.length}
                </span>
                <button type="button" className="dn-btn dn-next" disabled={!next}
                  title={next ? "下一篇：" + next.title + "（→）" : "已经是最后一篇"}
                  onClick={() => go(next)}>
                  <span className="dn-t">{next ? next.title : "已是末篇"}</span>
                  <span className="dn-ar">›</span>
                </button>
              </nav>
              <div id="dTags" className="d-tags">
                {tagsOf(p.id).map(function (t) { return <span key={t}>{t}</span>; })}
              </div>
              {!!rest.length && (
                <div className="d-others">
                  <button type="button" className="others-more"
                    onClick={() => backToPlaceList(node.id)}>
                    此处另有 {rest.length} 首 ›
                  </button>
                </div>
              )}

              <section className="sec">
                <h3>诗意简析</h3>
                <p id="dTr">{p.tr}</p>
              </section>

              <div id="dMore" className="d-more-body" hidden={!notesOpen}>
                <section className="sec">
                  <h3>字词注释</h3>
                  <dl id="dNotes" className="d-notes">
                    {p.notes.reduce(function (acc, n, i) {
                      acc.push(<dt key={"t" + i}>{n[0]}</dt>);
                      acc.push(<dd key={"d" + i}>{n[1]}</dd>);
                      return acc;
                    }, [])}
                  </dl>
                </section>
                <section className="sec">
                  <h3>赏析</h3>
                  <p id="dAppr">{p.appr}</p>
                </section>
                <section className="sec" id="dOriginSec" hidden={!p.place.origin}>
                  <h3>写作背景</h3>
                  <p id="dOrigin">{p.place.origin}</p>
                </section>
              </div>

              <section className="sec sec-author">
                <h3>作者</h3>
                <p id="dBio">
                  <b>{p.author}{author.years ? "（" + author.years + "）" : ""}</b>
                  　{author.bio || "暂无介绍。"}
                </p>
              </section>

              {/* 落款：给长抽屉一个「读到尾」的收束。
                  没有它，短诗下面会剩一大片空纸，看着像内容没加载完。 */}
              <footer className="d-colophon" aria-hidden="true">
                <span className="dc-rule" />
                <span className="dc-seal">{eraOf(p.dynasty) === "先唐" ? "古" : p.dynasty}</span>
                <span className="dc-text">
                  {p.dynasty} · {p.form} · {node ? node.name : p.place.name}
                </span>
                <span className="dc-meta">
                  中华诗词地图 · 全离线收录 {POEMS.length} 首 / {PLACES.length} 处地标 / {AUTHOR_COUNT} 位作者
                </span>
              </footer>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
