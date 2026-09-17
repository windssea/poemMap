/* ============================================================
   右缘：竖排题词 · 罗盘 · 缩放
   ============================================================ */
import { getEngine } from "../engine/mapEngine.js";
import { IconMinus, IconPlus } from "./icons.jsx";

export function SideVerse() {
  return (
    <div id="sideVerse" aria-hidden="true">
      <span className="sv-line">诗在山河间</span>
      <span className="sv-line">山河亦成诗</span>
      <i className="sv-seal">诗</i>
    </div>
  );
}

export function Compass() {
  return (
    <div id="compass" aria-hidden="true">
      <span className="c-label">北</span>
      <svg viewBox="0 0 26 26">
        <circle className="c-dial" cx="13" cy="13" r="10.4" />
        <path className="c-needle-s" d="M13 23.2 L10.4 13 L13 14.6 L15.6 13 Z" />
        <path className="c-needle-n" d="M13 2.8 L15.6 13 L13 11.4 L10.4 13 Z" />
        <circle className="c-pin" cx="13" cy="13" r="1.6" />
      </svg>
    </div>
  );
}

export function Zoomer() {
  function zoom(d) {
    const e = getEngine();
    if (e) e.map[d > 0 ? "zoomIn" : "zoomOut"](0.5);
  }
  return (
    <div id="zoomer">
      <button id="zoomIn" type="button" aria-label="放大" onClick={() => zoom(1)}>
        <IconPlus />
      </button>
      <button id="zoomOut" type="button" aria-label="缩小" onClick={() => zoom(-1)}>
        <IconMinus />
      </button>
    </div>
  );
}
