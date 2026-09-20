/* 把鼠标「停」在某个地标上，触发悬停卡。
   参数：window.__stepArg = 地名（模糊匹配地名签文字） */
(async function () {
  await __wait(900);
  var el = __marker(window.__stepArg);
  if (!el) return "marker-not-found:" + window.__stepArg;
  var dot = el.querySelector(".dot-wrap") || el;
  var r = dot.getBoundingClientRect();
  var opt = { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, view: window };
  dot.dispatchEvent(new MouseEvent("mouseover", opt));
  /* 引擎里显隐各留了 70ms / 190ms 的延时，等够 */
  await __raf(); await __wait(420);
  var card = document.getElementById("placeHover");
  return {
    on: card ? card.classList.contains("on") : null,
    head: card ? (card.querySelector(".ph-head b") || {}).textContent : "",
    rows: card ? card.querySelectorAll(".ph-list li").length : 0,
    side: card ? card.dataset.side : "",
    rect: card ? (function () { var b = card.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; })() : null,
  };
})();
