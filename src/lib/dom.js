/* ============================================================
   环境与 DOM 小工具
   ============================================================ */

/** 窄屏判定（与 CSS 断点 820px 对齐） */
export function narrow() {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 820px)").matches;
}

/** 转义：仅用于拼 divIcon 的 HTML 字符串（React 渲染的文本无需转义） */
export function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 省界/国界之外的国名与国家名缩写（与旧版一致） */
export function shortProvinceName(name) {
  return String(name || "").replace(/省|市|自治区|特别行政区|壮族|回族|维吾尔/g, "");
}
