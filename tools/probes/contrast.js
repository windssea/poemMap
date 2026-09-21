/* 在真实页面里量对比度：遍历所有有文字的节点，取计算后的颜色，
   再往上找第一个不透明背景，按 WCAG 2.1 算比值。
   ----------------------------------------------------------
   为什么不只看令牌：令牌算对不等于渲染对——半透明背景、
   backdrop-filter、渐变、继承色都会改变最终结果。
   用法：node tools/cdp.js <url> --eval "@tools/probes/contrast.js" 6000 */
(() => {
  const lum = (r, g, b) => {
    const f = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const parse = (s) => {
    const m = String(s).match(/rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\)/);
    return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
  };
  const ratio = (a, b) => {
    const la = lum(a.r, a.g, a.b), lb = lum(b.r, b.g, b.b);
    const hi = Math.max(la, lb), lo = Math.min(la, lb);
    return (hi + 0.05) / (lo + 0.05);
  };
  /* 往上找第一个基本不透明的背景色。
     ⚠️ 渐变背景（朱印、选中的 chip）取不到单一颜色：JS 读 backgroundImage
     只能拿到 linear-gradient(...) 这个字符串，算不出对比度。
     这时候**不能**继续往上找纸色——那会把「红底白字」误判成「白字压纸」，
     报出一堆 1.1:1 的假阳性。正确做法是标成「跳过（渐变底）」，
     由令牌数学单独核对（实测 #fdf4e6 on #b0362c = 5.65:1，达标）。 */
  const bgOf = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      const cs = getComputedStyle(n);
      const img = cs.backgroundImage;
      if (img && img !== "none" && /gradient/.test(img)) return { gradient: true };
      const c = parse(cs.backgroundColor);
      if (c && c.a >= 0.85) return c;
      n = n.parentElement;
    }
    return { r: 242, g: 233, b: 215, a: 1 };   // 兜底：页面纸色
  };

  const out = [];
  let skipped = 0;
  document.querySelectorAll("body *").forEach((el) => {
    /* 只看直接含文字的叶子/近叶子节点 */
    const txt = Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join("");
    if (!txt) return;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity < 0.15) return;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    /* 纯装饰：显式标了 aria-hidden 且不在交互元素里 */
    const deco = el.closest('[aria-hidden="true"]') && !el.closest("button, a, input");
    const fg = parse(cs.color);
    const bg = bgOf(el);
    if (!fg) return;
    if (bg && bg.gradient) { skipped++; return; }
    if (!bg) return;
    const size = parseFloat(cs.fontSize);
    const bold = (+cs.fontWeight) >= 700;
    const large = size >= 24 || (bold && size >= 18.66);
    const need = large ? 3 : 4.5;
    const cr = ratio(fg, bg);
    if (cr < need) {
      out.push({
        sel: el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/)[0] : ""),
        text: txt.slice(0, 18),
        size: +size.toFixed(1),
        ratio: +cr.toFixed(2),
        need,
        deco: !!deco,
        color: cs.color,
        bg: `rgb(${bg.r}, ${bg.g}, ${bg.b})`,
      });
    }
  });

  const real = out.filter((o) => !o.deco);
  const decoOnly = out.filter((o) => o.deco);
  return JSON.stringify({
    fail: real.length,
    failDecorative: decoOnly.length,
    skippedGradientBg: skipped,
    worst: real.sort((a, b) => a.ratio - b.ratio).slice(0, 12),
    decorative: decoOnly.slice(0, 6),
  }, null, 1);
})()
