/* 卡内「查看完整注解」→ 打开右侧抽屉（同时应自动收起诗词卡） */
(async function () {
  var more = document.querySelector("#cardMore");
  if (!more) return "no-cardMore";
  __click(more);
  await __raf(); await __wait(300);
  return "detail:" + JSON.stringify(__state());
})();
