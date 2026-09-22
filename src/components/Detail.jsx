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
import { useFocusReturn } from "../hooks/useFocusReturn.js";
import { MOTION } from "../engine/motion.js";
import { getEngine } from "../engine/mapEngine.js";
import { backToPlaceList } from "../actions.js";
import { IconChevronDown, IconClose, IconList, IconPin } from "./icons.jsx";

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

  /* 打开时把焦点移进抽屉、关闭时还给打开它的那个地标（C10）。
     抽屉本身 tabIndex=-1，好让它能接收焦点；读屏会念 aria-label「诗词详情」，
     接着按 Tab 才走到关闭钮与「查看完整注释」。 */
  useFocusReturn(on, ref, { delay: 80 });

  /* 换一首就回到顶部 */
  useLayoutEffect(function () {
    if (on && bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [on, poemId]);

  /* ⚠️ 打开抽屉**不主动**挪地图——读一首诗是看文字，画面自己滑一下
     反而把人从字上拽走，连翻几首时更明显。这个判断仍然成立。
     但有一条例外：如果这个地标**根本看不见**（被抽屉压住、或在屏幕外），
     那「是哪一处」这件事就丢了——用户点开一首诗，左边地图上找不到落点。
     所以只在「被遮挡或贴边」时才平滑挪一下，露着就一动不动。
     量之前先等一帧：抽屉的宽度由中间那首竖排诗撑出来（长诗能盖掉七成屏宽），
     刚 on 的那一帧还没排完版，量到的宽度是错的。 */
  useEffect(function () {
    if (!on || !node) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(function () {
      raf2 = requestAnimationFrame(function () {
        const e = getEngine();
        if (e && e.ensurePlaceVisible) e.ensurePlaceVisible(node.id);
      });
    });
    return function () { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
  }, [on, poemId, node]);

  /* 键盘 ←/→ 翻篇、L 回到「此处的其他几首」。焦点在输入框里时不抢。 */
  useEffect(function () {
    if (!on) return;
    function onKey(e) {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); go(prev); return; }
      if (e.key === "ArrowRight") { e.preventDefault(); go(next); return; }
      /* L = 回到这一处的篇目（C19：从浮层选了一首之后浮层就关了，
         想在同处换一首，键盘也得有路可走） */
      if ((e.key === "l" || e.key === "L") && rest.length && node) {
        e.preventDefault();
        backToPlaceList(node.id);
      }
    }
    document.addEventListener("keydown", onKey);
    return function () { document.removeEventListener("keydown", onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, prev, next, node, rest.length]);

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
    <aside id="detail" ref={ref} className={on ? "on" : ""} aria-hidden={!on}
      /* 关闭时是 translateX(102%) 滑出屏外，元素还在、仍在 Tab 序里——
         光 aria-hidden 挡不住键盘。inert 才是真把这棵子树摘出去。 */
      inert={!on}
      aria-label="诗词详情" tabIndex={-1}>
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

              {/* 上一篇 / 下一篇：按当前筛选顺序翻，编号让人知道「读到哪了」。
                  长诗名（《水调歌头·明月几时有》这类）在按钮里会省略号截断，
                  所以除了 title，再给一个**完整的** aria-label ——
                  title 只是鼠标提示，读屏用户拿不到被截掉的那半截名字。 */}
              <nav className="d-nav" aria-label="篇目翻页">
                <button type="button" className="dn-btn" disabled={!prev}
                  title={prev ? "上一篇：" + prev.title + "（←）" : "已经是第一篇"}
                  aria-label={prev ? "上一篇：" + prev.title : "已经是第一篇"}
                  onClick={() => go(prev)}>
                  <span className="dn-ar" aria-hidden="true">‹</span>
                  <span className="dn-t">{prev ? prev.title : "已是首篇"}</span>
                </button>
                <span className="dn-pos" title="当前筛选下的位置">
                  {pos >= 0 ? pos + 1 : "—"}<i>/</i>{list.length}
                </span>
                <button type="button" className="dn-btn dn-next" disabled={!next}
                  title={next ? "下一篇：" + next.title + "（→）" : "已经是最后一篇"}
                  aria-label={next ? "下一篇：" + next.title : "已经是最后一篇"}
                  onClick={() => go(next)}>
                  <span className="dn-t">{next ? next.title : "已是末篇"}</span>
                  <span className="dn-ar" aria-hidden="true">›</span>
                </button>
              </nav>
              <div id="dTags" className="d-tags">
                {tagsOf(p.id).map(function (t) { return <span key={t}>{t}</span>; })}
              </div>
              {!!rest.length && (
                <div className="d-others">
                  {/* C22/C19：原来是一枚与标签同级的虚线药丸，很容易被当成装饰。
                      它其实是「同一处换一首读」的唯一入口——从浮层里选了一首之后
                      浮层就关了，要再读同处的另一首，只能靠这里（或重新点地标）。
                      所以做成实心按钮、给图标、标上快捷键。 */}
                  <button type="button" className="others-more"
                    onClick={() => backToPlaceList(node.id)}>
                    <IconList />
                    此处另有 {rest.length} 首
                    <kbd>L</kbd>
                  </button>
                </div>
              )}

              {/* 背景故事：讲这首诗**怎么来的**，与下面的「诗意简析」
                  （讲它说了什么）分工不同。常驻显示，不藏在注释里——
                  一段来龙去脉比一句「表达了……」更容易让人记住这首诗。
                  没有 story 的条目回落到 place.origin，不会开天窗。 */}
              <section className="sec sec-story">
                <h3>背景故事</h3>
                <p id="dStory">{p.story || p.place.origin}</p>
              </section>

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
                {/* 「写作背景」这一节已经并进上面的「背景故事」，
                    不再重复列一次（原来它藏在注释里，很少有人翻到）。 */}
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

              {/* C21：读完落款之后原来什么都没有——想收起只能去右上角找关闭钮或按 Esc。
                  读到尾的人最自然的下一步是「合上」，所以在卷尾给一个收束动作。 */}
              <div className="d-endcap">
                <button type="button" className="d-done" onClick={closeDetail}>
                  收起，回到地图 <kbd>Esc</kbd>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
