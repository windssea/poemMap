/* 点某个地标（按地名签文字模糊匹配）。参数：window.__stepArg */
(async function () {
  await __wait(900);
  var el = __marker(window.__stepArg);
  if (!el) return "marker-not-found:" + window.__stepArg;
  __click(el);
  await __raf(); await __wait(520);
  return "clicked:" + window.__stepArg + " " + JSON.stringify(__state());
})();
