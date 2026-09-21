/* 无障碍走查：C08/C09/C10/C11/C12/C13 逐条实测
   ----------------------------------------------------------
   不是读令牌、不是读代码——是真的在页面上按键盘、量尺寸、看焦点在哪。
   用法：node tools/cdp.js http://127.0.0.1:5179/ --eval "@tools/probes/a11y.js" 7000 */
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const raf = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const out = {};

  /* ---------- C13：所有可交互元素的命中区 ---------- */
  const small = [];
  document.querySelectorAll("button, a[href], input, [role=button]").forEach((el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    /* inert 子树整棵跳过：里面的东西既不可聚焦也不该被辅助技术读到 */
    if (el.closest("[inert]")) return;
    if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity < 0.15) return;
    /* ::after 撑开的命中区不算在 rect 里，单独量。
       只认 px 值——百分比是相对包含块的，parseFloat 会把 "50%" 读成 50，
       凭空算出一个巨大的命中区（这个坑踩过一次）。 */
    const after = getComputedStyle(el, "::after");
    let w = r.width, h = r.height;
    if (after && after.content !== "none" && after.position === "absolute") {
      const px = (v) => (/^-?[\d.]+px$/.test(v) ? parseFloat(v) : 0);
      const t = px(after.top), b = px(after.bottom), l = px(after.left), rr = px(after.right);
      if (t < 0) h += -t; if (b < 0) h += -b;
      if (l < 0) w += -l; if (rr < 0) w += -rr;
    }
    if (w < 44 || h < 44) {
      small.push({ sel: el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (typeof el.className === "string" && el.className ? "." + el.className.trim().split(/\s+/)[0] : ""), w: Math.round(w), h: Math.round(h) });
    }
  });
  out.C13_smallTargets = small;

  /* ---------- Tab 序检查：藏起来的面板里还留着多少可聚焦元素 ----------
     这是本轮真正查出问题的那一项。`opacity: 0` / `transform: translateX(102%)`
     这类「藏法」**不把元素移出 Tab 序**，只有 display:none / visibility:hidden /
     inert 才会。实测：收起的篇目栏里曾有 330 个可聚焦元素、关掉的菜单里 8 个、
     停用的卡片里 2 个 —— 键盘用户从页首按 Tab 要先穿过它们。
     aria-hidden 也挡不住键盘（它只管辅助技术，不管焦点）。 */
  const focusable = (root) => Array.from(
    root.querySelectorAll("a[href], button, input, select, textarea, [tabindex]:not([tabindex='-1'])")
  ).filter((e) => !e.disabled && !e.closest("[inert]"));
  const hiddenSurfaces = {};
  [["#sidebar", "side-open"], ["#detail", null], ["#panel", null], ["#poemList", null]]
    .forEach(([sel, flag]) => {
      const el = document.querySelector(sel);
      if (!el) return;
      const visible = flag ? document.body.classList.contains(flag) : el.classList.contains("on");
      if (visible) return;                       // 开着的时候不算问题
      hiddenSurfaces[sel] = focusable(el).length;
    });
  const menu = document.getElementById("menuPop");
  if (menu && menu.hasAttribute("hidden")) hiddenSurfaces["#menuPop"] = focusable(menu).length;
  const card = document.getElementById("card");
  if (card && !card.classList.contains("on")) hiddenSurfaces["#card"] = focusable(card).length;
  out.tabOrderLeaks = hiddenSurfaces;
  out.tabOrderLeakTotal = Object.values(hiddenSurfaces).reduce((a, b) => a + b, 0);

  /* ---------- C09：地标能不能用键盘走到 ---------- */
  const dots = Array.from(document.querySelectorAll(".dot-wrap"));
  const tabbable = dots.filter((d) => d.tabIndex === 0);
  out.C09 = {
    totalMarkers: dots.length,
    tabStops: tabbable.length,
    hasRole: dots[0] ? dots[0].getAttribute("role") : null,
    labelSample: dots[0] ? dots[0].getAttribute("aria-label") : null,
    labelIsEmpty: dots.filter((d) => !d.getAttribute("aria-label")).length,
  };
  if (tabbable.length === 1) {
    const first = tabbable[0];
    first.focus();
    const before = first.getAttribute("data-place");
    const ev = (k) => first.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
    ev("ArrowRight");
    await raf(); await sleep(80);
    const focusedAfter = document.activeElement;
    const after = focusedAfter && focusedAfter.getAttribute ? focusedAfter.getAttribute("data-place") : null;
    out.C09.arrowMoved = before !== after && !!after;
    out.C09.focusStayedOnMarker = !!(focusedAfter && focusedAfter.classList && focusedAfter.classList.contains("dot-wrap"));
    out.C09.hoverCardShown = !!document.querySelector("#placeHover.on");
    /* 回车打开 */
    (document.activeElement || first).dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    await raf(); await sleep(420);
    out.C09.enterOpened = !!document.querySelector("#poemList.on, #detail.on");
  }

  /* ---------- C10：抽屉打开后焦点在不在抽屉里 ---------- */
  /* 注意：从篇目栏点一首**不会**开抽屉（那是刻意的——目录只定位地标）。
     所以这里用命令面板里的「随机读一首」来开，那是确定会开抽屉的入口。 */
  const openDrawer = async () => {
    const d0 = document.getElementById("detail");
    if (d0 && d0.classList.contains("on")) return d0;
    document.getElementById("paletteBtn").click();
    await raf(); await sleep(300);
    const acts = Array.from(document.querySelectorAll("#palette .pal-item"));
    const rand = acts.find((b) => b.textContent.indexOf("随机读一首") > -1) || acts[0];
    if (rand) rand.click();
    await raf(); await sleep(600);
    return document.getElementById("detail");
  };
  const d = await openDrawer();
  if (d && d.classList.contains("on")) {
    out.C10 = {
      drawerOpen: true,
      activeInDetail: d.contains(document.activeElement),
      detailTabIndex: d.getAttribute("tabindex"),
      activeTag: document.activeElement ? document.activeElement.tagName.toLowerCase() : null,
      activeIsDrawerItself: document.activeElement === d,
    };
  } else {
    out.C10 = { drawerOpen: false, why: "没能打开抽屉" };
  }
  /* 关掉，看焦点有没有还回去 */
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await raf(); await sleep(300);
  out.C10.afterClose_activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : null;
  out.C10.afterClose_focusNotInBody = document.activeElement !== document.body;

  /* ---------- C11：命令面板打开时背景是否 inert ---------- */
  const stage = document.getElementById("stage");
  out.C11 = { stageExists: !!stage, inertBefore: stage ? stage.hasAttribute("inert") : null };
  document.getElementById("paletteBtn") && document.getElementById("paletteBtn").click();
  await raf(); await sleep(320);
  out.C11.paletteOpen = !!document.querySelector("#palette.on");
  out.C11.inertAfter = stage ? stage.hasAttribute("inert") : null;
  /* inert 里的元素能不能被 Tab 到：用 :focus 试 */
  const searchInput = document.getElementById("q");
  if (searchInput) { searchInput.focus(); out.C11.backgroundFocusable = document.activeElement === searchInput; }
  document.querySelector("#palette .pal-input input") && document.querySelector("#palette .pal-input input").blur();
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await raf(); await sleep(260);
  /* 字段名要说实话：这里是「关闭之后 inert 有没有被摘掉」，true 才是对的 */
  out.C11.inertRemovedAfterClose = stage ? !stage.hasAttribute("inert") : null;

  /* ---------- C08：索引是否被缓存（同一引用） ---------- */
  if (window.__poetIndex && window.__themeIndex) {
    const a1 = window.__poetIndex(), a2 = window.__poetIndex();
    const t1 = window.__themeIndex(), t2 = window.__themeIndex();
    out.C08 = {
      poetSameRef: a1 === a2,
      themeSameRef: t1 === t2,
      poets: a1.length,
      themes: t1.length,
    };
  } else {
    out.C08 = { note: "devtools 未暴露 __poetIndex（生产构建里会被 tree-shake，需在 dev 下跑）" };
  }

  return JSON.stringify(out, null, 1);
})()
