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

  /* 图层次序即画法：省区底色 → 山体 → 水系 → 国境 → 地名 */
  var PANE_Z = { prov: 400, terrain: 410, hydro: 418, border: 430, geoLabels: 470 };
  Object.keys(PANE_Z).forEach(function (name) {
    map.createPane(name);
    map.getPane(name).style.zIndex = PANE_Z[name];
  });
  map.getPane("geoLabels").style.pointerEvents = "none";
  map.getPane("terrain").style.filter = "blur(1.1px)";

  var feats = CHINA.features || [];
  var provinces = feats.filter(function (f) { return f.properties.level === "province"; });
  var country = feats.filter(function (f) { return f.properties.level === "country"; });

  L.geoJSON(provinces, {
    pane: "prov",
    style: function (f) {
      var name = f.properties.name;
      var pair = PROV_FIX[name] || TINTS[REGION[name] || "其他"] || TINTS["其他"];
      return {
        fillColor: pair[f.properties.adcode % 2],
        fillOpacity: 1,
        color: "#bcc0a6",
        weight: 0.9,
        opacity: 0.85,
        lineJoin: "round",
      };
    },
  }).addTo(map);

  var T = window.TERRAIN ? window.TERRAIN.build() : { masses: [], peaks: [], crests: [], mist: [], decor: [] };
  (T.masses || []).forEach(function (m) {
    L.polygon(m.latlngs, {
      pane: "terrain", stroke: false, fillColor: m.color, fillOpacity: m.opacity * 0.5,
      lineJoin: "round", interactive: false,
    }).addTo(map);
  });
  (T.peaks || []).forEach(function (pk) {
    L.polygon(pk.latlngs, {
      pane: "terrain", stroke: false, fillColor: pk.color, fillOpacity: pk.opacity * 0.56, interactive: false,
    }).addTo(map);
  });
  (T.crests || []).forEach(function (c) {
    L.polyline(c.latlngs, {
      pane: "terrain", color: "#8fa894", weight: 1, opacity: 0.18, interactive: false,
    }).addTo(map);
  });

  L.geoJSON(country, {
    pane: "border",
    style: { color: "#a9b093", weight: 1.5, fill: false, lineJoin: "round", opacity: 0.8 },
  }).addTo(map);

  EXTRAS.rivers.forEach(function (r) {
    L.polyline(r.pts, {
      pane: "hydro", color: "#8fb6c9", weight: 1.7, opacity: 0.82, lineCap: "round", lineJoin: "round",
    }).addTo(map);
  });
  if (EXTRAS.canal) {
    L.polyline(EXTRAS.canal.pts, {
      pane: "hydro", color: "#9dc0cb", weight: 1.2, opacity: 0.6, lineCap: "round", dashArray: "4 4",
    }).addTo(map);
  }
  if (EXTRAS.wall) {
    L.polyline(EXTRAS.wall.pts, {
      pane: "hydro", color: "#c2b696", weight: 1.5, opacity: 0.6, lineCap: "round", dashArray: "1 6",
    }).addTo(map);
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
    var padLeft = narrow() ? 18 : (side.offsetWidth + 20 + 18);
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
      openCard(n);
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
  });
  map.on("move zoom", queueLayout);
  map.on("click", hideCard);

  /* ══════════ 五、中央诗词卡 ══════════ */
  var card = $("#card");

  function placeCard(node) {
    if (narrow()) return;   // 窄屏由 CSS 固定
    var pt = map.latLngToContainerPoint([node.lat, node.lng]);
    var w = card.offsetWidth, h = card.offsetHeight;
    var side = $("#sidebar");
    var minLeft = side.offsetWidth + 18 + 16;
    var maxRight = window.innerWidth - 116;

    var left = pt.x + 30;
    if (left + w > maxRight) left = pt.x - w - 30;
    left = Math.max(minLeft, Math.min(left, maxRight - w));

    var top = pt.y - h * 0.58;
    top = Math.max(96, Math.min(top, window.innerHeight - h - 92));
    card.style.left = Math.round(left) + "px";
    card.style.top = Math.round(top) + "px";
  }

  function renderCardPoem(p) {
    var el = $("#cardPoem");
    var maxLen = 0;
    p.lines.forEach(function (l) {
      var n = l.replace(/[，。？！、；：·「」《》\s]/g, "").length;
      if (n > maxLen) maxLen = n;
    });
    var horiz = p.lines.length > 6 || maxLen > 14;
    el.className = "c-poem" + (horiz ? " horiz" : "");
    el.innerHTML = p.lines.map(function (l) { return '<span class="col">' + esc(l) + "</span>"; }).join("");
  }

  function renderCardOthers(node, cur) {
    var box = $("#cardOthers");
    var rest = node.poems.filter(function (q) { return q.id !== cur.id; });
    if (!rest.length) { box.hidden = true; box.innerHTML = ""; return; }
    var head = '<em>此处另有 ' + rest.length + " 首：</em>";
    box.innerHTML = head + rest.slice(0, 5).map(function (q) {
      return '<button type="button" data-id="' + q.id + '" title="' + esc(q.dynasty + " · " + q.author) + '">' +
        esc(q.title) + "</button>";
    }).join("") + (rest.length > 5 ? "<em>…</em>" : "");
    box.hidden = false;
  }

  function openCard(node, poemId) {
    state.activeId = node.id;
    setActive(node);
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
  }

  $("#cardClose").addEventListener("click", hideCard);
  $("#cardOthers").addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-id]");
    if (!btn) return;
    var node = PLACE_BY_ID[state.activeId];
    if (node) openCard(node, btn.dataset.id);
  });
  $("#cardMore").addEventListener("click", function () {
    if (state.openId) openDetail(state.openId);
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

    var maxLen = 1;
    p.lines.forEach(function (l) {
      var n = l.replace(/[，。？！、；：·「」《》\s]/g, "").length;
      if (n > maxLen) maxLen = n;
    });
    var horiz = p.lines.length > 20 || maxLen > 16;
    var poem = $("#dPoem");
    poem.className = "d-poem" + (horiz ? " horiz" : "");
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
    if (node) {
      /* 卡片若已打开，切成这一首；未打开则不动 */
      if (card.classList.contains("on")) openCard(node, id);
      else setActive(node);
    }
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
  function closeSide() { document.body.classList.remove("side-open"); sideToggle.setAttribute("aria-expanded", "false"); }
  sideToggle.addEventListener("click", function () {
    var open = !document.body.classList.contains("side-open");
    document.body.classList.toggle("side-open", open);
    sideToggle.setAttribute("aria-expanded", String(open));
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (!menuPop.hidden) { closeMenu(); return; }
    if (document.body.classList.contains("side-open")) { closeSide(); return; }
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
      if (state.activeId) placeCard(PLACE_BY_ID[state.activeId]);
      if (!narrow()) closeSide();
    }, 220);
  });

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
