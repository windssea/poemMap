/* ============================================================
   右侧详情抽屉
   ----------------------------------------------------------
   · 磨砂玻璃（CSS 给 backdrop-filter），地图山水从纸面透过来
   · 宽度由中间那首竖排诗撑出来，标题与注解区自动跟着同宽
   · 竖向不出现滚动条：正文超出时只隐藏滚动条兜底，不裁切内容
   ============================================================ */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useStore, closeDetail, toggleNotes } from "../store.js";
import { POEM_BY_ID, AUTHORS, tagsOf, POEMS, AUTHOR_COUNT } from "../data/index.js";
import { PLACE_BY_ID } from "../data/places.js";
import { PLACES } from "../data/places.js";
import { eraOf } from "../data/eras.js";
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
     溢出时才挂 .scrollable：左缘渐隐 + 一句提示，读的人知道还有下文。 */
  const [scrollable, setScrollable] = useState(false);

  const p = poemId ? POEM_BY_ID[poemId] : null;
  const node = p ? PLACE_BY_ID[p.__placeId] : null;
  const author = p ? (AUTHORS[p.author] || {}) : {};
  const on = !!p;
  const rest = node && p ? node.poems.filter(function (q) { return q.id !== p.id; }) : [];

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

  /* 量一次诗栏是否横向溢出；换诗、改窗口、展开注释都要重量
     （展开注释会改抽屉宽度，诗栏的可用宽度跟着变） */
  useLayoutEffect(function () {
    const el = poemRef.current;
    if (!el) { setScrollable(false); return; }
    function measure() {
      setScrollable(el.scrollWidth > el.clientWidth + 2);
    }
    measure();
    window.addEventListener("resize", measure);
    return function () { window.removeEventListener("resize", measure); };
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
                <p className="d-scrollhint" aria-hidden="true">展卷 · 左右拖动读全文</p>
              )}

              <div className="d-where">
                <IconPin />
                <b id="dPlaceName">{node ? node.name : p.place.name}</b>
                <span id="dPlaceRegion">（{p.place.region || ""}）</span>
              </div>
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
