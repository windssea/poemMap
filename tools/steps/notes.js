/* 抽屉内「查看完整注释」展开 */
(async function () {
  var btn = document.querySelector("#btnMore");
  if (!btn) return "no-btnMore";
  __click(btn);
  await __raf(); await __wait(240);
  return "notes-expanded:" + (document.querySelector("#dMore").hidden === false);
})();
