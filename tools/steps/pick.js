/* 在多地浮层里挑一首（模糊匹配 + 兜底取最后一首）。参数：window.__stepArg 形如 "念奴娇|last" */
(async function () {
  var parts = String(__stepArg).split("|");
  var el = __pick(parts[0], parts[1] === "last" || parts[1] === "first");
  if (!el) return "pick-not-found:" + __stepArg;
  var t = el.textContent;
  __click(el);
  await __raf(); await __wait(260);
  return "picked:" + t.slice(0, 12);
})();
