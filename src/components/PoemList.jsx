/* ============================================================
   多地诗词：磨砂浮层列表
   ----------------------------------------------------------
   一处有多首时，先弹这个「挑一首」的浮层，点某首才开卡。
   位置贴着地标（指向性比居中更重要），窄屏退为贴底抽屉。
   ============================================================ */
import { useEffect, useLayoutEffect, useRef } from "react";
import { useStore } from "../store.js";
import { PLACE_BY_ID } from "../data/places.js";
import { placeLabel } from "../data/select.js";
import { els } from "../engine/refs.js";
import { placePoemList } from "../engine/anchor.js";
import { MOTION } from "../engine/motion.js";
import { choosePoem } from "../actions.js";
import { getEngine } from "../engine/mapEngine.js";

export default function PoemList() {
  const placeId = useStore("poemListPlaceId");
  const openPoemId = useStore("openPoemId");
  const ref = useRef(null);
  const node = placeId ? PLACE_BY_ID[placeId] : null;
  const on = !!node;

  useEffect(function () {
    els.poemList = ref.current;
    return function () { els.poemList = null; };
  }, []);

  useLayoutEffect(function () {
    if (on) placePoemList(node);
  }, [on, node]);

  useEffect(function () {
    if (on && MOTION.on && ref.current) MOTION.cardIn(ref.current);
  }, [on, node]);

  /* 地图缩放/平移后重新贴着地标（引擎只负责触发，算法在 anchor） */
  useEffect(function () {
    if (!on) return;
    const e = getEngine();
    if (!e) return;
    function reposition() { placePoemList(node); }
    e.map.on("zoomend moveend", reposition);
    return function () { e.map.off("zoomend moveend", reposition); };
  }, [on, node]);

  return (
    <div id="poemList" ref={ref} className={"poem-list" + (on ? " on" : "")}
      aria-hidden={!on}>
      {node && (
        <>
          <div className="pl-head">
            {placeLabel(node)}
            <span className="pl-n">{node.poems.length} 首</span>
          </div>
          {node.poems.map(function (p) {
            return (
              <button key={p.id} type="button"
                className={"pl-item" + (openPoemId === p.id ? " on" : "")}
                data-id={p.id}
                onClick={() => choosePoem(node.id, p.id)}>
                <span className="pl-t">{p.title}</span>
                <span className="pl-m">{p.dynasty} · {p.author}</span>
              </button>
            );
          })}
        </>
      )}
    </div>
  );
}
