/* 打开命令面板并输入查询词。
   参数：window.__stepArg = "查询词"（可空） */
(async function () {
  await __wait(600);
  var q = String(window.__stepArg || "");
  var btn = document.getElementById("paletteBtn");
  if (!btn) return "no paletteBtn";
  __click(btn);
  await __raf(); await __wait(320);
  var input = document.querySelector("#palette .pal-input input");
  if (!input) return "no palette input";
  if (q) {
    input.focus();
    /* React 受控输入：改 value 后要派发 input 事件，它才收得到 */
    var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(input, q);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await __raf(); await __wait(260);
  }
  return {
    open: !!document.querySelector("#palette.on"),
    groups: [].map.call(document.querySelectorAll("#palette .pal-group h4"), function (h) { return h.textContent; }),
    items: document.querySelectorAll("#palette .pal-item").length,
    first: (document.querySelector("#palette .pal-item .pal-t") || {}).textContent || "",
  };
})();
