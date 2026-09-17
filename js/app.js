/* ============================================================
   中华诗词地图 · 主逻辑
   ----------------------------------------------------------
   版式：左上题名 · 右上搜索筛选 · 左侧篇目栏 · 中央青绿山水长卷
        浮动诗词卡（竖排诗文）· 左下收录统计 · 右下罗盘缩放
   依赖：Leaflet（本地）· 可选 Three.js 云气层 / GSAP 动效层
   数据：AUTHORS / POEMS / POEM_TAGS / CHINA_GEO / GEO_EXTRAS / TERRAIN
   全部离线，无任何网络请求。
   ============================================================ */
(function () {
  "use strict";

  /* ══════════ 一、数据 ══════════ */
  var POEMS = window.POEMS || [];
  var AUTHORS = window.AUTHORS || {};
  var TAGS = window.POEM_TAGS || {};
  var CHINA = window.CHINA_GEO || { features: [] };
  var EXTRAS = window.GEO_EXTRAS || { rivers: [], labels: [] };

  var POEM_BY_ID = {};
  POEMS.forEach(function (p) { POEM_BY_ID[p.id] = p; });

  /* 同一处的诗词并为一个地标 */
  var PLACES = (function buildPlaces() {
    var nodes = [];
    POEMS.forEach(function (p) {
      var hit = null;
      for (var i = 0; i < nodes.length; i++) {
        var c = nodes[i];
        if (Math.abs(c.lat - p.place.lat) < 0.15 && Math.abs(c.lng - p.place.lng) < 0.2) { hit = c; break; }
      }
      if (!hit) {
        hit = { id: "pl" + nodes.length, lat: p.place.lat, lng: p.place.lng, poems: [] };
        nodes.push(hit);
      }
      hit.poems.push(p);
    });
    nodes.forEach(function (n) {
      n.lat = n.poems.reduce(function (s, p) { return s + p.place.lat; }, 0) / n.poems.length;
      n.lng = n.poems.reduce(function (s, p) { return s + p.place.lng; }, 0) / n.poems.length;
      var names = {};
      n.poems.forEach(function (p) { names[p.place.name] = (names[p.place.name] || 0) + 1; });
      var best = null;
      Object.keys(names).forEach(function (k) {
        if (best === null || names[k] > names[best] || (names[k] === names[best] && k.length < best.length)) best = k;
      });
      n.name = best;
      var regions = {};
      n.poems.forEach(function (p) { regions[p.place.region] = (regions[p.place.region] || 0) + 1; });
      n.region = Object.keys(regions).sort(function (a, b) { return regions[b] - regions[a]; })[0] || "";
      n.poems.forEach(function (p) { p.__placeId = n.id; });
    });
    return nodes;
  })();

  var PLACE_BY_ID = {};
  PLACES.forEach(function (n) { PLACE_BY_ID[n.id] = n; });

  /* ══════════ 二、小工具 ══════════ */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function narrow() { return window.matchMedia("(max-width: 820px)").matches; }

  /* Catmull-Rom 重采样：把稀疏折线加密成平滑曲线 */
  function smoothPath(pts, seg) {
    if (!pts || pts.length < 3) return pts;
    var out = [], n = pts.length;
    for (var i = 0; i < n - 1; i++) {
      var p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
      for (var j = 0; j < seg; j++) {
        var t = j / seg, t2 = t * t, t3 = t2 * t;
        var lat = 0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t +
          (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
          (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
        var lng = 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t +
          (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
          (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
        out.push([lat, lng]);
      }
    }
    out.push(pts[n - 1]);
    return out;
  }
  var toastTimer = 0;
  function toast(msg, ms) {
    var el = $("#toast");
    el.textContent = msg;
    el.hidden = false;
    requestAnimationFrame(function () { el.classList.add("on"); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove("on");
      setTimeout(function () { el.hidden = true; }, 320);
    }, ms || 2200);
  }

  var state = {
    q: "",
    dynasty: "全部",
    form: "全部",
    author: "",
    tag: "",
    openId: null,
    activeId: null,
    panel: null,
  };

  function filtered() {
    var q = state.q.trim().toLowerCase();
    return POEMS.filter(function (p) {
      if (state.dynasty !== "全部" && p.dynasty !== state.dynasty) return false;
      if (state.form !== "全部" && p.form !== state.form) return false;
      if (state.author && p.author !== state.author) return false;
      if (state.tag && (TAGS[p.id] || []).indexOf(state.tag) === -1) return false;
      if (q) {
        var hay = (p.title + " " + p.author + " " + p.dynasty + p.form + " " +
          (p.lines || []).join("") + " " + (p.place.name || "") + " " + (p.place.region || "")).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  /* ══════════ 三、地图：青绿山水长卷 ══════════ */
  var REGION = {
    黑龙江省: "东北", 吉林省: "东北", 辽宁省: "东北",
    北京市: "华北", 天津市: "华北", 河北省: "华北", 山西省: "华北", 内蒙古自治区: "华北",
    上海市: "华东", 江苏省: "华东", 浙江省: "华东", 安徽省: "华东",
    福建省: "华东", 江西省: "华东", 山东省: "华东",
    河南省: "华中", 湖北省: "华中", 湖南省: "华中",
    广东省: "华南", 广西壮族自治区: "华南", 海南省: "华南",
    重庆市: "西南", 四川省: "西南", 贵州省: "西南", 云南省: "西南", 西藏自治区: "西南",
    陕西省: "西北", 甘肃省: "西北", 青海省: "西北",
    宁夏回族自治区: "西北", 新疆维吾尔自治区: "西北",
  };
  /* 青绿设色：高原偏白、戈壁偏沙、江南偏绿，同一地区里再按 adcode 微差 */
  var TINTS = {
    东北: ["#e3ddb9", "#dcd7b2"],
    华北: ["#e9dcb8", "#e2d5b0"],
    华东: ["#dde4bd", "#d7dfb6"],   // 江南
    华中: ["#e2e2bb", "#dcdcb4"],
    华南: ["#d8e3b8", "#d2deb1"],
    西南: ["#dbe4bd", "#d5dfb6"],
    西北: ["#eee3c2", "#e7dcb9"],
    其他: ["#e5e0bd", "#dfdab6"],
  };
  var PROV_FIX = {
    西藏自治区: ["#f3f0e2", "#efece0"],
    新疆维吾尔自治区: ["#f0e5c6", "#e9dfbe"],
    青海省: ["#ece5c9", "#e6dfc0"],
    内蒙古自治区: ["#eaddb6", "#e3d7ae"],
    四川省: ["#d9e2b9", "#d3ddb2"],
    云南省: ["#d8e3b6", "#d2deaf"],
  };

  var map = L.map("map", {
    zoomControl: false,
    attributionControl: false,
    minZoom: 3.4,
    maxZoom: 8.5,
    zoomSnap: 0,
    zoomDelta: 0.6,
    wheelPxPerZoomLevel: 110,
    worldCopyJump: false,
    maxBounds: L.latLngBounds([[-46, 2], [88, 218]]),
    maxBoundsViscosity: 0.7,
    center: [35.5, 105],
    zoom: 4.3,
  });
  window.__map = map;

  /* 图层次序即画法：省区底色 → 山体 → 水系 → 长城 → 国境 → 地名 */
  var PANE_Z = { prov: 400, terrain: 410, hydro: 418, wall: 425, border: 430, geoLabels: 470 };
  Object.keys(PANE_Z).forEach(function (name) {
    map.createPane(name);
    map.getPane(name).style.zIndex = PANE_Z[name];
  });
  map.getPane("geoLabels").style.pointerEvents = "none";
  map.getPane("terrain").style.pointerEvents = "none";
  map.getPane("wall").style.pointerEvents = "none";
  /* 羽化不用 CSS blur：整屏 SVG 挂着实时滤镜，每次缩放都要重新光栅化，
     是拖动/缩放卡顿的主因之一。改为「几何羽化」——省区靠径向渐变的柔过渡，
     山体靠同色柔边描边 + 纵向渐变收尾，观感接近而开销归零。 */

  var feats = CHINA.features || [];
  var provinces = feats.filter(function (f) { return f.properties.level === "province"; });
  var country = feats.filter(function (f) { return f.properties.level === "country"; });

  /* 省区轮廓抽稀（Douglas–Peucker）。
     缩放的代价与点数成正比：每次 zoom 都要把每个点重投影一遍、重写 path 的 d，
     原始数据 24950 点 / 329 环。省区只是「晕染色块」（径向渐变 + 无描边细节），
     按 0.05° 容差抽稀后点数减半以上，肉眼无差，缩放明显更跟手。 */
  function simplifyRing(ring, tol) {
    var n = ring.length;
    if (n < 8) return ring;
    var keep = new Uint8Array(n);
    keep[0] = keep[n - 1] = 1;
    var stack = [0, n - 1];
    var tol2 = tol * tol;
    while (stack.length) {
      var b = stack.pop(), a = stack.pop();
      var ax = ring[a][0], ay = ring[a][1];
      var dx = ring[b][0] - ax, dy = ring[b][1] - ay;
      var dd = dx * dx + dy * dy, best = -1, bi = -1;
      for (var i = a + 1; i < b; i++) {
        var px = ring[i][0] - ax, py = ring[i][1] - ay;
        var t = dd ? (px * dx + py * dy) / dd : 0;
        if (t < 0) t = 0; else if (t > 1) t = 1;
        var qx = px - dx * t, qy = py - dy * t;
        var d2 = qx * qx + qy * qy;
        if (d2 > best) { best = d2; bi = i; }
      }
      if (best > tol2) { keep[bi] = 1; stack.push(a, bi, bi, b); }
    }
    var out = [];
    for (var k = 0; k < n; k++) if (keep[k]) out.push(ring[k]);
    return out.length > 3 ? out : ring;
  }
  function simplifyProvince(f) {
    var g = f.geometry;
    if (!g || !g.coordinates) return f;
    var polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
    var outPolys = polys.map(function (poly) {
      return poly.map(function (ring) { return simplifyRing(ring, 0.05); });
    });
    return {
      type: f.type,
      properties: f.properties,
      geometry: {
        type: g.type,
        coordinates: g.type === "Polygon" ? outPolys[0] : outPolys,
      },
    };
  }
  function countPts(list) {
    var n = 0;
    list.forEach(function (f) {
      var g = f.geometry;
      if (!g || !g.coordinates) return;
      var polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
      polys.forEach(function (p) { p.forEach(function (r) { n += r.length; }); });
    });
    return n;
  }
  var rawProvPts = countPts(provinces);
  provinces = provinces.map(simplifyProvince);
  /* 诊断钩子：tools/qa-perf.js 可读，确认抽稀比例 */
  window.__geoStats = {
    rawPoints: rawProvPts,
    keptPoints: countPts(provinces),
    ratio: +(countPts(provinces) / rawProvPts).toFixed(3),
  };

  L.geoJSON(provinces, {
    pane: "prov",
    style: function (f) {
      return {
        fillColor: "url(#pg" + f.properties.adcode + ")",
        fillOpacity: 1,
        color: "#bcc0a6",
        weight: 1,
        opacity: 0.5,          // 省界只留一线淡痕，柔和的过渡交给径向渐变
        lineJoin: "round",
      };
    },
  }).addTo(map);

  /* 每省注入不规则径向渐变（中心亮、边缘暗、中心位置带抖动），再靠 pane 模糊晕开 */
  (function injectProvGradients() {
    var defs = "";
    provinces.forEach(function (f) {
      var ad = f.properties.adcode;
      var name = f.properties.name;
      var pair = PROV_FIX[name] || TINTS[REGION[name] || "其他"] || TINTS["其他"];
      var jx = ((ad * 37) % 60 + 20) / 100;
      var jy = ((ad * 53) % 60 + 18) / 100;
      defs += '<radialGradient id="pg' + ad + '" cx="' + jx.toFixed(2) + '" cy="' + jy.toFixed(2) +
        '" r="0.78"><stop offset="0" stop-color="' + pair[0] + '"/><stop offset="1" stop-color="' + pair[1] + '"/></radialGradient>';
    });
    var svg = map.getPane("prov").querySelector("svg");
    if (svg) svg.insertAdjacentHTML("afterbegin", "<defs>" + defs + "</defs>");
  })();

  var T = window.TERRAIN ? window.TERRAIN.build() : { sils: [], ridges: [], mist: [], decor: [] };

  /* 山体：羽化填充的山脊剪影 + 脊线勾边 */
  var RIDGE_INK = ["#5f7d68", "#66886f", "#6b8f74", "#647e6c"];
  var RIDGE_HAZE = ["#8cb69c", "#93bda1", "#a1c4a6", "#98b8a0"];   // 同色系柔边，代替 blur 做羽化
  (T.sils || []).forEach(function (s) {
    L.polygon(s.latlngs, {
      pane: "terrain", lineJoin: "round", lineCap: "round", interactive: false,
      fillColor: "url(#rg" + s.tone + ")", fillOpacity: 1,
      color: RIDGE_HAZE[s.tone], weight: 7, opacity: 0.17,   // 一圈同色柔边
    }).addTo(map);
  });
  (T.ridges || []).forEach(function (rd) {
    L.polyline(rd.latlngs, {
      pane: "terrain", color: RIDGE_INK[rd.tone], weight: 1.1, opacity: 0.55,
      lineCap: "round", lineJoin: "round", interactive: false,
    }).addTo(map);
  });

  /* 山体填充用的纵向渐变（山巅亮、山脚暗并羽化） */
  (function injectTerrainGradients() {
    var tones = (window.TERRAIN && window.TERRAIN.tones) || [
      ["#7ea691", "#a3c3a8", "#cfe2cd"],
      ["#86ad96", "#aac8ac", "#d4e5cf"],
      ["#93b89c", "#b4cfb2", "#dae9d4"],
      ["#8aa891", "#aec6a6", "#d8e5cd"],
    ];
    var defs = "";
    for (var t = 0; t < tones.length; t++) {
      defs += '<linearGradient id="rg' + t + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="' + tones[t][2] + '"/>' +
        '<stop offset="0.55" stop-color="' + tones[t][1] + '"/>' +
        '<stop offset="1" stop-color="' + tones[t][0] + '" stop-opacity="0.14"/></linearGradient>';
    }
    var svg = map.getPane("terrain").querySelector("svg");
    if (svg) svg.insertAdjacentHTML("afterbegin", "<defs>" + defs + "</defs>");
  })();

  L.geoJSON(country, {
    pane: "border",
    style: { color: "#a9b093", weight: 1.5, fill: false, lineJoin: "round", opacity: 0.8 },
  }).addTo(map);

  EXTRAS.rivers.forEach(function (r) {
    var pts = smoothPath(r.pts, 7);
    L.polyline(pts, { pane: "hydro", color: "#8fb6c9", weight: 3.6, opacity: 0.26, lineCap: "round", lineJoin: "round", interactive: false }).addTo(map);
    L.polyline(pts, { pane: "hydro", color: "#5f9fb8", weight: 1.5, opacity: 0.92, lineCap: "round", lineJoin: "round", interactive: false }).addTo(map);
  });
  if (EXTRAS.canal) {
    var cpts = smoothPath(EXTRAS.canal.pts, 7);
    L.polyline(cpts, { pane: "hydro", color: "#9dc0cb", weight: 1.1, opacity: 0.6, dashArray: "4 4", lineCap: "round", lineJoin: "round", interactive: false }).addTo(map);
  }
  if (EXTRAS.wall) {
    var wpts = smoothPath(EXTRAS.wall.pts, 6);
    L.polyline(wpts, { pane: "wall", color: "#d98b5f", weight: 5, opacity: 0.22, lineCap: "round", lineJoin: "round", interactive: false }).addTo(map);
    L.polyline(wpts, { pane: "wall", color: "#b8472e", weight: 2.4, opacity: 0.92, dashArray: "2 5", lineCap: "round", lineJoin: "round", interactive: false }).addTo(map);
  }

  EXTRAS.labels.forEach(function (lb) {
    L.marker([lb.lat, lb.lng], {
      pane: "geoLabels", interactive: false, keyboard: false,
      icon: L.divIcon({ className: "geo-label", html: "<span>" + esc(lb.name) + "</span>", iconSize: [0, 0] }),
    }).addTo(map);
  });
  provinces.forEach(function (f) {
    var c = f.properties.centroid;
    if (!c) return;
    L.marker([c[1], c[0]], {
      pane: "geoLabels", interactive: false, keyboard: false,
      icon: L.divIcon({
        className: "prov-label",
        html: "<span>" + esc(f.properties.name.replace(/省|市|自治区|特别行政区|壮族|回族|维吾尔/g, "")) + "</span>",
        iconSize: [0, 0],
      }),
    }).addTo(map);
  });

  /* 视野：把中国装进「篇目栏右侧 · 工具条下方」的可视区 */
  var CHINA_BOUNDS = L.latLngBounds([[17.4, 72.5], [54.2, 135.8]]);
  function fitChina() {
    var side = $("#sidebar");
    var sideOpen = document.body.classList.contains("side-open");
    var padLeft = narrow() ? 18 : (sideOpen ? side.offsetWidth + 38 : 18);
    map.fitBounds(CHINA_BOUNDS, {
      paddingTopLeft: [padLeft, narrow() ? 128 : 118],
      paddingBottomRight: [narrow() ? 18 : 100, narrow() ? 88 : 86],
      animate: false,
    });
    queueLayout();
  }

  /* ══════════ 四、地标 ══════════ */
  function dotHTML(node, active) {
    var many = node.poems.length > 1;
    return '<span class="dot-wrap' + (active ? " on" : "") + '">' +
      (active ? '<span class="dot-glow"></span><span class="dot-ring"></span>' : "") +
      '<span class="dot"></span>' +
      '<span class="dot-name">' + esc(node.name) +
        (many ? '<i class="dot-count">' + node.poems.length + "</i>" : "") +
      "</span>" +
    "</span>";
  }

  function nodeIcon(node, active) {
    return L.divIcon({
      className: "mk-wrap",
      html: '<span class="mk-offset"><span class="mk-anim">' + dotHTML(node, active) + "</span></span>",
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    });
  }

  PLACES.forEach(function (n) {
    n.marker = L.marker([n.lat, n.lng], { keyboard: false, riseOnHover: true, icon: nodeIcon(n, false) });
    n.marker.on("click", function (e) {
      L.DomEvent.stopPropagation(e);
      if (n.poems.length > 1) openPoemList(n);
      else openCard(n);
    });
  });

  /* 只对「地名签」做避让 */
  var layoutQueued = false;
  function queueLayout() {
    if (layoutQueued) return;
    layoutQueued = true;
    requestAnimationFrame(function () { layoutQueued = false; layoutLabels(); });
  }

  function layoutLabels() {
    var size = map.getSize();
    var zoom = map.getZoom();
    var maxLabels = zoom < 4.9 ? 12 : zoom < 5.6 ? 22 : 60;
    var items = [];
    PLACES.forEach(function (n) {
      if (!map.hasLayer(n.marker)) return;
      var el = n.marker.getElement();
      if (!el) return;
      var pt = map.latLngToContainerPoint([n.lat, n.lng]);
      if (pt.x < -80 || pt.y < -60 || pt.x > size.x + 80 || pt.y > size.y + 80) return;
      items.push({ n: n, el: el, x: pt.x, y: pt.y });
    });

    items.sort(function (a, b) { return b.n.poems.length - a.n.poems.length; });
    var boxes = [];
    var shown = 0;
    items.forEach(function (o) {
      var label = o.el.querySelector(".dot-name");
      if (!label) return;
      var on;
      if (o.n.isActive) {
        on = true;
        boxes.push({ x1: o.x - 30, x2: o.x + 30, y1: o.y + 8, y2: o.y + 34 });
      } else {
        var w = o.n.name.length * 14 + 10;
        var box = { x1: o.x - w / 2, x2: o.x + w / 2, y1: o.y + 8, y2: o.y + 26 };
        on = shown < maxLabels;
        for (var i = 0; i < boxes.length && on; i++) {
          var b = boxes[i];
          if (!(box.x2 < b.x1 || b.x2 < box.x1 || box.y2 < b.y1 || b.y2 < box.y1)) on = false;
        }
        if (on) { boxes.push(box); shown++; }
      }
      label.style.opacity = on ? "1" : "0";
    });
  }

  /* 诊断钩子：tools/qa-perf.js 直接量避让开销 */
  window.__layout = layoutLabels;

  function setActive(node) {
    PLACES.forEach(function (n) {
      var want = !!node && n.id === node.id;
      if (!!n.isActive === want) return;
      n.isActive = want;
      n.marker.setIcon(nodeIcon(n, want));
      n.marker.setZIndexOffset(want ? 1500 : 0);
    });
    queueLayout();
  }

  map.on("zoomend moveend", function () {
    document.body.classList.toggle("show-prov", map.getZoom() >= 4.0);
    queueLayout();
    if (poemList && poemList.classList.contains("on")) placePoemList(PLACE_BY_ID[state.activeId]);
  });
  map.on("move zoom", queueLayout);
  /* 点地图空白：卡片、磨砂浮层、右侧详情抽屉一并收起 */
  map.on("click", function () { hideCard(); hidePoemList(); closeDetail(); });

  /* ══════════ 五、中央诗词卡 ══════════ */
  var card = $("#card");

  /* 诗词卡居中：不再跟随地标，而是摆在「地图可视区」正中
     （可视区＝篇目栏右侧 → 屏幕右缘；上下让开工具条与底栏） */
  function placeCard() {
    if (narrow()) {           // 窄屏由 CSS 贴底，别写内联定位
      card.style.left = ""; card.style.top = "";
      return;
    }
    var w = card.offsetWidth, h = card.offsetHeight;
    var sideOpen = document.body.classList.contains("side-open");
    var boxL = sideOpen ? $("#sidebar").offsetWidth + 34 : 18;
    var boxR = window.innerWidth - 24;
    var boxT = 84;
    var boxB = window.innerHeight - 24;

    var left = boxL + (boxR - boxL - w) / 2;
    left = Math.max(boxL, Math.min(left, boxR - w));      // 卡比可视区宽时靠左
    var top = boxT + (boxB - boxT - h) / 2;
    top = Math.max(boxT, Math.min(top, boxB - h));
    card.style.left = Math.round(left) + "px";
    card.style.top = Math.round(top) + "px";
  }

  function renderCardPoem(p) {
    var el = $("#cardPoem");
    // 全部诗词一律竖排（从右到左）
    el.className = "c-poem";
    el.innerHTML = p.lines.map(function (l) { return '<span class="col">' + esc(l) + "</span>"; }).join("");
  }

  function renderCardOthers(node, cur) {
    var box = $("#cardOthers");
    var rest = node.poems.filter(function (q) { return q.id !== cur.id; });
    if (!rest.length) { box.hidden = true; box.innerHTML = ""; return; }
    box.innerHTML = '<button type="button" class="others-more" data-act="list">此处另有 ' + rest.length + " 首 ›</button>";
    box.hidden = false;
  }

  function openCard(node, poemId) {
    state.activeId = node.id;
    setActive(node);
    hidePoemList();
    var p = (poemId && POEM_BY_ID[poemId]) || node.poems[0];
    state.openId = p.id;

    $("#cardTitle").textContent = p.title;
    $("#cardSub").textContent = p.dynasty + " · " + p.author;

    renderCardPoem(p);
    renderCardOthers(node, p);

    $("#cardPlace").textContent = node.region + "（" + node.name + "）";
    $("#cardTags").innerHTML = (TAGS[p.id] || []).map(function (t) {
      return "<span>" + esc(t) + "</span>";
    }).join("");
    $("#cardTr").textContent = p.tr;

    card.setAttribute("aria-hidden", "false");
    card.classList.add("on");
    placeCard(node);
    markListOn();
    if (window.MOTION && window.MOTION.on) window.MOTION.cardIn(card);
  }

  function hideCard() {
    card.classList.remove("on");
    card.setAttribute("aria-hidden", "true");
    setActive(null);
    state.activeId = null;
    hidePoemList();
  }

  $("#cardClose").addEventListener("click", hideCard);
  $("#cardOthers").addEventListener("click", function (e) {
    if (e.target.closest('[data-act="list"]')) {
      var node = PLACE_BY_ID[state.activeId];
      if (node) openPoemList(node);
      return;
    }
    var btn = e.target.closest("button[data-id]");
    if (!btn) return;
    var node = PLACE_BY_ID[state.activeId];
    if (node) openCard(node, btn.dataset.id);
  });
  $("#cardMore").addEventListener("click", function () {
    if (state.openId) openDetail(state.openId);
  });

  /* ══════════ 五·五、多地诗词：磨砂浮层列表 ══════════ */
  var poemList = $("#poemList");

  function placePoemList(node) {
    var w = poemList.offsetWidth, h = poemList.offsetHeight;
    if (narrow()) {
      poemList.style.left = "14px"; poemList.style.right = "14px";
      poemList.style.top = "auto"; poemList.style.bottom = "64px";
      return;
    }
    var pt = map.latLngToContainerPoint([node.lat, node.lng]);
    var left = pt.x + 22;
    if (left + w > window.innerWidth - 16) left = pt.x - w - 22;
    left = Math.max(16, Math.min(left, window.innerWidth - w - 16));
    var top = pt.y - 24;
    top = Math.max(96, Math.min(top, window.innerHeight - h - 16));
    poemList.style.left = Math.round(left) + "px";
    poemList.style.top = Math.round(top) + "px";
    poemList.style.right = "auto"; poemList.style.bottom = "auto";
  }

  function openPoemList(node) {
    state.activeId = node.id;
    setActive(node);
    var items = node.poems.map(function (p) {
      return '<button type="button" class="pl-item' + (state.openId === p.id ? " on" : "") + '" data-id="' + p.id + '">' +
        '<span class="pl-t">' + esc(p.title) + "</span>" +
        '<span class="pl-m">' + p.dynasty + " · " + esc(p.author) + "</span>" +
      "</button>";
    }).join("");
    poemList.innerHTML = '<div class="pl-head">' + esc(node.region + "（" + node.name + "）") +
      '<span class="pl-n">' + node.poems.length + " 首</span></div>" + items;
    poemList.setAttribute("aria-hidden", "false");
    poemList.classList.add("on");
    placePoemList(node);
    if (window.MOTION && window.MOTION.on) window.MOTION.cardIn(poemList);
  }

  function hidePoemList() {
    if (!poemList) return;
    poemList.classList.remove("on");
    poemList.setAttribute("aria-hidden", "true");
  }

  poemList.addEventListener("click", function (e) {
    var more = e.target.closest('[data-act="list"]');
    if (more) { var nn = PLACE_BY_ID[state.activeId]; if (nn) openPoemList(nn); return; }
    var btn = e.target.closest(".pl-item");
    if (!btn) return;
    var node = PLACE_BY_ID[state.activeId];
    hidePoemList();
    if (node) openCard(node, btn.dataset.id);
  });

  /* ══════════ 六、详情面板 ══════════ */
  var detail = $("#detail");
  var btnMore = $("#btnMore");

  function openDetail(id) {
    var p = POEM_BY_ID[id];
    if (!p) return;
    state.openId = id;
    var node = PLACE_BY_ID[p.__placeId];
    var a = AUTHORS[p.author] || {};

    $("#dTitle").textContent = p.title;
    $("#dSub").textContent = p.dynasty + " · " + p.author;

    // 全部诗词一律竖排（从右到左）
    var poem = $("#dPoem");
    poem.className = "d-poem";
    poem.innerHTML = p.lines.map(function (l) { return '<span class="line">' + esc(l) + "</span>"; }).join("");

    var pro = $("#dPrologue");
    if (p.prologue) { pro.textContent = p.prologue; pro.hidden = false; }
    else { pro.hidden = true; }

    $("#dPlaceName").textContent = node ? node.name : p.place.name;
    $("#dPlaceRegion").textContent = "（" + (p.place.region || "") + "）";
    $("#dTags").innerHTML = (TAGS[id] || []).map(function (t) { return "<span>" + esc(t) + "</span>"; }).join("");
    $("#dTr").textContent = p.tr;
    $("#dNotes").innerHTML = p.notes.map(function (n) {
      return "<dt>" + esc(n[0]) + "</dt><dd>" + esc(n[1]) + "</dd>";
    }).join("");
    $("#dAppr").textContent = p.appr;
    $("#dOrigin").textContent = p.place.origin || "";
    $("#dOriginSec").hidden = !p.place.origin;
    $("#dBio").innerHTML = "<b>" + esc(p.author) + (a.years ? "（" + a.years + "）" : "") +
      "</b>　" + esc(a.bio || "暂无介绍。");

    $("#dMore").hidden = true;
    btnMore.setAttribute("aria-expanded", "false");
    btnMore.querySelector("span").textContent = "查看完整注释";

    detail.classList.add("on");
    detail.setAttribute("aria-hidden", "false");
    $(".detail-body", detail).scrollTop = 0;
    /* 查看详情时自动关闭弹出的诗词卡片 */
    hideCard();
    if (node) setActive(node);
    markListOn(id);
    if (window.MOTION && window.MOTION.on) window.MOTION.cardIn(detail);
    if (location.hash !== "#/p/" + id) history.replaceState(null, "", "#/p/" + id);
  }

  function closeDetail() {
    detail.classList.remove("on");
    detail.setAttribute("aria-hidden", "true");
    if (/^#\/p\//.test(location.hash)) history.replaceState(null, "", location.pathname + location.search);
  }

  btnMore.addEventListener("click", function () {
    var open = $("#dMore").hidden;
    $("#dMore").hidden = !open;
    btnMore.setAttribute("aria-expanded", String(open));
    btnMore.querySelector("span").textContent = open ? "收起注释" : "查看完整注释";
  });
  $("#detailClose").addEventListener("click", closeDetail);

  /* ══════════ 七、左侧篇目栏 ══════════ */
  var listEl = $("#list");

  function placeText(p) {
    var region = p.place.region || "";
    var name = p.place.name || "";
    if (!name || region.indexOf(name) !== -1) return region;
    return region + "（" + name + "）";
  }

  function itemHTML(p) {
    var thumb = window.THUMBS ? window.THUMBS.svg(p) : "";
    return '<button class="item' + (p.id === state.openId ? " on" : "") + '" type="button" data-id="' + p.id + '">' +
      '<span class="thumb">' + thumb + "</span>" +
      '<span class="it-main">' +
        '<span class="it-t">' + esc(p.title) + "</span>" +
        '<span class="it-a">' + p.dynasty + " · " + esc(p.author) + "</span>" +
        '<span class="it-p">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s7-6.3 7-12a7 7 0 1 0-14 0c0 5.7 7 12 7 12z"/><circle cx="12" cy="10" r="2.6"/></svg>' +
          esc(placeText(p)) +
        "</span>" +
      "</span>" +
      '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>' +
    "</button>";
  }

  function renderList() {
    var list = filtered();
    listEl.innerHTML = list.length
      ? list.map(itemHTML).join("")
      : '<div class="side-empty">没有找到呢。<br>换个关键词，或试试「全部」。</div>';
  }

  function markListOn(id) {
    var cur = id || state.openId;
    $$(".item", listEl).forEach(function (el) { el.classList.toggle("on", el.dataset.id === cur); });
  }

  listEl.addEventListener("click", function (e) {
    var item = e.target.closest(".item");
    if (!item) return;
    goToPoem(item.dataset.id);
    if (narrow()) closeSide();
  });

  function goToPoem(id) {
    var p = POEM_BY_ID[id];
    if (!p) return;
    var node = PLACE_BY_ID[p.__placeId];
    if (node) {
      state.openId = id;
      map.flyTo([node.lat, node.lng], Math.max(map.getZoom(), 5.6), { duration: 1.05 });
      openCard(node, id);
    }
  }

  /* ══════════ 八、筛选：页签 / 筛选条 双向同步 ══════════ */
  function syncFilters() {
    $$("#tabs button").forEach(function (b) {
      var val = b.dataset.val;
      var on = val === "全部" ? state.dynasty === "全部" : state.dynasty === val;
      b.setAttribute("aria-pressed", String(on));
    });
    $$("#chipsDynasty button").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.val === state.dynasty));
    });
    $$("#chipsForm button").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.val === state.form));
    });
  }

  function setDynasty(v) {
    state.dynasty = state.dynasty === v && v !== "全部" ? "全部" : v;
    refresh({ animate: true });
  }
  function setForm(v) {
    state.form = state.form === v && v !== "全部" ? "全部" : v;
    refresh({ animate: true });
  }

  $("#tabs").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-val]");
    if (b) setDynasty(b.dataset.val);
  });
  $("#chipsDynasty").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-val]");
    if (b) setDynasty(b.dataset.val);
  });
  $("#chipsForm").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-val]");
    if (b) setForm(b.dataset.val);
  });

  /* 换一批：随机点亮一首 */
  $("#shuffleBtn").addEventListener("click", function () {
    var list = filtered();
    if (!list.length) { toast("当前筛选下没有诗词"); return; }
    var pick = list[Math.floor(Math.random() * list.length)];
    var node = PLACE_BY_ID[pick.__placeId];
    if (node) {
      state.openId = pick.id;
      map.flyTo([node.lat, node.lng], Math.max(map.getZoom(), 5.6), { duration: 1.05 });
      openCard(node, pick.id);
      toast("偶遇一首：" + pick.title);
    }
  });

  /* ══════════ 九、刷新：地标可见性 · 统计 ══════════ */
  function refresh(opts) {
    opts = opts || {};
    var list = filtered();
    var alive = {};
    list.forEach(function (p) { alive[p.id] = 1; });

    PLACES.forEach(function (n) {
      var hit = n.poems.some(function (p) { return alive[p.id]; });
      if (hit && !map.hasLayer(n.marker)) n.marker.addTo(map);
      if (!hit && map.hasLayer(n.marker)) map.removeLayer(n.marker);
    });

    var np = PLACES.filter(function (n) {
      return n.poems.some(function (p) { return alive[p.id]; });
    }).length;
    $("#statPoems").textContent = list.length;
    $("#statPlaces").textContent = np;

    /* 卡片所依的诗若被筛掉，收起卡片 */
    if (state.openId && !alive[state.openId]) hideCard();

    syncFilters();
    renderList();
    if (state.panel) renderPanel();
    queueLayout();

    if (opts.animate && window.MOTION && window.MOTION.on) {
      if (listEl.children.length) window.MOTION.listIn(listEl);
      requestAnimationFrame(function () {
        window.MOTION.markersIn(markerAnimEls(), { each: 0.006, duration: 0.42 });
      });
    }
  }

  function markerAnimEls() {
    var out = [];
    PLACES.forEach(function (n) {
      if (!map.hasLayer(n.marker)) return;
      var el = n.marker.getElement();
      var a = el && el.querySelector(".mk-anim");
      if (a) out.push(a);
    });
    return out;
  }

  /* ══════════ 十、详情索引面板：诗人 / 主题 ══════════ */
  var panel = $("#panel");

  function openPanel(mode) {
    state.panel = mode;
    renderPanel();
    panel.classList.add("on");
    panel.setAttribute("aria-hidden", "false");
  }
  function closePanel() {
    state.panel = null;
    panel.classList.remove("on");
    panel.setAttribute("aria-hidden", "true");
  }
  $("#panelClose").addEventListener("click", closePanel);

  function chips(list, cur, group) {
    return list.map(function (v) {
      return '<button type="button" data-group="' + group + '" data-val="' + esc(v) + '" aria-pressed="' +
        String(v === cur) + '">' + esc(v) + "</button>";
    }).join("");
  }

  function rowHTML(p) {
    return '<button class="row' + (p.id === state.openId ? " on" : "") + '" type="button" data-id="' + p.id + '">' +
      '<span class="row-main">' +
        '<span class="t">' + esc(p.title) + "</span>" +
        '<span class="m">' + p.dynasty + " · " + esc(p.author) + " · " + esc(placeText(p)) + "</span>" +
      "</span>" +
      '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>' +
    "</button>";
  }

  function renderPanel() {
    var title = { list: "篇目", poet: "诗人", theme: "主题" }[state.panel] || "篇目";
    $("#panelTitle").textContent = title;
    var body = $("#panelBody");

    if (state.panel === "poet") {
      var counts = {};
      POEMS.forEach(function (p) { counts[p.author] = (counts[p.author] || 0) + 1; });
      var names = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
      body.innerHTML = '<p class="panel-note">共 ' + names.length + ' 位诗人 · 按收录首数排序</p>' +
        names.map(function (a) {
          var years = (AUTHORS[a] || {}).years || "";
          return '<button class="row" type="button" data-author="' + esc(a) + '">' +
            '<span class="row-main"><span class="t">' + esc(a) + "</span>" +
            '<span class="m">' + esc(years) + "</span></span>" +
            '<span class="n">' + counts[a] + "</span></button>";
        }).join("");
      return;
    }

    if (state.panel === "theme") {
      var tagCount = {};
      Object.keys(TAGS).forEach(function (id) {
        if (!POEM_BY_ID[id]) return;
        TAGS[id].forEach(function (t) { tagCount[t] = (tagCount[t] || 0) + 1; });
      });
      var tags = Object.keys(tagCount).sort(function (a, b) { return tagCount[b] - tagCount[a]; });
      body.innerHTML = '<p class="panel-note">共 ' + tags.length + " 个主题 · 点选筛选</p>" +
        '<div class="filters">' + tags.map(function (t) {
          return '<button type="button" data-tag="' + esc(t) + '" aria-pressed="' + String(state.tag === t) + '">' +
            esc(t) + " " + tagCount[t] + "</button>";
        }).join("") + "</div>" +
        (state.tag ? filtered().map(rowHTML).join("") : "");
      return;
    }

    var list = filtered();
    var head = '<div class="filters">' +
      chips(["全部", "唐", "宋"], state.dynasty, "dynasty") +
      '<span style="width:8px"></span>' +
      chips(["全部", "诗", "词"], state.form, "form") +
      "</div>";
    if (state.author || state.tag) {
      head += '<p class="panel-note">筛选：' +
        (state.author ? esc(state.author) : "") +
        (state.author && state.tag ? " · " : "") +
        (state.tag ? esc(state.tag) : "") +
        ' <button type="button" class="clear-filter" style="color:var(--seal);background:none;border:none;font-size:12px">清除</button></p>';
    }
    body.innerHTML = head + (list.length
      ? list.map(rowHTML).join("")
      : '<div class="panel-empty">没有找到呢。<br>换个关键词，或试试「全部」。</div>');
  }

  $("#panelBody").addEventListener("click", function (e) {
    var row = e.target.closest(".row");
    if (row && row.dataset.id) { goToPoem(row.dataset.id); closePanel(); return; }
    if (row && row.dataset.author) {
      state.author = row.dataset.author;
      state.tag = "";
      state.panel = "list";
      renderPanel();
      refresh();
      return;
    }
    var tag = e.target.closest("[data-tag]");
    if (tag) {
      state.tag = state.tag === tag.dataset.tag ? "" : tag.dataset.tag;
      state.author = "";
      renderPanel();
      refresh();
      return;
    }
    var chip = e.target.closest("[data-group]");
    if (chip) {
      if (chip.dataset.group === "dynasty") state.dynasty = chip.dataset.val;
      else state.form = chip.dataset.val;
      renderPanel();
      refresh({ animate: true });
      return;
    }
    if (e.target.closest(".clear-filter")) {
      state.author = "";
      state.tag = "";
      renderPanel();
      refresh();
    }
  });

  /* ══════════ 十一、搜索 / 菜单 / 缩放 / 篇目栏开关 ══════════ */
  var qEl = $("#q"), qClear = $("#qClear"), debounce = 0;
  qEl.addEventListener("input", function () {
    clearTimeout(debounce);
    debounce = setTimeout(function () {
      state.q = qEl.value;
      qClear.hidden = !qEl.value;
      refresh();
      if (state.q.trim()) toast("找到 " + filtered().length + " 首");
    }, 180);
  });
  qEl.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      qEl.value = ""; state.q = ""; qClear.hidden = true; refresh(); qEl.blur();
    }
  });
  qClear.addEventListener("click", function () {
    qEl.value = ""; state.q = ""; qClear.hidden = true; refresh(); qEl.focus();
  });

  var menuBtn = $("#menuBtn"), menuPop = $("#menuPop");
  function closeMenu() { menuPop.hidden = true; menuBtn.setAttribute("aria-expanded", "false"); }
  menuBtn.addEventListener("click", function (e) {
    L.DomEvent.stopPropagation(e);
    var open = menuPop.hidden;
    menuPop.hidden = !open;
    menuBtn.setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("click", function (e) {
    if (!menuPop.hidden && !e.target.closest("#menuPop") && !e.target.closest("#menuBtn")) closeMenu();
  });
  menuPop.addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-act]");
    if (!btn) return;
    var act = btn.dataset.act;
    closeMenu();
    if (act === "poet") { openPanel("poet"); return; }
    if (act === "theme") { openPanel("theme"); return; }
    if (act === "motion") {
      var next = !(window.MOTION && window.MOTION.on);
      if (window.MOTION) window.MOTION.setEnabled(next);
      if (window.ATMOSPHERE && window.ATMOSPHERE.ok) window.ATMOSPHERE.setEnabled(next && !!window.MOTION.on);
      $("#motionState").textContent = next ? "开" : "关";
      toast(next ? "动效已开启" : "动效已关闭");
      return;
    }
    if (act === "reset") { hideCard(); closePanel(); closeDetail(); fitChina(); toast("已回到全国"); return; }
    if (act === "about") {
      toast("收录 " + POEMS.length + " 首唐宋诗词 · " + PLACES.length + " 处地标 · 全部离线", 3600);
    }
  });

  $("#zoomIn").addEventListener("click", function () { map.zoomIn(0.5); });
  $("#zoomOut").addEventListener("click", function () { map.zoomOut(0.5); });

  var sideToggle = $("#sideToggle");
  function closeSide() {
    document.body.classList.remove("side-open");
    sideToggle.setAttribute("aria-expanded", "false");
    if (state.activeId) placeCard();     // 可视区变宽，卡片重新居中
  }
  sideToggle.addEventListener("click", function () {
    var open = !document.body.classList.contains("side-open");
    document.body.classList.toggle("side-open", open);
    sideToggle.setAttribute("aria-expanded", String(open));
    if (open && window.MOTION && window.MOTION.sideIn) window.MOTION.sideIn();
    if (state.activeId) placeCard();     // 篇目栏占掉左侧，卡片在剩余区域居中
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (!menuPop.hidden) { closeMenu(); return; }
    if (document.body.classList.contains("side-open")) { closeSide(); return; }
    if (poemList && poemList.classList.contains("on")) { hidePoemList(); return; }
    if (detail.classList.contains("on")) { closeDetail(); return; }
    if (panel.classList.contains("on")) { closePanel(); return; }
    if (card.classList.contains("on")) { hideCard(); }
  });

  var rt = 0;
  window.addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      map.invalidateSize();
      fitChina();
      if (state.activeId) placeCard();
      if (!narrow()) closeSide();
    }, 220);
  });

  /* ══════════ 十二·五、自适应降载 ══════════
     云气层会持续重绘整屏。弱机/集显上先抽稀粒子，仍不达标就整层关掉，
     用户不必自己去菜单里找「动效」开关。 */
  function perfGuard() {
    if (!window.ATMOSPHERE || !window.ATMOSPHERE.ok) return;
    if (window.MOTION && !window.MOTION.on) return;       // 动效已关，没有负载

    function sample(dur, cb) {
      var t0 = 0, last = 0, n = 0, sum = 0;
      requestAnimationFrame(function step(now) {
        if (!t0) { t0 = last = now; }
        else { if (n > 4) sum += now - last; last = now; }
        n++;
        if (now - t0 < dur) requestAnimationFrame(step);
        else cb(sum / Math.max(1, n - 6));
      });
    }
    function report(ms, level) {
      window.__perf = { msPerFrame: +ms.toFixed(2), level: level };
    }

    sample(2200, function (a1) {
      if (a1 <= 27) { report(a1, "full"); return; }        // ≥ ~37fps，够用
      window.ATMOSPHERE.setDensity(0.45);
      sample(1800, function (a2) {
        if (a2 <= 30) { report(a2, "reduced"); return; }
        window.ATMOSPHERE.setEnabled(false);
        report(a2, "off");
        toast("为保流畅已收起云气（菜单「动效」可恢复）", 4200);
      });
    });
  }

  /* ══════════ 十二、启动 ══════════ */
  var nTang = 0, nSong = 0;
  POEMS.forEach(function (p) { if (p.dynasty === "唐") nTang++; else if (p.dynasty === "宋") nSong++; });
  $("#cntTang").textContent = nTang;
  $("#cntSong").textContent = nSong;
  $("#menuPop").querySelector('[data-act="poet"] i').textContent =
    Object.keys(POEMS.reduce(function (m, p) { m[p.author] = 1; return m; }, {})).length + " 位";

  refresh();
  fitChina();
  document.body.classList.toggle("show-prov", map.getZoom() >= 4.0);

  if (window.MOTION) window.MOTION.init();
  if (window.ATMOSPHERE) {
    window.ATMOSPHERE.mount({ layer: $("#atmosphere"), mode: "petals" });
    window.ATMOSPHERE.setEnabled(!!(window.MOTION && window.MOTION.on));
  }
  $("#motionState").textContent = window.MOTION && window.MOTION.on ? "开" : "关";
  perfGuard();

  if (window.MOTION && window.MOTION.on) {
    var elPoems = $("#statPoems"), elPlaces = $("#statPlaces");
    var nPoems = Number(elPoems.textContent) || 0;
    var nPlaces = Number(elPlaces.textContent) || 0;
    requestAnimationFrame(function () {
      window.MOTION.intro({ markers: markerAnimEls() });
      window.MOTION.countTo(elPoems, nPoems, 0.9);
      window.MOTION.countTo(elPlaces, nPlaces, 0.9);
    });
  }

  var m = /^#\/p\/([\w-]+)$/.exec(location.hash);
  if (m && POEM_BY_ID[m[1]]) {
    var node = PLACE_BY_ID[POEM_BY_ID[m[1]].__placeId];
    if (node) { map.setView([node.lat, node.lng], 6, { animate: false }); openCard(node, m[1]); }
    openDetail(m[1]);
  }
})();
