/* 回归：几条「收起来」的路径各自该关到什么程度，别改坏既有设计意图。
   ----------------------------------------------------------
   设计意图（改动前就成立、改动后必须仍然成立）：
     ① 点抽屉自己的关闭按钮 → 只关抽屉，**卡片回来**（不是一概全关）
     ② Esc 逐层收：先菜单/篇目栏/浮层/抽屉/面板，最后才是卡片
     ③ 点地图空白 → 卡片 + 浮层 + 抽屉**一起**收（就是闪现 bug 的那条路径）
   用法（前置需已开卡 + 开抽屉）：
     CDP_SETUP=tools/steps/_pre.js,tools/steps/place.js,tools/steps/pick.js,tools/steps/detail.js \
       CDP_STEP_ARG='长安,|last,' \
       node tools/cdp.js <url> --eval @tools/probes/dismiss-paths.js [waitMs] */
(async function () {
  function on(sel) { var e = document.querySelector(sel); return !!(e && e.classList.contains("on")); }
  function snap() { return { card: on("#card"), detail: on("#detail"), list: on("#poemList") }; }
  function click(sel) {
    var el = document.querySelector(sel);
    if (!el) return false;
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    return true;
  }
  async function frames(n) {
    for (var i = 0; i < n; i++) await new Promise(function (r) { requestAnimationFrame(r); });
  }

  var out = {};

  /* 起点：卡片已收起、抽屉已开 */
  out.start = snap();

  /* ① 点抽屉的关闭按钮 → 应该回到卡片 */
  if (!click("#detailClose")) { out.error = "no #detailClose"; return JSON.stringify(out); }
  await frames(3);
  out.afterDetailCloseBtn = snap();
  out.rule1_cardComesBack = out.afterDetailCloseBtn.card === true && out.afterDetailCloseBtn.detail === false;

  /* ② 再进抽屉，然后按 Esc → 先收抽屉，卡片回来 */
  click("#cardMore");
  await frames(3);
  out.reopened = snap();
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await frames(3);
  out.afterEsc1 = snap();
  out.rule2a_escClosesDetailOnly = out.afterEsc1.detail === false && out.afterEsc1.card === true;

  /* Esc 再按一次 → 这次才收卡片 */
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await frames(3);
  out.afterEsc2 = snap();
  out.rule2b_escThenClosesCard = out.afterEsc2.card === false;

  /* ③ 重新开卡 + 开抽屉，点地图空白 → 三者全关 */
  var mk = (function () {
    var names = document.querySelectorAll(".dot-name");
    for (var i = 0; i < names.length; i++) {
      if (names[i].textContent.indexOf("长安") > -1) {
        return names[i].closest(".leaflet-marker-icon") || names[i].closest(".mk-wrap");
      }
    }
    return null;
  })();
  if (mk) {
    mk.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    await frames(2);
    var item = document.querySelector("#poemList .pl-item");
    if (item) {
      item.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      await frames(2);
      click("#cardMore");
      await frames(3);
      out.beforeMapClick = snap();

      var map = document.querySelector("#map");
      var r = map.getBoundingClientRect();
      var opt = { bubbles: true, cancelable: true, clientX: Math.round(r.left + 40), clientY: Math.round(r.top + 40), view: window };
      map.dispatchEvent(new PointerEvent("pointerdown", opt));
      await frames(3);            // 关键：给浏览器一帧绘制机会，闪现就在这里露头
      out.midWayAfterPointerDown = snap();
      map.dispatchEvent(new MouseEvent("mouseup", opt));
      map.dispatchEvent(new MouseEvent("click", opt));
      await frames(6);
      out.afterMapClick = snap();
      out.rule3_mapClickClosesAll =
        out.afterMapClick.card === false && out.afterMapClick.detail === false && out.afterMapClick.list === false;
      out.rule3_noCardFlashInBetween = out.midWayAfterPointerDown.card === false;
    } else out.error = "no pl-item";
  } else out.error = "no marker";

  return JSON.stringify(out, null, 1);
})()
