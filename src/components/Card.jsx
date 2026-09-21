/* ============================================================
   中央诗词卡（点诗已改为直接开抽屉，本组件默认不再打开）
   ----------------------------------------------------------
   · 诗文**一律竖排、从右到左**（与古籍一致，没有横排分支）
   · 卡片居中于「地图可视区」，位置由 anchor.placeCard() 命令式计算
   · 打开详情抽屉或多地浮层时自动让位（同一时刻只留一张主面板）
   ============================================================ */
import { useEffect, useLayoutEffect, useRef } from "react";
import { useStore, closeCard, openDetail } from "../store.js";
import { POEM_BY_ID } from "../data/index.js";
import { PLACE_BY_ID } from "../data/places.js";
import { tagsOf } from "../data/index.js";
import { placeLabel } from "../data/select.js";
import { els } from "../engine/refs.js";
import { placeCard } from "../engine/anchor.js";
import { MOTION } from "../engine/motion.js";
import { backToPlaceList } from "../actions.js";
import { IconClose, IconPin } from "./icons.jsx";

export default function Card() {
  const openPoemId = useStore("openPoemId");
  const poemListPlaceId = useStore("poemListPlaceId");
  const detailPoemId = useStore("detailPoemId");
  const sideOpen = useStore("sideOpen");
  const ref = useRef(null);

  const poem = openPoemId ? POEM_BY_ID[openPoemId] : null;
  /* 地标由「诗」反推，而不是读 activePlaceId——
     否则点了另一处地标后，卡片会串用新地标的地名 */
  const node = poem ? PLACE_BY_ID[poem.__placeId] : null;
  /* 中央卡片已停用：openPoemId 现在只表示目录选中 / 抽屉在读，不再弹卡 */
  const on = false;
  const rest = node ? node.poems.filter(function (q) { return q.id !== poem.id; }) : [];
  /* 长词（18 句起）把列收紧一档，好在常见窗口里整首读完（见 style.css .c-poem.is-long） */
  const long = !!poem && poem.lines.length >= 18;

  useEffect(function () {
    els.card = ref.current;
    return function () { els.card = null; };
  }, []);

  /* 开合、篇目栏展开、窗口变化都要重新居中 */
  useLayoutEffect(function () {
    if (on) placeCard();
  }, [on, sideOpen, poem, poemListPlaceId]);

  useEffect(function () {
    if (on && MOTION.on && ref.current) MOTION.cardIn(ref.current);
  }, [on, poem]);

  return (
    <section id="card" ref={ref} aria-hidden={!on} aria-live="polite"
      /* ⚠️ 光有 aria-hidden 不够。
         `on` 恒为 false，卡片靠 opacity:0 + scale(.975) 藏起来——
         它**没有** display:none 也没有 visibility:hidden，所以里面
         「收起」与「此处另有 N 首」两颗按钮照旧在 Tab 序里：
         键盘用户会停在一个完全看不见的按钮上。
         inert 才是真的把这棵子树从焦点与辅助技术里摘出去。
         （顺带一提：它还往 DOM 里塞了第二颗 .others-more，
          任何 `document.querySelector('.others-more')` 都会先抓到它。） */
      inert={!on}
      className={on ? "on" : ""}>
      <button id="cardClose" className="card-close" type="button" aria-label="收起" onClick={closeCard}>
        <IconClose />
      </button>

      {poem && (
        <>
          <span className="c-seal" aria-hidden="true">题</span>
          <header className="c-head">
            <h2 id="cardTitle">{poem.title}</h2>
            <p id="cardSub" className="c-sub">{poem.dynasty} · {poem.author}</p>
          </header>

          <div id="cardPoem" className={long ? "c-poem is-long" : "c-poem"}>
            {poem.lines.map(function (l, i) {
              return <span className="col" key={i}>{l}</span>;
            })}
          </div>

          <div className="c-body">
            <div className="c-meta">
              <span className="c-place">
                <IconPin />
                <span id="cardPlace">{placeLabel(node)}</span>
              </span>
              <span id="cardTags" className="c-tags">
                {tagsOf(poem.id).map(function (t) { return <span key={t}>{t}</span>; })}
              </span>
            </div>

            <div className="c-rule" aria-hidden="true" />

            <section className="c-sec">
              <h3>诗意简析</h3>
              <p id="cardTr">{poem.tr}</p>
            </section>

            <button id="cardMore" className="c-link" type="button" onClick={() => openDetail(poem.id)}>
              查看完整注解 <i>→</i>
            </button>

            <div id="cardOthers" className="c-others" hidden={!rest.length}>
              {!!rest.length && (
                <button type="button" className="others-more" data-act="list"
                  onClick={() => backToPlaceList(node.id)}>
                  此处另有 {rest.length} 首 ›
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
