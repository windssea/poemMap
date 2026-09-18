/* ============================================================
   右侧详情抽屉
   ----------------------------------------------------------
   · 磨砂玻璃（CSS 给 backdrop-filter），地图山水从纸面透过来
   · 宽度由中间那首竖排诗撑出来，标题与注解区自动跟着同宽
   · 竖向不出现滚动条：正文超出时只隐藏滚动条兜底，不裁切内容
   ============================================================ */
import { useEffect, useLayoutEffect, useRef } from "react";
import { useStore, closeDetail, toggleNotes } from "../store.js";
import { POEM_BY_ID, AUTHORS, tagsOf } from "../data/index.js";
import { PLACE_BY_ID } from "../data/places.js";
import { MOTION } from "../engine/motion.js";
import { backToPlaceList } from "../actions.js";
import { IconChevronDown, IconClose, IconPin } from "./icons.jsx";

export default function Detail() {
  const poemId = useStore("detailPoemId");
  const notesOpen = useStore("notesOpen");
  const bodyRef = useRef(null);
  const ref = useRef(null);

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

              <div id="dPoem" className="d-poem">
                {p.lines.map(function (l, i) {
                  return <span className="line" key={i}>{l}</span>;
                })}
              </div>

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
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
