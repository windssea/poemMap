/* ============================================================
   右上：搜索 · 筛选条 · 更多菜单
   ============================================================ */
import { useEffect, useRef, useState } from "react";
import {
  useStore, setQuery, toggleDynasty, toggleForm,
  toggleMenu, closeMenu, openPanel,
} from "../store.js";
import { selectFiltered } from "../data/select.js";
import { getState, showToast } from "../store.js";
import { resetView, toggleMotion, about } from "../actions.js";
import { AUTHOR_COUNT } from "../data/index.js";
import { IconClose, IconMenu, IconSearch } from "./icons.jsx";

const DYNASTIES = [
  { val: "全部", label: "全部" },
  { val: "唐", label: "唐诗" },
  { val: "宋", label: "宋词" },
];
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
        <svg className="search-mark" viewBox="0 0 44 16" aria-hidden="true">
          <path d="M1 15 L9 6 L14 11 L21 3 L28 12 L34 7 L43 15 Z" />
        </svg>
      </div>

      <div className="chipbar">
        <div className="chips" id="chipsDynasty" role="group" aria-label="按朝代筛选">
          {DYNASTIES.map(function (d) {
            return (
              <button key={d.val} type="button" data-val={d.val}
                aria-pressed={dynasty === d.val}
                onClick={() => toggleDynasty(d.val)}>
                {d.label}
              </button>
            );
          })}
        </div>
        <span className="chip-sep" aria-hidden="true" />
        <div className="chips" id="chipsForm" role="group" aria-label="按体裁筛选">
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
        <span className="chip-fill" />
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
    <div id="menuPop" className="menu-pop" ref={boxRef} hidden={!menuOpen}>
      <button type="button" onClick={act(() => openPanel("poet"))}>
        诗人索引 <i>{AUTHOR_COUNT} 位</i>
      </button>
      <button type="button" onClick={act(() => openPanel("theme"))}>主题索引</button>
      <button type="button" onClick={act(toggleMotion)}>
        动效 <b id="motionState">{motionOn ? "开" : "关"}</b>
      </button>
      <button type="button" onClick={act(resetView)}>回到全国</button>
      <button type="button" onClick={act(about)}>关于本图</button>
    </div>
  );
}
