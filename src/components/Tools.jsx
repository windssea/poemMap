/* ============================================================
   右上：搜索 · 筛选条 · 更多菜单
   ============================================================ */
import { useEffect, useRef, useState } from "react";
import {
  useStore, setQuery, toggleDynasty, toggleForm,
  toggleMenu, closeMenu, openPanel, openPalette, openHelp,
} from "../store.js";
import { selectFiltered } from "../data/select.js";
import { getState, showToast } from "../store.js";
import { resetView, toggleMotion, about, focusSchool } from "../actions.js";
import { AUTHOR_COUNT, ERA_COUNT, POEMS } from "../data/index.js";
import { ERAS } from "../data/eras.js";
import { schoolCount } from "../data/schools.js";
import { IconClose, IconMenu, IconSearch } from "./icons.jsx";

/* 朝代筛选按「时代组」给：先唐一个按钮管住先秦/汉/魏晋/南北朝，
   免得四个小朝代把唐诗宋词挤下去。顺序与时间轴一致。 */
const DYNASTIES = ERAS;
const FORMS = [
  { val: "全部", label: "全部" },
  { val: "诗", label: "诗" },
  { val: "词", label: "词" },
];

export function Tools() {
  const dynasty = useStore("dynasty");
  const form = useStore("form");
  const q = useStore("q");
  const menuOpen = useStore("menuOpen");

  /* 搜索框自己持有输入值，去抖后才推给 store（与旧版 180ms 一致） */
  const [draft, setDraft] = useState(q);
  const timer = useRef(0);
  const inputRef = useRef(null);

  function onInput(e) {
    const v = e.target.value;
    setDraft(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(function () {
      setQuery(v);
      if (v.trim()) {
        const n = selectFiltered(Object.assign({}, getState(), { q: v })).length;
        showToast("找到 " + n + " 首");
      }
    }, 180);
  }

  function clear() {
    setDraft("");
    setQuery("");
    inputRef.current && inputRef.current.focus();
  }

  function onKeyDown(e) {
    if (e.key === "Escape") {
      setDraft("");
      setQuery("");
      inputRef.current && inputRef.current.blur();
    }
  }

  /* 外部（如清空筛选）改了 q 时同步回输入框 */
  useEffect(function () { setDraft(q); }, [q]);
  useEffect(function () { return function () { clearTimeout(timer.current); }; }, []);

  return (
    <div id="tools">
      <div className="search" role="search">
        <IconSearch />
        <input
          id="q"
          ref={inputRef}
          type="search"
          placeholder="搜索诗词、诗人或地名"
          autoComplete="off"
          aria-label="搜索"
          value={draft}
          onChange={onInput}
          onKeyDown={onKeyDown}
        />
        <button id="qClear" className="q-clear" type="button" hidden={!draft} aria-label="清空搜索" onClick={clear}>
          <IconClose />
        </button>
        <kbd className="q-kbd" aria-hidden="true">/</kbd>
        <svg className="search-mark" viewBox="0 0 44 16" aria-hidden="true">
          <path d="M1 15 L9 6 L14 11 L21 3 L28 12 L34 7 L43 15 Z" />
        </svg>
      </div>

      {/* 筛选条：**每组一枚自己的胶囊**，不是一个装着两组的大胶囊。
          ------------------------------------------------------------
          原来是一个 .chipbar 胶囊里 flex-wrap，窄屏一换行就露馅：
          第一行是 4 个朝代 + 分隔线，第二行是 3 个体裁 + 2 个圆钮，
          两行左对齐但宽度不同 → 右缘参差，而 999px 圆角套在两行上
          又变成一个怪异的椭圆。用户截图里看到的「和外框错位」就是这个。

          改成每组自带标签与边框之后有两个好处：
            · 换行时每行本身是一枚完整的胶囊，不存在参差
            · 「全部」出现两次的歧义也解决了——现在写清了哪个是朝代、哪个是体裁 */}
      <div className="chipbar">
        <div className="chip-group" role="group" aria-label="按朝代筛选">
          <span className="cg-label" aria-hidden="true">朝代</span>
          <div className="chips" id="chipsDynasty">
            {DYNASTIES.filter(function (d) {
              /* 先唐这一格只在真收了先唐作品时才出现 */
              return d.val !== "先唐" || (ERA_COUNT.先唐 || 0) > 0;
            }).map(function (d) {
              const n = d.val === "全部" ? undefined : (ERA_COUNT[d.val] || 0);
              return (
                <button key={d.val} type="button" data-val={d.val}
                  title={n === undefined ? "不限朝代" : d.label + " " + n + " 首"}
                  aria-pressed={dynasty === d.val}
                  onClick={() => toggleDynasty(d.val)}>
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="chip-group" role="group" aria-label="按体裁筛选">
          <span className="cg-label" aria-hidden="true">体裁</span>
          <div className="chips" id="chipsForm">
            {FORMS.map(function (f) {
              return (
                <button key={f.val} type="button" data-val={f.val}
                  aria-pressed={form === f.val}
                  onClick={() => toggleForm(f.val)}>
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 命令面板的可见入口：⌘K 这种快捷键，不摆出来就没人会去试 */}
        <button id="paletteBtn" className="round-btn" type="button"
          aria-label="命令面板" title="命令面板（⌘K / Ctrl+K）：搜诗词、诗人、地标、主题"
          onClick={openPalette}>
          <span className="cmd-glyph" aria-hidden="true">⌘</span>
        </button>
        <button id="menuBtn" className="round-btn" type="button" aria-label="更多"
          aria-expanded={menuOpen} onClick={toggleMenu}>
          <IconMenu />
        </button>
      </div>
    </div>
  );
}

export function MenuPop() {
  const menuOpen = useStore("menuOpen");
  const motionOn = useStore("motionOn");
  const boxRef = useRef(null);

  /* 点菜单以外的地方收起 */
  useEffect(function () {
    if (!menuOpen) return;
    function onDoc(e) {
      if (boxRef.current && !boxRef.current.contains(e.target) &&
        !(e.target.closest && e.target.closest("#menuBtn"))) {
        closeMenu();
      }
    }
    document.addEventListener("click", onDoc);
    return function () { document.removeEventListener("click", onDoc); };
  }, [menuOpen]);

  function act(fn) {
    return function () { closeMenu(); fn(); };
  }

  return (
    <div id="menuPop" className="menu-pop" ref={boxRef} hidden={!menuOpen}
      inert={!menuOpen}>
      <button type="button" onClick={act(openPalette)}>
        命令面板 <i>⌘K</i>
      </button>
      <button type="button" onClick={act(() => openPanel("poet"))}>
        诗人索引 <i>{AUTHOR_COUNT} 位</i>
      </button>
      <button type="button" onClick={act(() => openPanel("theme"))}>主题索引</button>
      <button type="button" onClick={act(() => focusSchool("唐宋八大家"))}>
        唐宋八大家 <i>{schoolCount(POEMS, "唐宋八大家")} 首</i>
      </button>
      <button type="button" onClick={act(toggleMotion)}>
        动效 <b id="motionState">{motionOn ? "开" : "关"}</b>
      </button>
      <button type="button" onClick={act(resetView)}>回到全国</button>
      <button type="button" onClick={act(openHelp)}>
        快捷键 <i>?</i>
      </button>
      <button type="button" onClick={act(about)}>关于本图</button>
    </div>
  );
}
