/* 打开索引面板（诗人 / 主题）。参数：window.__stepArg = "poet" | "theme" | "list" */
(async function () {
  await __wait(500);
  var mode = window.__stepArg || "poet";
  var btn = document.getElementById("menuBtn");
  __click(btn);
  await __raf(); await __wait(260);
  var target = null;
  var items = document.querySelectorAll("#menuPop button");
  for (var i = 0; i < items.length; i++) {
    var t = items[i].textContent || "";
    if (mode === "poet" && t.indexOf("诗人") > -1) target = items[i];
    if (mode === "theme" && t.indexOf("主题") > -1) target = items[i];
  }
  if (target) __click(target);
  await __raf(); await __wait(520);
  return "panel:" + mode + " on=" + (document.getElementById("panel").classList.contains("on"));
})();
