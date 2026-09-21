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
export const TERRAIN = (function () {
  "use strict";

  /* 青绿色阶：[山阴, 山腰, 山巅]。
     山巅刻意不用近白——配上「远山」那层浅色，白顶 + 绿身会看成雪帽，
     在米黄的地面上格外跳。三档都留在青绿里，只靠明度拉开层次。 */
  var TONES = [
    ["#90ab9c", "#b0c8b4", "#d5e5d1"],
    ["#96b1a1", "#b5ccb8", "#d9e6d6"],
    ["#9ebaa7", "#bbd1bb", "#dde9db"],
    ["#97afa1", "#b7cdb6", "#d9e6d5"],
  ];

  /* 远山色阶：[山阴, 山腰, 山巅]。空气透视——比主山整体更淡更偏青灰。
     同样不许偏白：远山是「雾里的山」，不是雪山，色相要跟主山连着，
     只降饱和、提明度，再由绘制处叠一点透明度让它化进底色。 */
  var FAR_TONES = [
    ["#bed2c7", "#d0ded5", "#e0e9e3"],
    ["#c2d3ca", "#d3e0d8", "#e2ece6"],
    ["#c6d6cd", "#d6e2da", "#e5eee8"],
    ["#bfd3c9", "#d1dfd6", "#e1eae4"],
  ];

  /* 山系：name 名称（同时用于地图标注）；rank 1 主要 / 2 次要（标注优先级）；
     spine 脊线；w 宽度（纬度度数）；sp 山组间距；tone 色调；label 可选的标注坐标覆盖。

     位置与大小都由 tools 里的校验脚本比对过（脊线落在哪个省、长度与宽度是否与
     真实山脉同一量级）：长条形的山要「长而窄」，孤山、小山不能画成一团胖云。
     校验方式见 tools/check-ranges.js。 */
  var RANGES = [
    { name: "天山", rank: 1, spine: [[43.9, 80.2], [43.3, 83.5], [43.0, 87.0], [42.4, 90.5], [41.8, 94.0]], w: 3.2, sp: 0.85, tone: 3 },
    { name: "阿尔泰山", rank: 2, spine: [[48.6, 85.6], [47.6, 88.5], [46.8, 91.2]], w: 2.3, sp: 0.9, tone: 3 },
    { name: "昆仑山", rank: 1, spine: [[36.4, 75.5], [35.8, 79.5], [35.3, 83.5], [35.6, 87.5], [35.2, 91.5], [36.0, 95.0]], w: 3.0, sp: 0.9, tone: 3 },
    { name: "喜马拉雅", rank: 1, spine: [[30.9, 79.8], [30.1, 83.0], [29.0, 86.0], [28.4, 89.0], [28.8, 92.0], [29.8, 94.8]], w: 2.4, sp: 0.9, tone: 1 },
    { name: "唐古拉山", rank: 2, spine: [[32.9, 90.0], [33.0, 92.4], [32.6, 94.4], [33.0, 96.4]], w: 1.4, sp: 1.0, tone: 2 },
    { name: "祁连山", rank: 1, spine: [[39.0, 95.8], [38.4, 98.5], [37.6, 101.5], [37.0, 103.6]], w: 2.0, sp: 0.85, tone: 3 },
    { name: "秦岭", rank: 1, spine: [[34.3, 105.0], [34.0, 107.2], [33.8, 109.2], [33.6, 111.2], [33.4, 112.8]], w: 1.9, sp: 0.8, tone: 1 },
    { name: "大巴山", rank: 2, spine: [[32.6, 106.4], [32.0, 108.4], [31.7, 110.4]], w: 1.7, sp: 0.85, tone: 2 },
    { name: "太行山", rank: 1, spine: [[40.2, 113.6], [38.8, 113.3], [37.4, 113.0], [36.2, 112.6], [35.4, 112.0]], w: 1.6, sp: 0.8, tone: 1 },
    { name: "大兴安岭", rank: 1, spine: [[52.8, 122.6], [50.5, 121.8], [48.2, 120.8], [46.4, 119.6]], w: 2.8, sp: 0.9, tone: 0 },
    { name: "小兴安岭", rank: 2, spine: [[48.6, 130.6], [47.6, 128.2], [46.8, 126.6]], w: 2.0, sp: 0.85, tone: 0 },
    { name: "长白山", rank: 1, spine: [[43.6, 129.0], [42.2, 128.2], [41.2, 126.8], [40.8, 125.4]], w: 2.0, sp: 0.8, tone: 0 },
    { name: "横断山", rank: 1, spine: [[31.5, 98.5], [29.5, 99.5], [27.5, 100.3], [25.8, 101.3], [24.2, 102.0]], w: 2.4, sp: 0.85, tone: 1 },
    { name: "云贵高原", rank: 2, spine: [[26.8, 103.5], [25.8, 105.6], [25.0, 107.2]], w: 2.0, sp: 0.9, tone: 2 },
    { name: "南岭", rank: 1, spine: [[25.8, 110.8], [25.2, 112.8], [24.8, 114.8], [25.2, 116.5]], w: 1.8, sp: 0.85, tone: 0 },
    { name: "武夷山", rank: 1, spine: [[28.0, 117.6], [26.8, 117.2], [25.5, 116.9]], w: 1.5, sp: 0.8, tone: 2 },
    { name: "大别山", rank: 2, spine: [[31.8, 113.8], [31.2, 115.3], [30.8, 116.6]], w: 1.5, sp: 0.8, tone: 2 },
    { name: "阴山", rank: 1, spine: [[41.8, 105.5], [41.4, 108.5], [41.0, 111.0], [40.8, 113.2]], w: 1.4, sp: 0.85, tone: 3 },
    { name: "贺兰山", rank: 2, spine: [[39.2, 105.9], [38.4, 105.8], [37.8, 105.9]], w: 0.8, sp: 0.7, tone: 3 },
    { name: "六盘山", rank: 2, spine: [[36.2, 105.9], [35.5, 106.2], [34.8, 106.6]], w: 0.7, sp: 0.7, tone: 3 },
    { name: "泰山", rank: 1, spine: [[36.5, 116.7], [36.2, 117.3], [36.0, 117.8]], w: 0.7, sp: 0.7, tone: 1 },
    { name: "中央山脉", rank: 2, spine: [[24.9, 121.6], [24.0, 121.3], [23.0, 120.9], [22.4, 120.7]], w: 0.8, sp: 0.7, tone: 0 },
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

  /* ---------- 一条山脉：羽化填充的「山脊」剪影 + 脊线勾边 + 皴线 ----------
     沿脊线生成圆润起伏的顶边（山峰），下压一条山脚，闭合为山体；
     顶边另作一条折线用于「勾线」，山体内部再落一层向下的短墨线（皴），
     让山不只是「剪影」而有坡面。返回的分层供 mapEngine 依次上色。 */
  function ridgeShape(spine, width, tone, seed, out, opt) {
    opt = opt || {};
    var step = opt.step || 0.15;
    var far = !!opt.far;
    var sh = (opt.shift || 0) * width;   /* 整条沿法线北移（远山用） */
    var deep = (opt.deep || 0) * width;  /* 山脚额外下压，保证远山不露底 */
    var pts = densify(spine, step);
    var n = pts.length;
    if (n < 4) return;
    var peakN = Math.max(3, Math.round(spineLength(spine).total / 1.05));
    var top = [], bottom = [], dirs = [], amps = [], humps = [];
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
      /* 体量也沿脊线起伏：等宽的山脉是一条纺锤形的带子，看着像片叶子；
         有粗有细，才像一串连绵的峰。 */
      var wl = width * (0.78 + 0.40 * (0.5 + 0.5 * Math.sin(t * 2.2 + seed * 2.7)));
      /* 相位上加一点低频扰动：峰距不再等分，山才不像一串复制的波浪 */
      var ph = (t * peakN + 0.34 * Math.sin(t * 7.3 + seed * 1.7)) * Math.PI;
      /* 用正弦而非 |sin|：|sin| 在谷底是 V 形尖角，一串下来就是锯齿。
        正弦的峰谷都圆润，且一个周期只有一座峰（|sin| 有两座）。 */
      var hump = 0.5 + 0.5 * Math.sin(ph + seed);
      var amp = wl * (0.30 + 0.24 * Math.sin(ph * 0.5 + seed * 2.1)) * taper;
      if (opt.amp) amp *= opt.amp;              /* 远山的峰压低一点，别盖过主山 */
      var topOff = wl * 0.05 + amp * (0.5 + 0.5 * hump) + sh;
      /* 山脚要平缓：只微微跟着峰谷起伏。若山脚与山脊同相波动，
         整条山脉就成了一条「波浪带」，而不是「一排从山基隆起的峰」。 */
      var botDist = opt.botAbs != null
        ? opt.botAbs * width
        : wl * 0.46 * (0.42 + 0.58 * taper) * (0.94 + 0.12 * hump) + deep - sh;
      if (botDist < width * 0.12) botDist = width * 0.12;
      top.push([p.lat + vLat * topOff, p.lng + (vLng * topOff) / cos]);
      bottom.push([p.lat - vLat * botDist, p.lng - (vLng * botDist) / cos]);
      dirs.push([vLat, vLng, cos]);
      amps.push(amp);
      humps.push(hump);
    }
    bottom.reverse();
    if (far) {
      out.sils.push({ latlngs: top.concat(bottom), tone: tone, far: true });
      return;
    }

    /* 主山整条一个面：纵向渐变自己就把山脚收进地面，
       面与面之间不会出现接缝——这一层只管「体量」。 */
    out.sils.push({ latlngs: top.concat(bottom), tone: tone, far: false });

    /* 背光坡：每座峰「峰顶 → 谷」的那半个坡单独成一个面，再覆一层
       由脊线向下渐隐的暗色。它和受光的另一半坡一比，每座峰就有了面向；
       而分界正好落在峰顶与谷底，是山脊本身的转折处，看不出人工切痕。 */
    var peaks = [], valleys = [];
    for (var k = 1; k < n - 1; k++) {
      if (humps[k] >= humps[k - 1] && humps[k] > humps[k + 1]) peaks.push(k);
      if (humps[k] <= humps[k - 1] && humps[k] < humps[k + 1]) valleys.push(k);
    }
    for (var p = 0; p < peaks.length; p++) {
      var ia = peaks[p], ib = -1;
      for (var q = 0; q < valleys.length; q++) {
        if (valleys[q] > ia) { ib = valleys[q]; break; }
      }
      if (ib < 0 || ib - ia < 3) continue;
      /* 覆盖层是纯色块，轮廓精度要求低，按 3:1 降采样——
         上百个面加起来能省掉大半的 path 体积。 */
      var up = [], dn = [];
      for (var z = ia; z <= ib; z += 3) up.push(top[z]);
      if (up[up.length - 1] !== top[ib]) up.push(top[ib]);
      for (var z2 = ib; z2 >= ia; z2 -= 3) dn.push(bottom[z2]);
      if (dn[dn.length - 1] !== bottom[ia]) dn.push(bottom[ia]);
      out.faces.push(up.concat(dn));
    }
    out.ridges.push({ latlngs: top, tone: tone });
    out.hazes.push({ latlngs: top, tone: tone });

    /* 皴线：自山脊顺坡向下垂的短墨线。落笔在「峰的背光侧」——
       与上面的背光坡同一半，纹理压在暗面上才自然；受光的另一半留白。
       长度收在山脚之内，否则线尾会飘到山体轮廓外面的底色上。 */
    var maxLen = width * 0.40;
    var stride = Math.max(1, Math.round(0.42 / step));
    var lastG = -99;
    for (var g = 1; g < n - 1; g++) {
      if (humps[g] >= humps[g - 1]) continue;          // 只走下坡（背光侧）
      if (humps[g] > 0.88) continue;                   // 峰顶留白
      if (g - lastG < stride) continue;
      lastG = g;
      var a = top[g], d = dirs[g];
      var len = Math.min(maxLen, width * (0.18 + 0.26 * rnd(seed + g * 3.1)) + amps[g] * 0.4);
      var jit = (rnd(seed + g * 5.7) - 0.5) * 0.30;
      out.grains.push([
        [a[0] - d[0] * len * 0.30, a[1] - (d[1] * len * 0.30) / d[2]],
        [a[0] - d[0] * len * (0.60 + jit * 0.3), a[1] - (d[1] * len * 0.60) / d[2] + jit * len * 0.4],
        [a[0] - d[0] * len, a[1] - (d[1] * len) / d[2]],
      ]);
    }

    /* 亮脊：沿脊线略上方再描一条近白的细线，落笔在峰的**受光侧**——
       与背光坡正好相反的那一半（谷→峰），一明一暗，山脊就立起来了。 */
    if (opt.crest) {
      var co = width * 0.085, run = [];
      for (var k = 1; k < n; k++) {
        if (humps[k] >= 0.40 && humps[k] > humps[k - 1]) {
          if (!run.length) run.push(crestPt(top[k - 1], dirs[k - 1], co));
          run.push(crestPt(top[k], dirs[k], co));
        } else if (run.length) {
          if (run.length > 1) out.crests.push(run);
          run = [];
        }
      }
      if (run.length > 1) out.crests.push(run);
    }
  }

  function crestPt(a, d, off) {
    return [a[0] + d[0] * off, a[1] + (d[1] * off) / d[2]];
  }

  /* ---------- 山脉标注点 ----------
     默认取脊线中点、沿法线抬到山脊之上半个山宽；拥挤处可用
     label: [lat, lng] 手工覆盖。rank 决定标注优先级与显示门槛。 */
  function labelsOf() {
    var out = [];
    for (var i = 0; i < RANGES.length; i++) {
      var r = RANGES[i];
      if (!r.name) continue;
      var lat, lng;
      if (r.label) {
        lat = r.label[0]; lng = r.label[1];
      } else {
        var info = spineLength(r.spine);
        var mid = pointAt(r.spine, info.segs, info.total / 2);
        var cos = Math.cos((mid.lat * Math.PI) / 180) || 1;
        var vLat = -mid.dLng / cos, vLng = mid.dLat * cos;
        var vl = Math.sqrt(vLat * vLat + vLng * vLng) || 1;
        vLat /= vl; vLng /= vl;
        if (vLat < 0) { vLat = -vLat; vLng = -vLng; }
        var off = r.w * 0.66;
        lat = mid.lat + vLat * off;
        lng = mid.lng + (vLng * off) / cos;
      }
      out.push({ name: r.name, lat: lat, lng: lng, rank: r.rank || 2 });
    }
    return out;
  }

  /* ---------- Catmull-Rom 平滑 ----------
     spine 是手写的四五个控制点。直接连起来，山脚就是一条折线，
     放大后能看见明显的直线段。这里把控制点之间插成曲线：
     仍然经过每个控制点（地理走向不变），只是把折角揉圆。 */
  function smoothSpine(spine, per) {
    var n = spine.length;
    if (n < 3) return spine.slice();
    per = per || 8;
    var p = [spine[0]].concat(spine).concat([spine[n - 1]]);
    var out = [];
    for (var i = 1; i < p.length - 2; i++) {
      var p0 = p[i - 1], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2];
      for (var j = 0; j < per; j++) {
        var t = j / per, t2 = t * t, t3 = t2 * t;
        out.push([0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t +
          (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
          (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t +
          (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
          (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]);
      }
    }
    out.push(spine[n - 1]);
    return out;
  }

  function build() {
    var out = { sils: [], ridges: [], grains: [], crests: [], faces: [], hazes: [], decor: [] };
    for (var i = 0; i < RANGES.length; i++) {
      var r = RANGES[i];
      var seed = i * 2.3 + 1.7;
      var sp = smoothSpine(r.spine, 8);
      /* 远山：同一条脊线，整体北抬、起伏略大，且用另一组种子错开峰谷。
         它只当「一排山尖」——露在主山脊线之上，其余被主山压住。
         北抬量不宜大：抬得越高，露出的浅色越多，越像另画了一排雪山。 */
      ridgeShape(sp, r.w * 1.08, r.tone, seed + 37.4, out,
        { far: true, shift: 0.14, botAbs: 0.20, amp: 0.78 });
      /* 主山：主要山脉才点亮脊，小山不点（否则整图到处是白线） */
      ridgeShape(sp, r.w, r.tone, seed, out,
        { crest: r.rank === 1 && r.w >= 1.5 });
    }
    out.labels = labelsOf();
    return out;
  }

  return { build: build, ranges: RANGES, tones: TONES, farTones: FAR_TONES, labels: labelsOf };
})();

export default TERRAIN;
