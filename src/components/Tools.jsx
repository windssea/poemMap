/* ============================================================
   右上：搜索 · 更多菜单（筛选已移到命令面板）
   ============================================================ */
import { useEffect, useRef, useState } from "react";
import {
  useStore, setQuery,
  toggleMenu, closeMenu, openPanel, openPalette, openHelp,
} from "../store.js";
import { selectFiltered } from "../data/select.js";
import { getState, showToast } from "../store.js";
import { resetView, toggleMotion, about, focusSchool } from "../actions.js";
import { AUTHOR_COUNT, POEMS } from "../data/index.js";
import { schoolCount } from "../data/schools.js";
import { IconClose, IconMenu, IconSearch } from "./icons.jsx";

export function Tools() {

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

      {/* 筛选条已按要求移除，右上只留搜索框。
          ------------------------------------------------------------
          朝代 / 体裁的筛选并没有消失，只是不再占据右上角：
          命令面板（⌘K 或 ⌘ 钮）里仍有「朝代」「体裁」两组动作，
          左下 dock 的时代统计也照旧反映当前筛选。
          这样右上角只剩「搜索」一件事，顶栏的层级反而清楚了。
          #chipsDynasty / #chipsForm 这两个 id 由探针与 qa 脚本使用，
          现在由 Palette 渲染，见 components/Palette.jsx。 */}
      <div className="chipbar">
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
