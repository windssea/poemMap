/* ============================================================
   左下：收录统计 dock（含「篇目」开关）
   ----------------------------------------------------------
   唐/宋首数是**全量**统计，首/地两数是**当前筛选**下的结果。
   ============================================================ */
import { useStore, toggleSide } from "../store.js";
import { useFilteredPoems } from "../hooks/useFiltered.js";
import { visiblePlaceIds } from "../data/select.js";
import { DYNASTY_COUNT } from "../data/index.js";
import { useCountUp } from "../hooks/useCountUp.js";
import { MOTION } from "../engine/motion.js";
import { pickRandom } from "../actions.js";
import { IconList, IconShuffle } from "./icons.jsx";

export default function BottomBar() {
  const sideOpen = useStore("sideOpen");
  const motionOn = useStore("motionOn");
  const list = useFilteredPoems();
  const places = visiblePlaceIds(list).size;

  /* 开场时数字从 0 滚上来（只在首次挂载，与旧版一致） */
  const poemsShown = useCountUp(list.length, motionOn);
  const placesShown = useCountUp(places, motionOn);

  function onToggleSide() {
    const open = !sideOpen;
    toggleSide();
    if (open) MOTION.sideIn();
  }

  return (
    <div id="bottomBar">
      <button id="sideToggle" type="button" aria-label="篇目索引"
        aria-expanded={sideOpen} onClick={onToggleSide}>
        <IconList />
        <span>篇目</span>
      </button>

      <span className="bs"><i className="seal-s">唐</i><em>诗</em><b id="cntTang">{DYNASTY_COUNT.tang}</b></span>
      <span className="bs"><i className="seal-s">宋</i><em>词</em><b id="cntSong">{DYNASTY_COUNT.song}</b></span>
      <span className="bs-counts">
        <b id="statPoems">{poemsShown}</b><i>首</i>
        <b id="statPlaces">{placesShown}</b><i>地</i>
      </span>

      <button id="shuffleBtn" className="shuffle" type="button" title="随机读一首" onClick={pickRandom}>
        <IconShuffle />
        <span>换一批</span>
      </button>
      <span className="bs-hint">点亮地标，读一首诗</span>
    </div>
  );
}
