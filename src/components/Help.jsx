/* ============================================================
   快捷键速查（按 ? 打开）
   ----------------------------------------------------------
   这个站的交互有一半在键盘上：⌘K 找诗、←→ 翻篇、Esc 逐层收。
   不写出来没人会去试，所以给一张一屏读完的卡片。
   ============================================================ */
import { useEffect, useRef } from "react";
import { useStore, closeHelp } from "../store.js";
import { POEMS, AUTHOR_COUNT } from "../data/index.js";
import { PLACES } from "../data/places.js";

const KEYS = [
  { k: ["⌘", "K"], alt: ["Ctrl", "K"], t: "命令面板", d: "搜诗词、诗人、地标、主题，或直接执行动作" },
  { k: ["/"], t: "搜索框", d: "光标直接落到右上搜索框" },
  { k: ["?"], t: "这张卡片", d: "再按一次 Esc 收起" },
  { k: ["←"], k2: ["→"], t: "上一篇 / 下一篇", d: "在读诗时，按当前筛选顺序翻页" },
  { k: ["L"], t: "同一处的其他几首", d: "回到这幅地标的篇目，换一首接着读" },
  { k: ["↑"], k2: ["↓"], t: "篇目上下移动", d: "篇目栏收起时会自动展开；焦点在地图里时让给地图平移" },
  { k: ["↵"], t: "打开", d: "打开选中的那一首；在地标上按回车同样打开" },
  { k: ["Esc"], t: "逐层收起", d: "面板 → 抽屉 → 浮层 → 菜单，从最上面一层开始" },
  { k: ["R"], t: "随机一首", d: "在当前筛选里偶遇一首（在命令面板里按）" },
];

export default function Help() {
  const open = useStore("helpOpen");
  const boxRef = useRef(null);

  useEffect(function () {
    if (!open) return;
    function onDown(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) closeHelp();
    }
    /* 捕获阶段：别让地图先把这个点击吃掉 */
    document.addEventListener("pointerdown", onDown, true);
    return function () { document.removeEventListener("pointerdown", onDown, true); };
  }, [open]);

  if (!open) return null;

  return (
    <div id="help" className="on" role="dialog" aria-modal="true" aria-label="快捷键">
      <div className="help-box" ref={boxRef}>
        <header className="help-head">
          <h2>快捷键</h2>
          <button type="button" className="help-close" onClick={closeHelp} aria-label="关闭">Esc</button>
        </header>

        <dl className="help-list">
          {KEYS.map(function (r) {
            return (
              <div className="help-row" key={r.t}>
                <dt>
                  {r.k.map(function (c) { return <kbd key={c}>{c}</kbd>; })}
                  {r.k2 && <span className="help-or">或</span>}
                  {r.k2 && r.k2.map(function (c) { return <kbd key={c}>{c}</kbd>; })}
                </dt>
                <dd>
                  <b>{r.t}</b>
                  <span>{r.d}</span>
                </dd>
              </div>
            );
          })}
        </dl>

        <footer className="help-foot">
          全离线收录 {POEMS.length} 首 · {PLACES.length} 处地标 · {AUTHOR_COUNT} 位作者
        </footer>
      </div>
    </div>
  );
}
