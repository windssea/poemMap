(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const op = (sel) => {
    const el = document.querySelector(sel);
    return el ? Number(getComputedStyle(el).opacity) : -1;
  };
  const out = {};

  // 1) 开场结束后：所有开场元素都应为可见
  out.afterIntro = {
    prep: document.documentElement.classList.contains("motion-prep"),
    seal: op("#brand .seal"),
    titleCh: op(".brand-text h1 .ch"),
    sidebar: op("#sidebar"),
    firstItem: op("#list .item"),
    legend: op("#legend"),
    compass: op("#compass"),
    motto: op("#motto"),
    sidePoem: op("#sidePoem"),
    markers: document.querySelectorAll(".mk-anim").length,
    markerOpacity: op(".mk-anim"),
    stats: [
      document.getElementById("statPoems").textContent,
      document.getElementById("statPlaces").textContent,
    ],
    veil: !!document.getElementById("veil"),
  };

  // 2) 云气层
  const canvas = document.querySelector(".atmosphere-canvas");
  out.atmosphere = {
    canvas: !!canvas,
    size: canvas ? [canvas.width, canvas.height] : null,
    stats: window.ATMOSPHERE.stats(),
  };

  // 3) 打开诗卡：内容动画后必须可见
  document.querySelector('#list .item[data-id="zao-fa-bai-di-cheng"]').click();
  await sleep(1500);
  out.card = {
    shown: document.body.classList.contains("has-detail"),
    title: document.getElementById("dTitle").textContent,
    lastLine: (() => { const l = document.querySelectorAll(".d-poem .line"); return l.length ? l[l.length - 1].textContent : null; })(),
    lineOpacity: op(".d-poem .line"),
    secOpacity: op(".sec"),
    traceOpacity: op(".d-tr"),
    tags: [...document.querySelectorAll("#dTags span")].map((e) => e.textContent),
    place: document.getElementById("dPlaceName").textContent + document.getElementById("dPlaceRegion").textContent,
    pinLabel: document.querySelector(".mk-label") ? document.querySelector(".mk-label").textContent : null,
    swaying: document.getElementById("dPoem").classList.contains("swaying"),
    transform: getComputedStyle(document.getElementById("detail")).transform.slice(0, 40),
  };

  // 4) 展开完整注释
  document.getElementById("btnMore").click();
  await sleep(900);
  out.expand = {
    open: !document.getElementById("dMore").hidden,
    notes: document.querySelectorAll("#dNotes dt").length,
    noteOpacity: op(".notes dt"),
    btn: document.querySelector("#btnMore span").textContent,
  };

  // 5) 关闭
  document.getElementById("closeDetail").click();
  await sleep(600);
  out.closed = { shown: document.body.classList.contains("has-detail"), pins: document.querySelectorAll(".mk-pin").length };

  // 6) 筛选（顶栏 chip 与侧栏 tab 同步 + 重放动效）
  document.querySelector('.tab[data-group="dynasty"][data-val="宋"]').click();
  await sleep(1200);
  out.filter = {
    items: document.querySelectorAll("#list .item").length,
    itemOpacity: op("#list .item"),
    chip: document.querySelector('.chip[data-group="dynasty"][data-val="宋"]').getAttribute("aria-pressed"),
    tab: document.querySelector('.tab[data-group="dynasty"][data-val="宋"]').getAttribute("aria-pressed"),
    markers: document.querySelectorAll(".mk-anim").length,
    markerOpacity: op(".mk-anim"),
    statPoems: document.getElementById("statPoems").textContent,
  };
  document.querySelector('.chip[data-group="dynasty"][data-val="全部"]').click();
  await sleep(1200);

  // 7) 关闭动效：一切必须回到可见静态
  document.getElementById("motionToggle").click();
  await sleep(700);
  out.motionOff = {
    pressed: document.getElementById("motionToggle").getAttribute("aria-pressed"),
    motionOn: window.MOTION.on,
    atmosEnabled: window.ATMOSPHERE.stats().enabled,
    canvasDisplay: canvas ? getComputedStyle(canvas).display : null,
    seal: op("#brand .seal"),
    sidebar: op("#sidebar"),
    item: op("#list .item"),
    markers: op(".mk-anim"),
    poemSway: (() => {
      document.querySelector('#list .item[data-id="jing-ye-si"]').click();
      return null;
    })(),
  };
  await sleep(900);
  out.motionOff.afterOpen = {
    title: document.getElementById("dTitle").textContent,
    lineOpacity: op(".d-poem .line"),
    swayClass: document.getElementById("dPoem").classList.contains("swaying"),
  };

  // 8) 再开启
  document.getElementById("motionToggle").click();
  await sleep(500);
  out.motionBackOn = {
    pressed: document.getElementById("motionToggle").getAttribute("aria-pressed"),
    motionOn: window.MOTION.on,
    atmosEnabled: window.ATMOSPHERE.stats().enabled,
  };

  // 9) 帧率（动效开启时）
  out.fps = await new Promise((res) => {
    let n = 0;
    const t0 = performance.now();
    (function f() {
      n++;
      if (performance.now() - t0 < 1000) requestAnimationFrame(f);
      else res(Math.round((n * 1000) / (performance.now() - t0)));
    })();
  });

  return out;
})()
