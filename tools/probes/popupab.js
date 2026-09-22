/* Popup「卡片套卡片」的前后对照
   ----------------------------------------------------------
   CDP_STEP_ARG=old 时把那套内卡样式**注回去**，于是能在同一个视口、
   同一个地标（北京·蓟城，正好 2 首）、同一个 scroll 位置截到两张图，
   逐像素可比 —— 比翻 git 历史截图可靠。
   用法：CDP_STEP_ARG=old|new CDP_SETUP=tools/probes/popupab.js \
           node tools/cdp.js <url> shots/xxx.png 7000 */
(async function () {
  var s = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var mode = window.__stepArg || "new";

  if (mode === "old") {
    var st = document.createElement("style");
    st.textContent = [
      ".pl-head{padding:2px 7px 10px !important;font-weight:400 !important;color:var(--ink-2) !important;",
      "border-bottom-color:rgba(86,140,120,.35) !important}",
      ".pl-head .pl-n{font-weight:400 !important}",
      ".pl-item{padding:9px 11px !important;margin-top:7px !important;",
      "background:rgba(255,255,255,.42) !important;border:1px solid transparent !important;",
      "border-radius:10px !important;box-shadow:none !important}",
      ".pl-item:hover{background:rgba(255,255,255,.72) !important;border-color:rgba(169,79,60,.3) !important}",
      ".pl-item.on{background:rgba(169,79,60,.08) !important;border-color:rgba(169,79,60,.35) !important}",
      ".pl-item + .pl-item{border-top:none !important}",
      ".pl-item::after{content:none !important}",
      ".pl-item .pl-t{color:#293f3b !important;font-weight:400 !important}",
      ".pl-item.on .pl-t{font-weight:600 !important}",
      "#poemList{box-shadow:0 16px 40px rgba(41,63,59,.16), inset 0 0 0 1px rgba(255,255,255,.45) !important}",
    ].join("");
    document.head.appendChild(st);
  }

  /* 打开北京·蓟城（正好 2 首：登幽州台歌 / 望蓟门） */
  window.__map.setView([39.9, 116.3], 6.4, { animate: false });
  window.__map.fire("moveend");
  await s(500);
  var names = document.querySelectorAll(".dot-name");
  for (var i = 0; i < names.length; i++) {
    if (names[i].textContent.indexOf("蓟城") > -1) {
      var icon = names[i].closest(".leaflet-marker-icon") || names[i].closest(".mk-wrap");
      if (icon) icon.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      break;
    }
  }
  await s(900);
  var pl = document.querySelector("#poemList");
  return "mode=" + mode + " on=" + pl.classList.contains("on") +
    " items=" + document.querySelectorAll("#poemList .pl-item").length +
    " head=" + (document.querySelector(".pl-head") || {}).textContent;
})()
