/* ============================================================
   地标悬停卡
   ----------------------------------------------------------
   鼠标停在地标珠上，浮出一张巴掌大的纸卡：这一处是哪、收了哪几首。
   为什么不用原生 title：那个气泡又慢又丑，而且只能显示一行纯文本，
   读不出「这一处有哪几首」——而后者恰恰是点下去之前最想知道的事。

   位置由 anchor.placeHover() 命令式算（要读地图投影），
   本组件只负责渲染内容与登记元素引用。
   ============================================================ */
import { useEffect, useLayoutEffect, useRef } from "react";
import { useStore } from "../store.js";
import { PLACE_BY_ID } from "../data/places.js";
import { placeLabel } from "../data/select.js";
import { els } from "../engine/refs.js";
import { placeHover } from "../engine/anchor.js";
import { getEngine } from "../engine/mapEngine.js";
import { IconPin } from "./icons.jsx";

/* 最多列几首：再多就该点开浮层了，悬停卡不承担「读完一处」的责任 */
const MAX_ROWS = 6;

export default function PlaceHover() {
  const placeId = useStore("hoverPlaceId");
  const listPlaceId = useStore("poemListPlaceId");
  const paletteOpen = useStore("paletteOpen");
  const ref = useRef(null);

  /* 浮层已经列了这一处时，悬停卡是多余的 */
  const node = placeId && placeId !== listPlaceId && !paletteOpen
    ? PLACE_BY_ID[placeId]
    : null;
  const on = !!node;

  useEffect(function () {
    els.hover = ref.current;
    return function () { els.hover = null; };
  }, []);

  /* 内容一变就要重新量尺寸再定位（行数不同，卡片高矮不同） */
  useLayoutEffect(function () {
    if (on) placeHover(node);
  }, [on, node]);

  /* 地图平移缩放时跟着珠子走（引擎只触发，算法在 anchor） */
  useEffect(function () {
    if (!on) return;
    const e = getEngine();
    if (!e) return;
    function reposition() { placeHover(node); }
    e.map.on("zoom move", reposition);
    return function () { e.map.off("zoom move", reposition); };
  }, [on, node]);

  const rows = node ? node.poems.slice(0, MAX_ROWS) : [];
  const rest = node ? node.poems.length - rows.length : 0;
  /* 一处只收一首时不必说「点击展开」——点下去直接开抽屉，
     文案改成更准确的那句。 */
  const hint = !node ? "" : node.poems.length > 1 ? "点击展开这一处" : "点击读这一首";

  return (
    <div id="placeHover" ref={ref} className={on ? "on" : ""} aria-hidden="true">
      {node && (
        <>
          <div className="ph-head">
            <IconPin />
            <b>{placeLabel(node)}</b>
            <span className="ph-n">{node.poems.length} 首</span>
          </div>
          <ul className="ph-list">
            {rows.map(function (p) {
              return (
                <li key={p.id}>
                  <span className="ph-t">{p.title}</span>
                  <span className="ph-m">{p.dynasty} · {p.author}</span>
                </li>
              );
            })}
          </ul>
          {rest > 0 && <div className="ph-more">另有 {rest} 首</div>}
          <div className="ph-hint">{hint}</div>
        </>
      )}
    </div>
  );
}
