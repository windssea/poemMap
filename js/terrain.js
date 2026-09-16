/* ============================================================
   山体层（程序生成，全离线）
   ----------------------------------------------------------
   设计稿里的地图是一张「青绿山水」中国图：淡青绿的省区、墨青的
   山峦、浅蓝的水系。这里按青绿设色生成山体色阶（山阴偏墨青、
   山巅近白绿），与省区底色同调，靠色相与明暗一起表现山。

   山脉仍由「多个山组」拼接：沿山脊每约 0.9° 摆一组 2×3 座峰，
   后排偏北（受光、浅）、前排偏南（背光、深），底下压一条山根。
   ============================================================ */
window.TERRAIN = (function () {
  "use strict";

  /* 青绿色阶：[山阴, 山腰, 山巅] */
  var TONES = [
    ["#7ea691", "#a3c3a8", "#cfe2cd"],
    ["#86ad96", "#aac8ac", "#d4e5cf"],
    ["#93b89c", "#b4cfb2", "#dae9d4"],
    ["#8aa891", "#aec6a6", "#d8e5cd"],
  ];

  /* 山系：spine 脊线；w 宽度（纬度度数）；sp 山组间距；tone 色调 */
  var RANGES = [
    { spine: [[43.9, 80.2], [43.3, 83.5], [43.0, 87.0], [42.4, 90.5], [41.8, 94.0]], w: 3.2, sp: 0.85, tone: 3 }, // 天山
    { spine: [[48.6, 85.6], [47.6, 88.5], [46.8, 91.2]], w: 2.3, sp: 0.9, tone: 3 },                            // 阿尔泰山
    { spine: [[36.4, 75.5], [35.8, 79.5], [35.3, 83.5], [35.6, 87.5], [35.2, 91.5], [36.0, 95.0]], w: 3.0, sp: 0.9, tone: 3 }, // 昆仑山
    { spine: [[30.8, 80.5], [29.8, 83.5], [28.6, 86.5], [28.0, 89.5], [28.4, 92.5], [29.4, 95.2]], w: 3.2, sp: 0.9, tone: 1 }, // 喜马拉雅
    { spine: [[32.6, 82.0], [32.0, 86.0], [32.3, 90.0], [33.0, 94.2]], w: 2.6, sp: 1.0, tone: 2 },              // 唐古拉
    { spine: [[39.0, 95.8], [38.4, 98.5], [37.6, 101.5], [37.0, 103.6]], w: 2.0, sp: 0.85, tone: 3 },           // 祁连山
    { spine: [[34.3, 105.0], [34.0, 107.2], [33.8, 109.2], [33.6, 111.2], [33.4, 112.8]], w: 1.9, sp: 0.8, tone: 1 }, // 秦岭
    { spine: [[32.6, 106.4], [32.0, 108.4], [31.7, 110.4]], w: 1.7, sp: 0.85, tone: 2 },                       // 大巴山
    { spine: [[40.2, 113.6], [38.8, 113.3], [37.4, 113.0], [36.2, 112.6], [35.4, 112.0]], w: 2.0, sp: 0.8, tone: 1 }, // 太行山
    { spine: [[52.8, 122.6], [50.5, 121.8], [48.2, 120.8], [46.4, 119.6]], w: 2.8, sp: 0.9, tone: 0 },          // 大兴安岭
    { spine: [[48.6, 130.6], [47.6, 128.2], [46.8, 126.6]], w: 2.0, sp: 0.85, tone: 0 },                       // 小兴安岭
    { spine: [[43.6, 129.0], [42.2, 128.2], [41.2, 126.8], [40.8, 125.4]], w: 2.2, sp: 0.8, tone: 0 },          // 长白山
    { spine: [[31.5, 98.5], [29.5, 99.5], [27.5, 100.3], [25.8, 101.3], [24.2, 102.0]], w: 2.4, sp: 0.85, tone: 1 }, // 横断山
    { spine: [[26.8, 103.5], [25.8, 105.6], [25.0, 107.2]], w: 2.0, sp: 0.9, tone: 2 },                        // 云贵高原
    { spine: [[25.8, 110.8], [25.2, 112.8], [24.8, 114.8], [25.2, 116.5]], w: 2.0, sp: 0.85, tone: 0 },         // 南岭
    { spine: [[28.0, 117.6], [26.8, 117.2], [25.5, 116.9]], w: 1.6, sp: 0.8, tone: 2 },                        // 武夷山
    { spine: [[31.8, 113.8], [31.2, 115.3], [30.8, 116.6]], w: 1.6, sp: 0.8, tone: 2 },                        // 大别山
    { spine: [[41.8, 107.5], [41.2, 110.0], [40.9, 112.0]], w: 1.8, sp: 0.85, tone: 3 },                       // 阴山
    { spine: [[39.2, 105.9], [38.4, 105.8], [37.8, 105.9]], w: 1.3, sp: 0.7, tone: 3 },                        // 贺兰山
    { spine: [[35.9, 106.0], [35.3, 106.3]], w: 1.1, sp: 0.7, tone: 3 },                                       // 六盘山
    { spine: [[36.5, 117.0], [36.1, 117.2]], w: 1.1, sp: 0.7, tone: 1 },                                       // 泰山
    { spine: [[24.5, 121.2], [23.6, 120.9], [22.8, 120.7]], w: 1.3, sp: 0.7, tone: 0 },                        // 中央山脉
  ];

  /* 设计稿的地图是干净的浮雕图：不加白雾、不加贴纸式点景 */
  var MIST = [];

  var DECOR = [];

  function rnd(seed) { return Math.abs(Math.sin(seed * 12.9898) * 43758.5453) % 1; }

  /* ---------- 山体基线：沿脊线的收尖闭合轮廓 ---------- */
  function ringFromSpine(spine, width, shrink, seed, driftLat, taperPow) {
    var half = (width * shrink) / 2;
    var n = spine.length;
    var pow = taperPow === undefined ? 0.55 : taperPow;
    var left = [], right = [], i, p, prev, next, dLat, dLng, len, nLat, nLng, w, cos, t, taper, jit;

    for (i = 0; i < n; i++) {
      p = spine[i];
      prev = spine[Math.max(0, i - 1)];
      next = spine[Math.min(n - 1, i + 1)];
      cos = Math.cos((p[0] * Math.PI) / 180);
      dLat = next[0] - prev[0];
      dLng = (next[1] - prev[1]) * cos;
      len = Math.sqrt(dLat * dLat + dLng * dLng) || 1;
      nLat = -dLng / len;
      nLng = dLat / len;
      t = n > 1 ? i / (n - 1) : 0.5;
      taper = Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, t))), pow);
      jit = 0.09 * width * taper;
      w = half * (0.66 + 0.34 * Math.abs(Math.sin(i * 2.7 + seed))) * taper;
      left.push([
        p[0] + nLat * w + driftLat * taper + jit * Math.sin(i * 3.1 + seed),
        p[1] + (nLng * w) / (cos || 1) + (jit * Math.cos(i * 2.3 + seed)) / (cos || 1),
      ]);
      right.push([
        p[0] - nLat * w + driftLat * taper + jit * Math.sin(i * 1.7 + seed),
        p[1] - (nLng * w) / (cos || 1) + (jit * Math.cos(i * 2.9 + seed)) / (cos || 1),
      ]);
    }
    return left.concat(right.reverse());
  }

  /* ---------- 一座峰（底边在下，峰尖朝北） ---------- */
  function peak(lat, lng, baseW, height, skew) {
    var cos = Math.cos((lat * Math.PI) / 180) || 1;
    var hw = baseW / 2 / cos;
    return [
      [lat + height, lng + skew],
      [lat - height * 0.22, lng - hw],
      [lat - height * 0.22, lng + hw],
    ];
  }

  /* ---------- 一个山组：沿山脊两列、横向三排，共 6 座峰 ---------- */
  function groupPeaks(lat, lng, dLat, dLng, w, tone, seed, out) {
    var cos = Math.cos((lat * Math.PI) / 180) || 1;
    var uLat = dLat, uLng = dLng;                       // 沿脊方向（单位）
    var vLat = -dLng / cos, vLng = dLat * cos;          // 横向（单位，近似正交）
    var vlen = Math.sqrt(vLat * vLat + vLng * vLng) || 1;
    vLat /= vlen; vLng /= vlen;
    var gw = w * 0.62;    // 山组沿脊跨度
    var rows = [
      { off: 0.36, sc: 0.66, ci: 2, op: 0.62 },   // 后排：远、浅
      { off: 0.04, sc: 0.88, ci: 1, op: 0.78 },   // 中排
      { off: -0.30, sc: 1.15, ci: 0, op: 0.9 },   // 前排：近、深、更大
    ];
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      var cols = 2;
      for (var c = 0; c < cols; c++) {
        var u = (cols === 1 ? 0 : (c / (cols - 1) - 0.5)) * gw;
        var r1 = rnd(seed + r * 3.1 + c * 1.7);
        var r2 = rnd(seed + r * 5.3 + c * 2.9);
        /* 峰高约山带宽度的三成，横向略宽，才连得成山脉而不散成碎点 */
        var bh = w * (0.26 + 0.16 * r1) * row.sc;
        var bw = w * (0.24 + 0.12 * r2) * row.sc;
        var clat = lat + uLat * u + vLat * row.off * w + (r1 - 0.5) * w * 0.10;
        var clng = lng + (uLng * u) / cos + (vLng * row.off * w) / cos + (r2 - 0.5) * (w * 0.10) / cos;
        out.push({
          latlngs: peak(clat, clng, bw, bh, (r1 - 0.5) * bw * 0.5 + (r2 - 0.5) * bw * 0.3),
          color: TONES[tone][row.ci],
          opacity: row.op,
        });
      }
    }
  }

  /* ---------- 沿脊线累计长度取点 ---------- */
  function spineLength(spine) {
    var total = 0, segs = [];
    for (var i = 0; i < spine.length - 1; i++) {
      var a = spine[i], b = spine[i + 1];
      var cos = Math.cos((a[0] * Math.PI) / 180);
      var d = Math.sqrt(Math.pow(b[0] - a[0], 2) + Math.pow((b[1] - a[1]) * cos, 2));
      segs.push(d);
      total += d;
    }
    return { total: total, segs: segs };
  }

  function pointAt(spine, segs, dist) {
    var acc = 0;
    for (var i = 0; i < segs.length; i++) {
      if (acc + segs[i] >= dist || i === segs.length - 1) {
        var t = segs[i] ? (dist - acc) / segs[i] : 0;
        t = Math.max(0, Math.min(1, t));
        var a = spine[i], b = spine[i + 1];
        var dLat = b[0] - a[0], dLng = (b[1] - a[1]) * Math.cos((a[0] * Math.PI) / 180);
        var len = Math.sqrt(dLat * dLat + dLng * dLng) || 1;
        return {
          lat: a[0] + (b[0] - a[0]) * t,
          lng: a[1] + (b[1] - a[1]) * t,
          dLat: dLat / len,
          dLng: dLng / len,
        };
      }
      acc += segs[i];
    }
    return { lat: spine[0][0], lng: spine[0][1], dLat: 0, dLng: 1 };
  }

  function build() {
    var masses = [], peaks = [], crests = [], mist = [], i, k, r;

    for (i = 0; i < RANGES.length; i++) {
      r = RANGES[i];
      var info = spineLength(r.spine);
      // 山根：用山阴色压出山脉的「躯体」，上浅下深才有体积
      masses.push({
        latlngs: ringFromSpine(r.spine, r.w * 0.88, 0.95, i * 1.3, 0.05 * r.w),
        color: TONES[r.tone][0],
        opacity: 0.42,
      });
      // 沿脊线**密集**拼接山组：间距小于山组自身宽度，才能连成山脉而非孤立小峰
      var n = Math.max(2, Math.round(info.total / (r.sp * 1.05)) + 1);
      for (k = 0; k < n; k++) {
        var d = (info.total * (k + 0.5)) / n;
        var p = pointAt(r.spine, info.segs, d);
        groupPeaks(p.lat, p.lng, p.dLat, p.dLng, r.w, r.tone, i * 7.7 + k * 2.3, peaks);
      }
      crests.push({
        latlngs: r.spine.map(function (q) { return [q[0] + 0.12 * r.w, q[1]]; }),
      });
    }

    for (i = 0; i < MIST.length; i++) {
      mist.push({ latlngs: ringFromSpine(MIST[i].spine, MIST[i].w, 1, i * 2.1, 0, 0.28) });
    }

    return { masses: masses, peaks: peaks, crests: crests, mist: mist, decor: DECOR };
  }

  return { build: build, ranges: RANGES };
})();
