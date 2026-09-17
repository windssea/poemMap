/* ============================================================
   山体层（程序生成，全离线）
   ----------------------------------------------------------
   设计稿的地图是一张「青绿山水」中国图：淡青绿的省区、墨青的
   山峦、浅蓝的水系。这里按青绿设色生成山体色阶（山阴偏墨青、
   山巅近白绿），与省区底色同调，靠色相与明暗一起表现山。

   山脉不再用散点三角峰，而是按脊线生成「山脊剪影」：沿脊线密
   采样，顶边用圆润起伏的峰谷模拟山脊，下压一条山脚，闭合为山
   体；顶边另作一条折线用于「勾线」。填充用纵向渐变（山巅亮、
   山脚暗并羽化），再靠 terrain 图层的模糊把边缘揉开。
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

  var MIST = [];
  var DECOR = [];

  function rnd(seed) { return Math.abs(Math.sin(seed * 12.9898) * 43758.5453) % 1; }

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

  /* 沿脊线密采样，返回带方向的单位点 */
  function densify(spine, stepDeg) {
    var info = spineLength(spine);
    var m = Math.max(10, Math.round(info.total / stepDeg) + 1);
    var out = [];
    for (var k = 0; k < m; k++) {
      var d = info.total * k / (m - 1);
      out.push(pointAt(spine, info.segs, d));
    }
    return out;
  }

  /* ---------- 一条山脉：羽化填充的「山脊」剪影 + 脊线勾边 ----------
     沿脊线生成圆润起伏的顶边（山峰），下压一条山脚，闭合为山体；
     顶边另作一条折线用于「勾线」。填充靠纵向渐变 + pane 模糊羽化。 */
  function ridgeShape(spine, width, tone, seed, sils, ridges) {
    var pts = densify(spine, 0.24);
    var n = pts.length;
    if (n < 4) return;
    var peakN = Math.max(3, Math.round(spineLength(spine).total / 0.55));
    var top = [], bottom = [];
    for (var i = 0; i < n; i++) {
      var p = pts[i];
      var cos = Math.cos((p.lat * Math.PI) / 180) || 1;
      var vLat = -p.dLng / cos, vLng = p.dLat * cos;
      var vl = Math.sqrt(vLat * vLat + vLng * vLng) || 1;
      vLat /= vl; vLng /= vl;
      /* 山峰统一朝北（地图上方）起，山脊走向更一致 */
      if (vLat < 0) { vLat = -vLat; vLng = -vLng; }
      var t = n > 1 ? i / (n - 1) : 0.5;
      var taper = Math.pow(Math.sin(Math.PI * t), 0.7);            // 两端收尖
      var ph = (i / (n - 1)) * peakN * Math.PI;
      var r1 = rnd(seed + i * 0.7);
      var hump = Math.pow(Math.abs(Math.sin(ph + seed)), 0.62);    // 圆润的山峰
      var amp = width * (0.30 + 0.24 * Math.sin(ph * 0.5 + seed * 2.1)) * taper;
      var topOff = width * 0.05 + amp * (0.5 + 0.5 * hump);
      var botOff = width * 0.46 * (0.42 + 0.58 * taper);
      top.push([p.lat + vLat * topOff, p.lng + (vLng * topOff) / cos]);
      bottom.push([p.lat - vLat * botOff, p.lng - (vLng * botOff) / cos]);
    }
    sils.push({ latlngs: top.concat(bottom.reverse()), tone: tone });
    ridges.push({ latlngs: top, tone: tone });
  }

  function build() {
    var sils = [], ridges = [], i, r;

    for (i = 0; i < RANGES.length; i++) {
      r = RANGES[i];
      ridgeShape(r.spine, r.w, r.tone, i * 2.3 + 1.7, sils, ridges);
    }

    return { sils: sils, ridges: ridges, mist: [], decor: [] };
  }

  return { build: build, ranges: RANGES, tones: TONES };
})();
