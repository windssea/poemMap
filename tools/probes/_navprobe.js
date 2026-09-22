/* 详情抽屉里「上一篇 / 下一篇」的溢出探针
   ----------------------------------------------------------
   方案 P0-D 要求：长诗名不得挤压页码、不得导致横向溢出。
   量四件事：
     · .d-nav 自身有没有横向溢出（scrollWidth > clientWidth）
     · 两个按钮有没有被内容撑破（scrollWidth > clientWidth + 1）
     · 页码有没有被挤（.dn-pos 的实际宽度 vs 需要的宽度）
     · 抽屉有没有横向溢出
   用法：CDP_SETUP=tools/probes/_navprobe.js node tools/cdp.js <url> --eval "1" */
(function () {
  var nav = document.querySelector(".d-nav");
  if (!nav) return { err: "no .d-nav" };
  var pos = nav.querySelector(".dn-pos");
  var btns = [].slice.call(nav.querySelectorAll(".dn-btn"));
  var body = document.querySelector(".detail-body");
  var detail = document.querySelector("#detail");
  function box(el) {
    var r = el.getBoundingClientRect();
    return { w: Math.round(r.width), l: Math.round(r.left), r: Math.round(r.right) };
  }
  return {
    viewport: innerWidth + "x" + innerHeight,
    drawer: { w: detail.offsetWidth, l: Math.round(detail.getBoundingClientRect().left) },
    nav: {
      w: box(nav).w,
      overflowX: nav.scrollWidth - nav.clientWidth,
      left: box(nav).l, right: box(nav).r,
    },
    pos: { w: box(pos).w, text: pos.textContent.trim(), overflow: pos.scrollWidth - pos.clientWidth },
    prev: { title: btns[0] ? btns[0].querySelector(".dn-t").textContent : "",
            w: btns[0] ? box(btns[0]).w : 0,
            clipped: btns[0] ? btns[0].scrollWidth - btns[0].clientWidth : 0 },
    next: { title: btns[1] ? btns[1].querySelector(".dn-t").textContent : "",
            w: btns[1] ? box(btns[1]).w : 0,
            clipped: btns[1] ? btns[1].scrollWidth - btns[1].clientWidth : 0 },
    bodyOverflowX: body ? body.scrollWidth - body.clientWidth : null,
    docOverflowX: document.documentElement.scrollWidth - innerWidth,
  };
})()
