/* ============================================================
   篇目小景（程序生成，全离线）
   ----------------------------------------------------------
   设计稿里篇目行左侧都有一幅指甲盖大的青绿小景。这里不引入图片，
   按篇目 id 生成一张确定的「一峰一水」小画：
     天（淡染）→ 日轮 → 三重山（远浅近深）→ 水面波纹
     唐用亭、宋用塔，北地（甘新宁蒙青）换暖沙色阶。
   同一首始终得到同一张，便于辨认，也不用缓存。
   ============================================================ */
export const THUMBS = (function () {
  "use strict";

  var W = 94, H = 86;

  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  function rng(seed) {
    var s = seed >>> 0 || 1;
    return function () { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
  }

  /* 色板：青绿 / 暖沙 */
  var PALETTE = {
    green: { sky: ["#f8f2df", "#eaf2e4"], far: "#b7d0b8", mid: "#8fb79c", near: "#678f7b", water: "#a9c8d2", ink: "#4d7263" },
    teal:  { sky: ["#f4f2e6", "#e8f1ec"], far: "#bad4cf", mid: "#93bdb2", near: "#6b9d94", water: "#9dc0cc", ink: "#4a7c76" },
    sand:  { sky: ["#faf3e2", "#f2ecdc"], far: "#dfd0ab", mid: "#c6b184", near: "#a2906a", water: "#b6c6c4", ink: "#7c6a48" },
    dusk:  { sky: ["#fbf2e4", "#f4e8dd"], far: "#dcc3ad", mid: "#bda087", near: "#96795f", water: "#b3c2c8", ink: "#7a5f48" },
  };
  var NORTH = /甘肃|新疆|宁夏|内蒙古|青海/;

  /* 一重山：中间起峰、两端入地 */
  function range(rand, base, amp, n) {
    var d = "M0 " + H + " L0 " + (base - amp * 0.34).toFixed(1);
    for (var i = 1; i <= n; i++) {
      var t = i / n;
      var y = base - amp * (0.32 + 0.68 * rand()) * Math.sin(Math.PI * Math.min(1, t * 1.1));
      d += " L" + (t * W).toFixed(1) + " " + y.toFixed(1);
    }
    d += " L" + W + " " + H + " Z";
    return d;
  }

  /* 亭（唐）：一檐一柱 */
  function pavilion(x, y, s, fill) {
    return "M" + (x - s) + " " + y + " L" + (x + s) + " " + y +
      " L" + (x + s * 0.34) + " " + (y - s * 0.82) + " L" + (x - s * 0.34) + " " + (y - s * 0.82) + " Z" +
      '<rect x="' + (x - s * 0.13) + '" y="' + y + '" width="' + (s * 0.26) + '" height="' + (s * 0.72) + '" fill="' + fill + '"/>';
  }

  /* 塔（宋）：三层叠檐 */
  function pagoda(x, y, s, fill) {
    var d = "", lv = 3, i, ty, tw;
    for (i = 0; i < lv; i++) {
      ty = y - i * (s * 0.62);
      tw = s * (1 - i * 0.2);
      d += "M" + (x - tw) + " " + ty + " L" + (x + tw) + " " + ty +
        " L" + (x + tw * 0.36) + " " + (ty - s * 0.5) + " L" + (x - tw * 0.36) + " " + (ty - s * 0.5) + " Z ";
      if (i < lv - 1) {
        d += '<rect x="' + (x - tw * 0.26) + '" y="' + (ty - s * 0.52) + '" width="' + (tw * 0.52) +
          '" height="' + (s * 0.12) + '" fill="' + fill + '"/>';
      }
    }
    d += '<rect x="' + (x - s * 0.1) + '" y="' + y + '" width="' + (s * 0.2) + '" height="' + (s * 0.5) + '" fill="' + fill + '"/>';
    return d;
  }

  function svg(p) {
    var h = hash(String(p.id || p.title || "p"));
    var rand = rng(h);
    var pal = PALETTE.green;
    if (p.dynasty === "宋") pal = PALETTE.teal;
    if (p.place && NORTH.test(p.place.region || "")) pal = p.dynasty === "宋" ? PALETTE.dusk : PALETTE.sand;
    else if (rand() > 0.82) pal = PALETTE.dusk;

    var gy = 46 + rand() * 5;                       // 山脚线
    var sunX = 14 + rand() * 62;
    var sunR = 4.4 + rand() * 3.4;

    var out = '<svg viewBox="0 0 94 86" preserveAspectRatio="none" aria-hidden="true">';
    out += '<defs><linearGradient id="s' + h.toString(36) + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="' + pal.sky[0] + '"/><stop offset="1" stop-color="' + pal.sky[1] + '"/></linearGradient></defs>';
    out += '<rect width="94" height="86" fill="url(#s' + h.toString(36) + ')"/>';
    out += '<circle cx="' + sunX.toFixed(1) + '" cy="' + (12 + rand() * 6).toFixed(1) + '" r="' + sunR.toFixed(1) +
      '" fill="#eccb8d" opacity="' + (0.4 + rand() * 0.3).toFixed(2) + '"/>';
    /* 云：两道极淡的横笔 */
    out += '<path d="M' + (6 + rand() * 12).toFixed(0) + ' ' + (21 + rand() * 8).toFixed(0) +
      ' q 12 -3 24 0 t 22 0" fill="none" stroke="#ffffff" stroke-width="2.4" opacity=".5" stroke-linecap="round"/>';
    /* 三重山 */
    out += '<path d="' + range(rand, gy - 12, 30, 7) + '" fill="' + pal.far + '" opacity=".85"/>';
    out += '<path d="' + range(rand, gy - 2, 25, 6) + '" fill="' + pal.mid + '" opacity=".94"/>';
    out += '<path d="' + range(rand, gy + 8, 19, 5) + '" fill="' + pal.near + '"/>';
    /* 点景：唐亭宋塔 */
    var bx = 22 + rand() * 50, by = gy + 9 + rand() * 3;
    out += p.dynasty === "宋"
      ? pagoda(bx.toFixed(1), by.toFixed(1), 3.4, pal.ink)
      : pavilion(bx.toFixed(1), by.toFixed(1), 3.8, pal.ink);
    /* 水 */
    out += '<rect x="0" y="' + (H - 15) + '" width="94" height="15" fill="' + pal.water + '" opacity=".5"/>';
    out += '<path d="M6 ' + (H - 10) + ' q 10 -3 20 0 t 20 0 t 20 0" fill="none" stroke="#ffffff" stroke-width="1.6" opacity=".6"/>';
    out += '<path d="M16 ' + (H - 5) + ' q 10 -3 20 0 t 20 0" fill="none" stroke="#ffffff" stroke-width="1.4" opacity=".42"/>';
    out += "</svg>";
    return out;
  }

  return { svg: svg, hash: hash };
})();

export default THUMBS;
