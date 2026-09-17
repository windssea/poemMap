/* ============================================================
   动效与交互自检（配合 tools/cdp.js 使用，不参与站点运行）
   ----------------------------------------------------------
   要证明的三件事：
     1) 开场把 html.motion-prep 摘干净了——没有元素卡在不可见；
     2) 云气层（WebGL）起来了、且「动效」开关能真的把它停掉；
     3) 卡片 / 抽屉 / 浮层 / 篇目栏 在开关两种状态下都可见可用。

   用法：
     node tools/cdp.js http://127.0.0.1:5179/ --eval "@tools/qa-motion.js" 6000
   ============================================================ */
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const raf = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const q = (s) => document.querySelector(s);
  const op = (s) => {
    const el = q(s);
    return el ? Number(getComputedStyle(el).opacity) : -1;
  };
  const opAny = (s) => {
    const els = document.querySelectorAll(s);
    if (!els.length) return -1;
    let min = 1;
    els.forEach((e) => { min = Math.min(min, Number(getComputedStyle(e).opacity)); });
    return min;
  };
  const click = (el) => !!el && el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  const clickByText = (root, text) => {
    const els = document.querySelectorAll(root + " button, " + root + " [data-act]");
    for (const e of els) if (e.textContent.indexOf(text) > -1) return click(e);
    return false;
  };
  const marker = (name) => {
    const names = document.querySelectorAll(".dot-name");
    for (const n of names) {
      if (n.textContent.indexOf(name) > -1) {
        return n.closest(".leaflet-marker-icon") || n.closest(".mk-wrap");
      }
    }
    return null;
  };
  const snapshot = () => ({
    card: !!q("#card") && q("#card").classList.contains("on"),
    detail: !!q("#detail") && q("#detail").classList.contains("on"),
    list: !!q("#poemList") && q("#poemList").classList.contains("on"),
    side: document.body.classList.contains("side-open"),
  });

  const out = {};

  /* ---- 1) 开场之后：没有东西卡在不可见 ---- */
  out.afterIntro = {
    prep: document.documentElement.classList.contains("motion-prep"),
    motionOn: window.MOTION ? window.MOTION.on : null,
    brand: op("#brand"),
    seal: op(".seal-big"),
    title: op(".b-text h1"),
    couplet: op(".couplet"),
    search: op(".search"),
    chipbar: op(".chipbar"),
    bottomBar: op("#bottomBar"),
    sideVerse: op("#sideVerse"),
    compass: op("#compass"),
    zoomer: op("#zoomer"),
    paint: op("#paint"),
    markers: document.querySelectorAll(".mk-anim").length,
    markerOpacity: opAny(".mk-anim"),
    veil: !!q("#veil"),
    stats: [
      (q("#statPoems") || {}).textContent,
      (q("#statPlaces") || {}).textContent,
    ],
  };

  /* ---- 2) 云气层 ---- */
  const canvas = q(".atmosphere-canvas");
  out.atmosphere = {
    canvas: !!canvas,
    size: canvas ? [canvas.width, canvas.height] : null,
    stats: window.ATMOSPHERE ? window.ATMOSPHERE.stats() : null,
  };

  /* ---- 3) 点地标 → 多地浮层 → 挑一首 → 卡片 ---- */
  click(marker("黄州"));
  await raf(); await sleep(220);
  out.poemList = { ...snapshot(), items: document.querySelectorAll("#poemList .pl-item").length };

  const pick = (() => {
    const items = document.querySelectorAll("#poemList .pl-item");
    for (const it of items) if (it.textContent.indexOf("念奴娇") > -1) return it;
    return items[0];
  })();
  click(pick);
  await raf(); await sleep(420);
  out.card = {
    ...snapshot(),
    title: (q("#cardTitle") || {}).textContent,
    columns: document.querySelectorAll("#cardPoem .col").length,
    writingMode: q("#cardPoem .col") ? getComputedStyle(q("#cardPoem .col")).writingMode : null,
    colOpacity: opAny("#cardPoem .col"),
    trOpacity: op("#cardTr"),
    others: (q("#cardOthers") || {}).hidden === false,
  };

  /* ---- 4) 进抽屉：卡片应让位；竖排诗可见 ---- */
  click(q("#cardMore"));
  await raf(); await sleep(520);
  out.detail = {
    ...snapshot(),
    title: (q("#dTitle") || {}).textContent,
    lines: document.querySelectorAll("#dPoem .line").length,
    lineOpacity: opAny("#dPoem .line"),
    secOpacity: opAny("#detail .sec"),
    writingMode: q("#dPoem .line") ? getComputedStyle(q("#dPoem .line")).writingMode : null,
    bodyBackdrop: getComputedStyle(q("#detail")).backdropFilter || getComputedStyle(q("#detail")).webkitBackdropFilter,
    bodyColor: getComputedStyle(q("#detail")).backgroundColor,
  };

  /* ---- 5) 展开完整注释 ---- */
  click(q("#btnMore"));
  await raf(); await sleep(360);
  out.notes = {
    open: q("#dMore") ? q("#dMore").hidden === false : null,
    notes: document.querySelectorAll("#dNotes dt").length,
    noteOpacity: op("#dNotes dt"),
    btn: (q("#btnMore span") || {}).textContent,
  };

  /* ---- 6) 关抽屉 ---- */
  click(q("#detailClose"));
  await raf(); await sleep(420);
  out.closed = snapshot();

  /* ---- 7) 关动效：一切必须回到「可见的静态」 ---- */
  click(q("#menuBtn"));
  await raf(); await sleep(220);
  clickByText("#menuPop", "动效");
  await raf(); await sleep(700);
  out.motionOff = {
    motionOn: window.MOTION.on,
    atmosEnabled: window.ATMOSPHERE.stats().enabled,
    canvasDisplay: canvas ? getComputedStyle(canvas).display : null,
    prep: document.documentElement.classList.contains("motion-prep"),
    brand: op("#brand"),
    sidebarItem: opAny("#list .item"),
    marker: opAny(".mk-anim"),
    paint: op("#paint"),
  };

  /* 关动效状态下打开一首，内容也必须立刻可见 */
  click(marker("黄州"));
  await raf(); await sleep(200);
  click(document.querySelector("#poemList .pl-item"));
  await raf(); await sleep(360);
  out.motionOff.cardVisible = {
    card: snapshot().card,
    columns: document.querySelectorAll("#cardPoem .col").length,
    colOpacity: opAny("#cardPoem .col"),
  };

  /* ---- 8) 再开动效 ---- */
  click(q("#menuBtn"));
  await raf(); await sleep(200);
  clickByText("#menuPop", "动效");
  await raf(); await sleep(600);
  out.motionBackOn = {
    motionOn: window.MOTION.on,
    atmosEnabled: window.ATMOSPHERE.stats().enabled,
    canvasDisplay: canvas ? getComputedStyle(canvas).display : null,
  };

  /* ---- 9) 筛选：篇目行与地标都要回来且可见 ---- */
  const songBtn = (() => {
    const els = document.querySelectorAll("#chipsDynasty button, #tabs button");
    for (const e of els) if (e.textContent.trim() === "宋词") return e;
    return null;
  })();
  click(songBtn);
  await raf(); await sleep(900);
  out.filter = {
    items: document.querySelectorAll("#list .item").length,
    itemOpacity: opAny("#list .item"),
    tabPressed: songBtn ? songBtn.getAttribute("aria-pressed") : null,
    markers: document.querySelectorAll(".mk-wrap").length,
    markerOpacity: opAny(".mk-anim"),
    statPoems: (q("#statPoems") || {}).textContent,
    statPlaces: (q("#statPlaces") || {}).textContent,
  };

  /* ---- 10) 帧率（动效开启时） ---- */
  out.fps = await new Promise((res) => {
    let n = 0;
    const t0 = performance.now();
    (function f() {
      n++;
      if (performance.now() - t0 < 1000) requestAnimationFrame(f);
      else res(Math.round((n * 1000) / (performance.now() - t0)));
    })();
  });

  out.perf = window.__perf || null;
  return out;
})();
