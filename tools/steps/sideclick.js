/* 篇目栏展开后，点其中一篇 → 应飞过去并开卡 */
(async function () {
  var items = document.querySelectorAll("#list .item");
  if (!items.length) return "no-items";
  __click(items[3]);
  await __raf(); await __wait(900);
  return "side-pick:" + JSON.stringify(__state());
})();
