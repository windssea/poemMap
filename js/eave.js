/* ============================================================
   金黄屋檐（SVG 生成）
   正面视角的歇山式屋檐：正脊 + 鸱吻 + 瓦垄 + 瓦当 + 斗拱
   返回 SVG 字符串，由 app.js 注入 .eave 容器。
   ============================================================ */
window.EAVE_SVG = (function () {
  "use strict";

  var W = 1000;        // 视图宽度
  var H = 232;         // 视图高度
  var EAVE_Y = 172;    // 檐口（屋顶底边）高度

  // 屋面轮廓：正脊在上，两坡向外展开，檐口平直，两端翘角
  var ROOF =
    "M 14 128 C 74 92 156 62 300 46 L 402 36 L 598 36 L 700 46 " +
    "C 844 62 926 92 986 128 L 986 " + EAVE_Y + " L 14 " + EAVE_Y + " Z";

  function n(v) { return Math.round(v * 10) / 10; }

  function build() {
    var s = [];
    s.push('<svg class="eave-svg" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="xMidYMax meet" aria-hidden="true">');

    /* ── 渐变与裁剪 ── */
    s.push("<defs>");
    s.push('<linearGradient id="goldMain" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#fdf3c8"/>' +
      '<stop offset=".34" stop-color="#f0d489"/>' +
      '<stop offset=".68" stop-color="#d8ab45"/>' +
      '<stop offset="1" stop-color="#a97c1f"/></linearGradient>');
    s.push('<linearGradient id="goldBeam" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#f6e3a4"/>' +
      '<stop offset=".5" stop-color="#d9ae4c"/>' +
      '<stop offset="1" stop-color="#9d7318"/></linearGradient>');
    s.push('<linearGradient id="goldSide" x1="0" y1="0" x2="1" y2="0">' +
      '<stop offset="0" stop-color="#9d7318"/>' +
      '<stop offset=".45" stop-color="#f4e0a0"/>' +
      '<stop offset="1" stop-color="#a97c1f"/></linearGradient>');
    s.push('<clipPath id="roofClip"><path d="' + ROOF + '"/></clipPath>');
    s.push("</defs>");

    /* ── 屋面 ── */
    s.push('<path d="' + ROOF + '" fill="url(#goldMain)" stroke="#8a6218" stroke-width="2.6" stroke-linejoin="round"/>');

    /* ── 瓦垄（放射状）── */
    s.push('<g clip-path="url(#roofClip)" fill="none" stroke="#b98f2c" stroke-width="2" opacity=".34">');
    for (var i = 0; i <= 16; i++) {
      var xt = 500 + (i - 8) * 15.5;
      var xb = 20 + i * 60;
      var cx = (xt + xb) / 2;
      var cy = 104;
      s.push('<path d="M ' + n(xt) + " 38 Q " + n(cx) + " " + cy + " " + n(xb) + " " + (EAVE_Y - 2) + '"/>');
    }
    s.push("</g>");

    /* ── 瓦垄横线（同心弧）── */
    s.push('<g clip-path="url(#roofClip)" fill="none" stroke="#a97c1f" stroke-width="1.8" opacity=".26">');
    s.push('<path d="M 34 120 C 250 148 750 148 966 120"/>');
    s.push('<path d="M 88 96 C 300 122 700 122 912 96"/>');
    s.push('<path d="M 152 74 C 330 96 670 96 848 74"/>');
    s.push('<path d="M 226 54 C 360 72 640 72 774 54"/>');
    s.push("</g>");

    /* ── 两端翘角 ── */
    s.push('<path d="M 14 128 C -6 116 -10 92 6 78 C 12 100 22 114 40 122 Z" ' +
      'fill="url(#goldSide)" stroke="#8a6218" stroke-width="2.4" stroke-linejoin="round"/>');
    s.push('<path d="M 986 128 C 1006 116 1010 92 994 78 C 988 100 978 114 960 122 Z" ' +
      'fill="url(#goldSide)" stroke="#8a6218" stroke-width="2.4" stroke-linejoin="round"/>');

    /* ── 正脊与鸱吻 ── */
    s.push('<path d="M 396 46 C 366 44 344 30 350 14 C 364 28 380 34 400 34 Z" ' +
      'fill="url(#goldMain)" stroke="#8a6218" stroke-width="2.2" stroke-linejoin="round"/>');
    s.push('<path d="M 604 46 C 634 44 656 30 650 14 C 636 28 620 34 600 34 Z" ' +
      'fill="url(#goldMain)" stroke="#8a6218" stroke-width="2.2" stroke-linejoin="round"/>');
    s.push('<rect x="390" y="26" width="220" height="21" rx="10.5" ' +
      'fill="url(#goldMain)" stroke="#8a6218" stroke-width="2.2"/>');
    s.push('<circle cx="500" cy="18" r="10" fill="url(#goldMain)" stroke="#8a6218" stroke-width="2.2"/>');
    s.push('<path d="M 500 0 L 506 12 L 500 9 L 494 12 Z" fill="#d8ab45" stroke="#8a6218" stroke-width="1.4"/>');

    /* ── 瓦当（檐口圆瓦头）── */
    var t, x, y;
    s.push('<g fill="url(#goldMain)" stroke="#8a6218" stroke-width="1.3">');
    for (i = 0; i <= 21; i++) {
      x = 30 + i * 47;
      t = (x - 14) / 972;
      y = EAVE_Y - 7 - 4 * Math.sin(Math.PI * Math.min(1, Math.max(0, t)));
      s.push('<circle cx="' + n(x) + '" cy="' + n(y) + '" r="5.6"/>');
    }
    s.push("</g>");

    /* ── 檐下斗拱 ── */
    s.push('<g>');
    for (i = 0; i <= 15; i++) {
      x = 44 + i * 60;
      s.push('<rect x="' + n(x - 15) + '" y="' + (EAVE_Y + 4) + '" width="30" height="9" rx="2.5" ' +
        'fill="url(#goldMain)" stroke="#8a6218" stroke-width="1.3"/>');
      s.push('<rect x="' + n(x - 8) + '" y="' + (EAVE_Y + 14) + '" width="16" height="10" rx="2" ' +
        'fill="#c79a35" stroke="#8a6218" stroke-width="1.2"/>');
    }
    s.push("</g>");

    /* ── 额枋 ── */
    s.push('<rect x="8" y="' + (EAVE_Y + 26) + '" width="984" height="16" rx="4" ' +
      'fill="url(#goldBeam)" stroke="#8a6218" stroke-width="2"/>');
    s.push('<rect x="8" y="' + (EAVE_Y + 42) + '" width="984" height="6" rx="3" ' +
      'fill="#8a1f16" stroke="#8a6218" stroke-width="1.2"/>');

    s.push("</svg>");
    return s.join("");
  }

  return { build: build, height: H, width: W };
})();
