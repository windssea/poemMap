/* 在右上搜索框里输入关键词（走 React 受控输入的 setter + input 事件）。
   参数：window.__stepArg = "关键词" */
(async function () {
  await __wait(700);
  var q = String(window.__stepArg || "");
  var input = document.getElementById("q");
  if (!input) return "no search input";
  input.focus();
  var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  setter.call(input, q);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  /* 输入框自己做了 180ms 去抖才推给 store */
  await __raf(); await __wait(520);
  return {
    q: q,
    items: document.querySelectorAll("#list .item").length,
    marks: document.querySelectorAll("#list .item .hl").length,
    stat: (document.getElementById("statPoems") || {}).textContent,
  };
})();
