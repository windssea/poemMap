/* 点某个地标（按地名签文字模糊匹配）。参数：window.__stepArg */
(async function () {
  await __wait(400);
  var el = __marker(__stepArg);
  if (!el) return "place-not-found:" + __stepArg;
  __click(el);
  await __raf(); await __wait(220);
  return "clicked-place:" + __stepArg;
})();
