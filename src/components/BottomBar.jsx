/* ============================================================
   左下：收录统计 dock（含「篇目」开关）
   ----------------------------------------------------------
   唐 / 宋 / 先唐 三个数是**当前筛选下**的结果，与「N 首 / N 地」
   同源——所以筛到宋词时唐那一格会自然归零并收起，而不是杵在那里
   显示一个永远不变的数。
   ============================================================ */
import { useStore, toggleSide } from "../store.js";
import { useFilteredPoems } from "../hooks/useFiltered.js";
import { visiblePlaceIds } from "../data/select.js";
import { ERAS, inEra } from "../data/eras.js";
import { useCountUp } from "../hooks/useCountUp.js";
import { MOTION } from "../engine/motion.js";
import { IconList } from "./icons.jsx";

/* 展示顺序固定为 先唐 → 唐 → 宋，与时间轴一致 */
const SHOWN = ERAS.filter(function (e) { return e.val !== "全部"; });

export default function BottomBar() {
  const sideOpen = useStore("sideOpen");
  const motionOn = useStore("motionOn");
  const list = useFilteredPoems();
  const places = visiblePlaceIds(list).size;

  /* 当前筛选下各时代组的首数（未筛时为全量）。
     朱印给时代、小字给体裁——「唐 + 诗 + 91」读作「唐诗 91」，
     「古 + 诗 + 18」读作「古诗 18」。 */
  const perEra = SHOWN.map(function (e) {
    return {
      val: e.val,
      seal: e.val === "先唐" ? "古" : e.val,
      unit: e.val === "宋" ? "词" : "诗",
      label: e.label,
      /* 三枚小签在深石绿 / 石绿 / 石青里各占一档（方案 P1-E）：
         先唐 → 深石绿、唐 → 石绿、宋 → 石青。三色的实算对比度
         依次 5.70 / 4.89 / 5.41，都过 AA；色相挨着，整体仍然克制，
         不会在底栏上炸出三块彩色。 */
      tone: e.val === "宋" ? "s-qing" : (e.val === "唐" ? "s-lv" : "s-shen"),
      n: list.filter(function (p) { return inEra(p.dynasty, e.val); }).length,
    };
  }).filter(function (e) { return e.n > 0; });

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

      {perEra.map(function (e) {
        return (
          <span className="bs" key={e.val}
            title={e.label + " " + e.n + " 首（当前筛选）"}>
            <i className={"seal-s " + e.tone}>{e.seal}</i>
            <em>{e.unit}</em>
            {/* key 挂在数字上：数值一变 React 换掉这个节点，
                CSS 的 bsTick 于是重新播一次，读的人能看见「数变了」 */}
            <b key={e.n}>{e.n}</b>
          </span>
        );
      })}

      <span className="bs-counts" title={"当前筛选：" + list.length + " 首 / " + places + " 处地标"}>
        <b id="statPoems">{poemsShown}</b><i>首</i>
        <b id="statPlaces">{placesShown}</b><i>地</i>
      </span>
    </div>
  );
}
