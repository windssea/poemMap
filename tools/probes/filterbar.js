/* 量右上筛选区：两行时的对齐情况
   ----------------------------------------------------------
   用户截图里发现「两行时与外框错位」。先量清楚再改：
   容器是谁、两行的盒模型、右边距差多少。
   用法：node tools/cdp.js <url> --eval "@tools/probes/filterbar.js" 6000 */
(() => {
  const out = { vw: innerWidth };
  const bar = document.getElementById("tools");
  if (!bar) return JSON.stringify({ error: "找不到 #tools" });
  const r = bar.getBoundingClientRect();
  out.tools = { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };

  const kids = [...bar.children].map((el) => {
    const b = el.getBoundingClientRect();
    return {
      sel: el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (typeof el.className === "string" && el.className ? "." + el.className.trim().split(/\s+/)[0] : ""),
      x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height),
      right: Math.round(b.right),
      display: getComputedStyle(el).display,
      flexWrap: getComputedStyle(el).flexWrap,
      radius: getComputedStyle(el).borderRadius,
      bg: getComputedStyle(el).backgroundColor,
      border: getComputedStyle(el).borderTopWidth + " " + getComputedStyle(el).borderTopColor,
      shadow: getComputedStyle(el).boxShadow.slice(0, 60),
    };
  });
  out.children = kids;

  /* 每个 chip 容器里有多少行 */
  [...bar.querySelectorAll(":scope > *")].forEach((box, i) => {
    const rows = new Set([...box.children].map((c) => Math.round(c.getBoundingClientRect().y)));
    kids[i].rowCount = rows.size;
    if (rows.size > 1) {
      const cs = [...box.children].map((c) => c.getBoundingClientRect());
      const lefts = [...new Set(cs.map((b) => Math.round(b.left)))].sort((a, b) => a - b);
      const rights = cs.map((b) => Math.round(b.right));
      kids[i].rowLefts = lefts;
      kids[i].maxRight = Math.max(...rights);
      kids[i].boxRight = Math.round(box.getBoundingClientRect().right);
      kids[i].paddingRight = getComputedStyle(box).paddingRight;
      kids[i].rowGap = getComputedStyle(box).rowGap;
    }
  });

  return JSON.stringify(out, null, 1);
})()
