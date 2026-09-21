/* 第二轮优化的实测走查：C14 / C15 / C18 / C19 / C21 / C22
   用法：node tools/cdp.js http://127.0.0.1:5179/ --eval "@tools/probes/round2.js" 7000 */
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const raf = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const key = (el, k) => (el || document).dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
  const setVal = (input, v) => {
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    set.call(input, v);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const out = {};
  const step = async (name, fn) => {
    try { out[name] = await fn(); }
    catch (e) { out[name] = { ERROR: e.message }; }
  };
  const openPanelMode = async (label) => {
    document.getElementById("menuBtn").click();
    await raf(); await sleep(240);
    const btn = Array.from(document.querySelectorAll("#menuPop button"))
      .find((b) => b.textContent.indexOf(label) > -1);
    if (!btn) throw new Error("菜单里找不到「" + label + "」");
    btn.click();
    await raf(); await sleep(500);
  };

  /* ---------- C14 诗人面板搜索 ---------- */
  await step("C14_poetSearch", async () => {
    await openPanelMode("诗人索引");
    const ps = document.querySelector("#panelBody .panel-search input");
    const before = document.querySelectorAll("#panelBody .row").length;
    if (!ps) return { hasSearch: false, rowsBefore: before };
    setVal(ps, "曾");
    await raf(); await sleep(240);
    const after = document.querySelectorAll("#panelBody .row").length;
    return {
      hasSearch: true, rowsBefore: before, rowsAfterTypeZeng: after,
      narrowed: after > 0 && after < before,
      firstHit: (document.querySelector("#panelBody .row .t") || {}).textContent || "",
    };
  });

  /* ---------- C15 主题面板搜索 ---------- */
  await step("C15_themeSearch", async () => {
    const c = document.querySelector("#panelClose");
    if (c) c.click();
    await raf(); await sleep(340);
    await openPanelMode("主题索引");
    const ts = document.querySelector("#panelBody .panel-search input");
    const tBefore = document.querySelectorAll("#panelBody .filters button").length;
    if (!ts) return { hasSearch: false, chipsBefore: tBefore };
    setVal(ts, "边塞");
    await raf(); await sleep(240);
    return {
      hasSearch: true, chipsBefore: tBefore,
      chipsAfter: document.querySelectorAll("#panelBody .filters button").length,
      firstChip: (document.querySelector("#panelBody .filters button") || {}).textContent || "",
    };
  });
  const pc = document.querySelector("#panelClose");
  if (pc) pc.click();
  await raf(); await sleep(340);

  /* ---------- C18 篇目栏收起时按 ↓ ---------- */
  await step("C18_arrowWhenCollapsed", async () => {
    const wasCollapsed = !document.body.classList.contains("side-open");
    key(document, "ArrowDown");
    await raf(); await sleep(560);
    return {
      wasCollapsed,
      openedNow: document.body.classList.contains("side-open"),
      selected: (document.querySelector("#list .item.on .it-t") || {}).textContent || "",
    };
  });
  key(document, "Escape");
  await raf(); await sleep(440);

  /* ---------- 打开一首「一处多诗」的 ---------- */
  const openOneMany = async () => {
    const dots = Array.from(document.querySelectorAll(".dot-wrap"));
    const many = dots.find((d) => {
      const l = d.getAttribute("aria-label") || "";
      const m = /(\d+) 首诗词/.exec(l);
      return m && +m[1] > 3;
    });
    if (!many) throw new Error("没找到题咏 >3 的地标");
    many.focus();
    key(many, "Enter");
    await raf(); await sleep(600);
    return many;
  };
  await step("openManyPlace", async () => {
    await openOneMany();
    return { listOpen: !!document.querySelector("#poemList.on"), detailOpen: !!document.querySelector("#detail.on") };
  });

  await step("C22_othersButton", async () => {
    if (document.querySelector("#poemList.on")) {
      const it = document.querySelector("#poemList .pl-item");
      if (it) { it.click(); await raf(); await sleep(600); }
    }
    const others = document.querySelector("#detail .others-more");
    return {
      detailOpen: !!document.querySelector("#detail.on"),
      hasOthersButton: !!others,
      text: others ? others.textContent.replace(/\s+/g, " ").trim() : "",
      hasKbdHint: !!document.querySelector("#detail .others-more kbd"),
    };
  });

  /* ---------- C19 L 键回同处其他几首 ---------- */
  await step("C19", async () => {
    if (!document.querySelector("#detail .others-more")) return { skipped: "此处只此一首，没有「另有」入口" };
    key(document, "l");
    await raf(); await sleep(560);
    return {
      listOpenedByL: !!document.querySelector("#poemList.on"),
      detailClosedByL: !document.querySelector("#detail.on"),
    };
  });

  /* ---------- C21 收尾动作 ---------- */
  await step("C21_endcap", async () => {
    key(document, "Escape");
    await raf(); await sleep(340);
    await openOneMany();
    if (document.querySelector("#poemList.on")) {
      const it = document.querySelector("#poemList .pl-item");
      if (it) { it.click(); await raf(); await sleep(600); }
    }
    const end = document.querySelector("#detail .d-endcap .d-done");
    const r = {
      detailOpen: !!document.querySelector("#detail.on"),
      hasEndcap: !!end,
      text: end ? end.textContent.replace(/\s+/g, " ").trim() : "",
    };
    if (end) { end.click(); await raf(); await sleep(560); }
    r.endcapClosesDrawer = !document.querySelector("#detail.on");
    return r;
  });

  return JSON.stringify(out, null, 1);
})()
