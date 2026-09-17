/* 展开左侧篇目栏 */
(async function () {
  __click(document.querySelector("#sideToggle"));
  await __raf(); await __wait(420);
  return "side:" + JSON.stringify(__state());
})();
