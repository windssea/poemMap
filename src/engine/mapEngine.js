/* ============================================================
   地图引擎（命令式 · Leaflet）
   ----------------------------------------------------------
   这是唯一直接操作 Leaflet 的地方。React 不参与地图的重绘：
   组件只表达「界面状态」，引擎订阅同一份状态并同步图层。
   这样既有 React 的声明式界面，又不至于让 Leaflet 图层
   走 React 的 diff（那才是真正的性能灾难）。

   图层次序即画法：省区底色 → 山体 → 水系 → 长城 → 国境 → 地名
   ============================================================ */
import L from "leaflet";
import { CHINA_GEO, GEO_EXTRAS } from "../data/index.js";
import { PLACES, PLACE_BY_ID } from "../data/places.js";
import { selectFiltered, visiblePlaceIds } from "../data/select.js";
import { smoothPath, simplifyProvince, countPts } from "../lib/geo.js";
import { narrow, esc, shortProvinceName } from "../lib/dom.js";
import { els, mapRef } from "./refs.js";
import { placePoemList } from "./anchor.js";
import { TERRAIN } from "./terrain.js";
import { MOTION } from "./motion.js";
import {
  getState, subscribe, openDetail, openPoemList, dismissOverlays, setHoverPlace,
} from "../store.js";

/* ---------------- 省区设色 ---------------- */
const REGION = {
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
const TINTS = {
  东北: ["#e3ddb9", "#dcd7b2"],
  华北: ["#e9dcb8", "#e2d5b0"],
  华东: ["#dde4bd", "#d7dfb6"],   // 江南
  华中: ["#e2e2bb", "#dcdcb4"],
  华南: ["#d8e3b8", "#d2deb1"],
  西南: ["#dbe4bd", "#d5dfb6"],
  西北: ["#eee3c2", "#e7dcb9"],
  其他: ["#e5e0bd", "#dfdab6"],
};
const PROV_FIX = {
  西藏自治区: ["#f3f0e2", "#efece0"],
  新疆维吾尔自治区: ["#f0e5c6", "#e9dfbe"],
  青海省: ["#ece5c9", "#e6dfc0"],
  内蒙古自治区: ["#eaddb6", "#e3d7ae"],
  四川省: ["#d9e2b9", "#d3ddb2"],
  云南省: ["#d8e3b6", "#d2deaf"],
};

/** 把 #rrggbb 按百分比调亮/调暗（amt 为负即压深）。用于省区边缘的「托底」色。 */
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(function (v) {
    const t = amt < 0 ? v * (1 + amt / 100) : v + (255 - v) * (amt / 100);
    return Math.max(0, Math.min(255, Math.round(t)));
  });
  return "#" + c.map(function (v) { return ("0" + v.toString(16)).slice(-2); }).join("");
}

/* 山脊勾线（羽化与柔光靠几何，不用 CSS blur） */
const RIDGE_INK = ["#5f7d68", "#66886f", "#6b8f74", "#647e6c"];
/* 山脚收进的「雾色」：接近省区底色，山脚由此没入地面/云气 */
const RIDGE_MIST = "#e9e4c6";
/* 背光坡的覆盖色（纯色，不用渐变——理由见渲染处的注释）。
   比主山最深的墨绿再暗一档，但靠低透明度只当「一层阴影」用。 */
const FACE_INK = "#4d6b59";
const CHINA_BOUNDS = L.latLngBounds([[17.4, 72.5], [54.2, 135.8]]);
const PANE_Z = { prov: 400, terrain: 410, hydro: 418, wall: 425, border: 430, geoLabels: 470 };

let engine = null;

/** 取引擎单例（组件与动作层都从这里拿命令式接口） */
export function getEngine() {
  return engine;
}

/* ============================================================
   创建
   ============================================================ */
export function createEngine(mapEl) {
  if (engine) return engine;

  const map = L.map(mapEl, {
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
  mapRef.map = map;
  window.__map = map;                     // 诊断钩子：tools/qa-*.js 仍可直接取用

  Object.keys(PANE_Z).forEach(function (name) {
    map.createPane(name);
    map.getPane(name).style.zIndex = PANE_Z[name];
  });
  map.getPane("geoLabels").style.pointerEvents = "none";
  map.getPane("terrain").style.pointerEvents = "none";
  map.getPane("wall").style.pointerEvents = "none";
  /* 羽化不用 CSS blur：整屏 SVG 挂着实时滤镜，每次缩放都要重新光栅化，
     是拖动/缩放卡顿的主因。改为「几何羽化」——省区靠径向渐变的柔过渡，
     山体靠同色柔边 + 纵向渐变收尾，观感接近而开销归零。 */

  const feats = CHINA_GEO.features || [];
  const provinces0 = feats.filter(function (f) { return f.properties.level === "province"; });
  const country = feats.filter(function (f) { return f.properties.level === "country"; });

  /* 省区轮廓抽稀：缩放代价与点数成正比，抽稀后缩放明显更跟手 */
  const rawProvPts = countPts(provinces0);
  const provinces = provinces0.map(function (f) { return simplifyProvince(f, 0.05); });
  const keptPts = countPts(provinces);
  window.__geoStats = {
    rawPoints: rawProvPts,
    keptPoints: keptPts,
    ratio: +(keptPts / rawProvPts).toFixed(3),
  };

  /* ---- 省区底色 ----
     一层平涂必然扁：真正让它「有厚度」的是三层叠色——
     ① 每省自己的径向晕染（中心亮、边缘暗，中心按 adcode 抖动，省与省之间自然过渡）
     ② 国境整片的一层大晕（西北偏暖沙、东南偏青绿，见下面 landWash）
     ③ 省界描一道略深的「托边」，色块就像裱在纸上，而不是印在纸上 */
  L.geoJSON(provinces, {
    pane: "prov",
    style: function (f) {
      return {
        fillColor: "url(#pg" + f.properties.adcode + ")",
        fillOpacity: 1,
        color: "#aab08f",
        weight: 1.5,
        opacity: 0.38,         // 省界只留一线淡痕，柔和的过渡交给径向渐变
        lineJoin: "round",
      };
    },
  }).addTo(map);

  /* 每省注入不规则径向渐变（中心亮、边缘暗、中心位置带抖动） */
  (function injectProvGradients() {
    let defs = "";
    provinces.forEach(function (f) {
      const ad = f.properties.adcode;
      const name = f.properties.name;
      const pair = PROV_FIX[name] || TINTS[REGION[name] || "其他"] || TINTS["其他"];
      const jx = ((ad * 37) % 60 + 20) / 100;
      const jy = ((ad * 53) % 60 + 18) / 100;
      /* 边缘再压深一档：色块之间原本只差一点点，平涂感就是这么来的。
         中心留一大片亮（.58 之前不落），只让四周暗下去，才有「一块地」的厚度。 */
      const edge = shade(pair[1], -7);
      defs += '<radialGradient id="pg' + ad + '" cx="' + jx.toFixed(2) + '" cy="' + jy.toFixed(2) +
        '" r="0.94"><stop offset="0" stop-color="' + pair[0] +
        '"/><stop offset="0.58" stop-color="' + pair[0] +
        '"/><stop offset="1" stop-color="' + edge + '"/></radialGradient>';
    });
    /* 国境大晕：西北暖沙、东南青绿。铺在整个国土上，
       让 34 个省区从「各自一块色」变成「一张画上的明暗」。 */
    defs += '<linearGradient id="landWash" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#dcc79b" stop-opacity="0.4"/>' +
      '<stop offset="0.42" stop-color="#e8e0bd" stop-opacity="0.06"/>' +
      '<stop offset="1" stop-color="#aecfa4" stop-opacity="0.36"/></linearGradient>';
    /* 纸纹：斜向细线，只在国土上铺一层（.05 的白噪点之外再给一点「纸的走向」） */
    defs += '<pattern id="landGrain" width="7" height="7" patternUnits="userSpaceOnUse"' +
      ' patternTransform="rotate(38)">' +
      '<rect width="7" height="7" fill="none"/>' +
      '<path d="M0 0 V7" stroke="rgba(150, 138, 108, 0.055)" stroke-width="1"/></pattern>';
    const svg = map.getPane("prov").querySelector("svg");
    if (svg) svg.insertAdjacentHTML("afterbegin", "<defs>" + defs + "</defs>");
  })();

  /* 国土整片的晕染（叠在省区之上、地形之下）+ 一层纸纹 + 海岸一线的托边 */
  if (country.length) {
    L.geoJSON(country, {
      pane: "prov",
      interactive: false,
      style: { fillColor: "url(#landWash)", fillOpacity: 1, stroke: false },
    }).addTo(map);
    L.geoJSON(country, {
      pane: "prov",
      interactive: false,
      style: { fillColor: "url(#landGrain)", fillOpacity: 1, stroke: false },
    }).addTo(map);
    L.geoJSON(country, {
      pane: "prov",
      interactive: false,
      style: { fill: false, color: "#c6ba95", weight: 3, opacity: 0.34, lineJoin: "round" },
    }).addTo(map);
  }

  /* ---- 山体：远山 → 主山（单峰分层）→ 柔光脊 → 暗坡 → 皴 → 勾线 → 亮脊 ----
     四层由淡到浓、由后到前，山就有了纵深而不是一片剪影。
     far 的剪影先加入，同 pane 内按加入顺序叠放，天然被主山压住。

     注意：主山是「一段段单峰」拼起来的，所以一律不能描边——
     否则每座峰的边界都会被勾出一条竖线，整条山脉裂成格子。 */
  const T = TERRAIN.build();
  /* 远山用半透明：色阶本来就淡，再让它透出一点底色，就成了「雾里的山」；
     不透明时那层浅色会读成一条白边，与青绿的主山格外冲。 */
  (T.sils || []).forEach(function (s) {
    if (!s.far) return;
    L.polygon(s.latlngs, {
      pane: "terrain", lineJoin: "round", lineCap: "round", interactive: false,
      fillColor: "url(#rgf" + s.tone + ")", fillOpacity: 0.62, stroke: false,
    }).addTo(map);
  });
  (T.sils || []).forEach(function (s) {
    if (s.far) return;
    L.polygon(s.latlngs, {
      pane: "terrain", lineJoin: "round", lineCap: "round", interactive: false,
      fillColor: "url(#rg" + s.tone + ")", fillOpacity: 0.94, stroke: false,
    }).addTo(map);
  });
  /* 背光坡：每座峰「峰顶→谷」的那半个坡覆一层暗色。
     这里刻意用**纯色**而不是渐变——上百个面各自引用 url(#渐变)，
     每次重绘都要按各自的包围盒重算，实测把帧耗时从 8.9 拉到 20.8ms。
     面的下缘本就与山体轮廓重合，纯色不会露边；山脚该淡的地方，
     山体自己的纵向渐变已经淡下去了。 */
  if ((T.faces || []).length) {
    T.faces.forEach(function (ring) {
      L.polygon(ring, {
        pane: "terrain", lineJoin: "round", lineCap: "round", interactive: false,
        fillColor: FACE_INK, fillOpacity: 0.085, stroke: false,
      }).addTo(map);
    });
  }
  /* 山脊上缘的一圈同色柔光。原来是靠 polygon 的粗描边做的，
     切分之后描边会画到每座峰的接缝上，改成就沿脊线描一遍。
     这道柔光同时是主山与远山的过渡带：白绿之间的硬边由它化开。 */
  if ((T.hazes || []).length) {
    L.polyline(T.hazes.map(function (h) { return h.latlngs; }), {
      pane: "terrain", color: "#a9cbb5", weight: 10, opacity: 0.22,
      lineCap: "round", lineJoin: "round", interactive: false,
    }).addTo(map);
  }
  /* 皴线合并成一条多段线：上百条短线只花一个 SVG 图元 */
  if ((T.grains || []).length) {
    L.polyline(T.grains, {
      pane: "terrain", color: "#789581", weight: 1.1, opacity: 0.22,
      lineCap: "round", lineJoin: "round", interactive: false,
    }).addTo(map);
  }
  (T.ridges || []).forEach(function (rd) {
    L.polyline(rd.latlngs, {
      pane: "terrain", color: RIDGE_INK[rd.tone], weight: 1.1, opacity: 0.42,
      lineCap: "round", lineJoin: "round", interactive: false,
    }).addTo(map);
  });
  /* 峰脊受光的一条细白线：与墨线一夹，山脊就立起来了。
     别太亮——纯白会跟远山的浅色叠成「雪线」。 */
  if ((T.crests || []).length) {
    L.polyline(T.crests, {
      pane: "terrain", color: "#f2f9ef", weight: 1.6, opacity: 0.32,
      lineCap: "round", lineJoin: "round", interactive: false,
    }).addTo(map);
  }

  /* 山体填充渐变。这里的分工是刻意的：
     单峰的面只表达「左坡受光 → 右坡背光」，纵向一律不羽化；
     山脚的收口由「山脚雾」那一层统一负责。两者分开，才既有每座峰
     自己的明暗，又不会在段与段之间露出接缝。 */
  (function injectTerrainGradients() {
    const tones = TERRAIN.tones || [];
    const farTones = TERRAIN.farTones || tones;
    let defs = "";
    for (let t = 0; t < tones.length; t++) {
      /* 主山：纵向（山巅最亮 → 山腰 → 山阴），末端收进地面。
         整条山脉就这一个面，所以不存在段与段的接缝。
         收口拉得长一些（.58 起就往下淡），山脚才像化进纸里，
         而不是一刀切在底色上。 */
      defs += '<linearGradient id="rg' + t + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="' + tones[t][2] + '"/>' +
        '<stop offset="0.30" stop-color="' + tones[t][1] + '"/>' +
        '<stop offset="0.58" stop-color="' + tones[t][0] + '"/>' +
        '<stop offset="0.82" stop-color="' + tones[t][0] + '" stop-opacity="0.5"/>' +
        '<stop offset="1" stop-color="' + tones[t][0] + '" stop-opacity="0.06"/></linearGradient>';
      /* 远山：整体压淡（纵向：山尖亮、往下渐没入雾） */
      defs += '<linearGradient id="rgf' + t + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="' + farTones[t][2] + '"/>' +
        '<stop offset="0.5" stop-color="' + farTones[t][1] + '"/>' +
        '<stop offset="0.86" stop-color="' + farTones[t][0] + '"/>' +
        '<stop offset="1" stop-color="' + RIDGE_MIST + '"/></linearGradient>';
    }
    const svg = map.getPane("terrain").querySelector("svg");
    if (svg) svg.insertAdjacentHTML("afterbegin", "<defs>" + defs + "</defs>");
  })();

  /* ---- 国境 ---- */
  L.geoJSON(country, {
    pane: "border",
    style: { color: "#a9b093", weight: 1.5, fill: false, lineJoin: "round", opacity: 0.8 },
  }).addTo(map);

  /* ---- 水系 / 运河 / 长城 ---- */
  (GEO_EXTRAS.rivers || []).forEach(function (r) {
    const pts = smoothPath(r.pts, 7);
    L.polyline(pts, { pane: "hydro", color: "#8fb6c9", weight: 3.6, opacity: 0.26, lineCap: "round", lineJoin: "round", interactive: false }).addTo(map);
    L.polyline(pts, { pane: "hydro", color: "#5f9fb8", weight: 1.5, opacity: 0.92, lineCap: "round", lineJoin: "round", interactive: false }).addTo(map);
  });
  if (GEO_EXTRAS.canal) {
    const cpts = smoothPath(GEO_EXTRAS.canal.pts, 7);
    L.polyline(cpts, { pane: "hydro", color: "#9dc0cb", weight: 1.1, opacity: 0.6, dashArray: "4 4", lineCap: "round", lineJoin: "round", interactive: false }).addTo(map);
  }
  if (GEO_EXTRAS.wall) {
    const wpts = smoothPath(GEO_EXTRAS.wall.pts, 6);
    L.polyline(wpts, { pane: "wall", color: "#d98b5f", weight: 5, opacity: 0.22, lineCap: "round", lineJoin: "round", interactive: false }).addTo(map);
    L.polyline(wpts, { pane: "wall", color: "#b8472e", weight: 2.4, opacity: 0.92, dashArray: "2 5", lineCap: "round", lineJoin: "round", interactive: false }).addTo(map);
  }

  /* ---- 地名：山河名 + 省名 ---- */
  (GEO_EXTRAS.labels || []).forEach(function (lb) {
    L.marker([lb.lat, lb.lng], {
      pane: "geoLabels", interactive: false, keyboard: false,
      icon: L.divIcon({ className: "geo-label", html: "<span>" + esc(lb.name) + "</span>", iconSize: [0, 0] }),
    }).addTo(map);
  });
  provinces.forEach(function (f) {
    const c = f.properties.centroid;
    if (!c) return;
    L.marker([c[1], c[0]], {
      pane: "geoLabels", interactive: false, keyboard: false,
      icon: L.divIcon({
        className: "prov-label",
        html: "<span>" + esc(shortProvinceName(f.properties.name)) + "</span>",
        iconSize: [0, 0],
      }),
    }).addTo(map);
  });

  /* ---- 山名：与地形同源（terrain.js 的 name），rank 小的先占位 ---- */
  const MTN_LABELS = (T.labels || []).slice().sort(function (a, b) { return a.rank - b.rank; });
  MTN_LABELS.forEach(function (m) {
    m.marker = L.marker([m.lat, m.lng], {
      pane: "geoLabels", interactive: false, keyboard: false,
      icon: L.divIcon({
        className: "mtn-label",
        html: "<span>" + esc(m.name) + "</span>",
        iconSize: [0, 0],
      }),
    }).addTo(map);
  });

  /* ============================================================
     地标
     ============================================================ */
  function dotHTML(node, active) {
    const many = node.poems.length > 1;
    /* 不再挂原生 title：悬停交给 #placeHover 那张纸卡（又慢又丑的气泡
       只能显示一行纯文本，读不出「这一处有哪几首」）。 */
    return '<span class="dot-wrap' + (active ? " on" : "") + '">' +
      (active ? '<span class="dot-glow"></span><span class="dot-ring"></span>' : "") +
      '<span class="dot' + (many ? " many" : "") + '"></span>' +
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
      /* 点下去就换成浮层/抽屉，悬停卡先收掉，别两张卡叠着 */
      clearTimeout(hoverTimer);
      hoverSeq++;
      setHoverPlace(null);
      /* 一处多诗 → 先进浮层挑一首；独此一首 → 直接开抽屉 */
      if (n.poems.length > 1) openPoemList(n.id);
      else openDetail(n.poems[0].id, n.id);
    });
    n.marker.on("mouseover", function () { wantHover(n.id); });
    n.marker.on("mouseout", function () { wantHover(null); });
  });

  /* ---- 悬停卡 ----
     显隐各留一点延时：珠子挨得密时，鼠标从一颗划到另一颗会连着触发
     out/in，不留延时卡片就一直闪。用序号挡住「上一次的延时回调」，
     后到的事件说了算。地图一开始拖动/缩放就立刻收掉，别跟着飘。 */
  let hoverTimer = 0;
  let hoverSeq = 0;
  function wantHover(id) {
    const seq = ++hoverSeq;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(function () {
      if (seq !== hoverSeq) return;
      setHoverPlace(id);
    }, id ? 70 : 190);
  }
  map.on("movestart zoomstart", function () {
    clearTimeout(hoverTimer);
    hoverSeq++;
    setHoverPlace(null);
  });

  /* ============================================================
     地名签避让（只对「地名签」做避让）
     ============================================================ */
  let layoutQueued = false;
  function queueLayout() {
    if (layoutQueued) return;
    layoutQueued = true;
    requestAnimationFrame(function () { layoutQueued = false; layoutLabels(); });
  }

  /* 地名签的引用缓存在地标对象上：省掉「每帧 × 67 个地标」的 querySelector。
     setIcon 之后元素会被替换，用 isConnected 兜住，不必手工失效。 */
  function nameElOf(n) {
    let el = n.__nameEl;
    if (!el || !el.isConnected) {
      const host = n.marker.getElement();
      el = host ? host.querySelector(".dot-name") : null;
      n.__nameEl = el;
    }
    return el;
  }

  function layoutLabels() {
    const size = map.getSize();
    const zoom = map.getZoom();
    const maxLabels = zoom < 4.9 ? 12 : zoom < 5.6 ? 22 : 60;
    const items = [];
    PLACES.forEach(function (n) {
      if (!map.hasLayer(n.marker)) return;
      const el = n.marker.getElement();
      if (!el) return;
      const pt = map.latLngToContainerPoint([n.lat, n.lng]);
      if (pt.x < -80 || pt.y < -60 || pt.x > size.x + 80 || pt.y > size.y + 80) return;
      items.push({ n: n, el: el, x: pt.x, y: pt.y });
    });

    items.sort(function (a, b) { return b.n.poems.length - a.n.poems.length; });

    /* ---- 珠子去糊 ----
       收了 280 多首之后，苏杭一带十几个地标挤在几十像素里，远看就是一坨红。
       这里按「题咏多者优先」逐个占位：与已占位的珠子相撞的，压到半透明。
       于是同一片密处读出来是**疏密**（谁重谁轻一目了然），而不是一团糊。
       位置池只在视野内建，缩放放大后自然分开、透明度回到 1。 */
    const dotBoxes = [];
    items.forEach(function (o) {
      const r = o.n.isActive ? 15 : 8.5;
      const box = { x1: o.x - r, x2: o.x + r, y1: o.y - r, y2: o.y + r };
      let clash = false;
      for (let i = 0; i < dotBoxes.length && !clash; i++) {
        const b = dotBoxes[i];
        if (!(box.x2 < b.x1 || b.x2 < box.x1 || box.y2 < b.y1 || b.y2 < box.y1)) clash = true;
      }
      if (!clash) dotBoxes.push(box);
      o.recede = clash && !o.n.isActive;
    });

    const boxes = [];
    let shown = 0;
    items.forEach(function (o) {
      /* 珠子的疏密先落定：放在 label 早退之前，
         免得某个地标没有名签时珠子透明度就漏更新了。 */
      if (o.el) o.el.style.opacity = o.recede ? ".52" : "1";
      const label = nameElOf(o.n);
      if (!label) return;
      let on;
      if (o.n.isActive) {
        on = true;
        boxes.push({ x1: o.x - 30, x2: o.x + 30, y1: o.y + 8, y2: o.y + 34 });
      } else {
        const w = o.n.name.length * 14 + 10;
        const box = { x1: o.x - w / 2, x2: o.x + w / 2, y1: o.y + 8, y2: o.y + 26 };
        on = shown < maxLabels;
        for (let i = 0; i < boxes.length && on; i++) {
          const b = boxes[i];
          if (!(box.x2 < b.x1 || b.x2 < box.x1 || box.y2 < b.y1 || b.y2 < box.y1)) on = false;
        }
        if (on) { boxes.push(box); shown++; }
      }
      label.style.opacity = on ? "1" : "0";
    });

    /* ---- 山名：只与「别的山名」互斥 ----
       如果连地标名也一起避让，全国视野下 13 条主要山脉会被挤得只剩
       六七个。山名字小、带浅色描边，与地标签轻微相叠仍然读得出来，
       所以这里用一个独立的占位池，让山脉的名字尽量标全。 */
    const rankCut = zoom < 4.1 ? 0 : 2;
    const mtnPlaced = [];
    /* 地标的圆点当成硬约束先占位：山名不压点，但可以和地标文字相叠
       （地标名是主内容、山名是小字，小字压在大字上仍分得清）。 */
    items.forEach(function (o) {
      mtnPlaced.push({ x1: o.x - 9, x2: o.x + 9, y1: o.y - 9, y2: o.y + 9 });
    });
    MTN_LABELS.forEach(function (m) {
      const el = m.marker.getElement();
      const span = el && el.querySelector("span");
      if (!span) return;
      if (m.rank > rankCut) { span.style.opacity = "0"; return; }
      const pt = map.latLngToContainerPoint([m.lat, m.lng]);
      if (pt.x < -90 || pt.y < -60 || pt.x > size.x + 90 || pt.y > size.y + 60) {
        span.style.opacity = "0";
        return;
      }
      /* 判定框略小于实际字宽：允许不到一字的轻微相叠 */
      const w = m.name.length * 12.2 + 6;
      const box = { x1: pt.x - w / 2, x2: pt.x + w / 2, y1: pt.y - 8.5, y2: pt.y + 8.5 };
      let on = true;
      for (let i = 0; i < mtnPlaced.length && on; i++) {
        const b = mtnPlaced[i];
        if (!(box.x2 < b.x1 || b.x2 < box.x1 || box.y2 < b.y1 || b.y2 < box.y1)) on = false;
      }
      if (on) mtnPlaced.push(box);
      span.style.opacity = on ? "1" : "0";
    });
  }
  window.__layout = layoutLabels;

  function setActive(node) {
    PLACES.forEach(function (n) {
      const want = !!node && n.id === node.id;
      if (!!n.isActive === want) return;
      n.isActive = want;
      n.marker.setIcon(nodeIcon(n, want));
      n.marker.setZIndexOffset(want ? 1500 : 0);
    });
    queueLayout();
  }

  /* ============================================================
     视野
     ============================================================ */
  /** 把某点放到「画面宽度的 frac 处、高度 46% 处」所需的地图中心。
      用投影坐标算，比 panBy 的方向约定可靠；frac=0.5 即水平居中。 */
  function offsetCenter(node, zoom, frac) {
    const size = map.getSize();
    const proj = map.project([node.lat, node.lng], zoom);
    return map.unproject(
      proj.add([size.x / 2 - size.x * frac, size.y * 0.04]),
      zoom
    );
  }

  function fitChina() {
    const sideOpen = document.body.classList.contains("side-open");
    const padLeft = narrow() ? 18 : (sideOpen ? (els.sidebar ? els.sidebar.offsetWidth : 0) + 38 : 18);
    /* 留白按「界面让位」而非「舒服」来定：
       上让开题名与筛选条（约 100px）、下让开统计 dock（约 72px）、
       右让开竖排题词与罗盘（约 92px），左只留裱边。
       中国轮廓的宽高比约 1.38，在 16:9 屏上永远是「高度先卡住」，
       所以上下那几十像素直接换成画面大小——松一点，整张图就小一圈。 */
    map.fitBounds(CHINA_BOUNDS, {
      /* 窄屏上顶部只剩一行「搜索框 + 两个圆钮」（约 45px + 12px 上边距），
         所以上面留 68 就够；下面给统计 dock 与缩放钮让位。
         此时画面其实是**宽度**先卡住，这两组数字只影响居中，不影响大小。 */
      paddingTopLeft: [padLeft, narrow() ? 68 : 100],
      paddingBottomRight: [narrow() ? 18 : 92, narrow() ? 78 : 74],
      animate: false,
    });
    queueLayout();
  }

  /* ============================================================
     与状态同步
     ============================================================ */
  /* 首次铺点由开场时间线负责（App 在 MOTION.init 之后调 intro），
     这里只处理**后续筛选**新亮起来的地标，免得两套动画抢同一批元素。 */
  let firstSync = true;

  function syncVisibility() {
    const s = getState();
    const list = selectFiltered(s);
    const alive = visiblePlaceIds(list);

    const added = [];
    PLACES.forEach(function (n) {
      const hit = alive.has(n.id);
      if (hit && !map.hasLayer(n.marker)) {
        n.marker.addTo(map);
        added.push(n);
      }
      if (!hit && map.hasLayer(n.marker)) map.removeLayer(n.marker);
    });

    /* 新亮起来的地标依次淡入。
       换一次筛选可能一次进出几十个点，整片「啪」地出现既生硬，
       也让人看不出到底变了哪几处；淡入能把「变化」本身说清楚。 */
    if (!firstSync && added.length && MOTION.on) {
      const els = added.map(function (n) {
        const el = n.marker.getElement();
        return el && el.querySelector(".mk-anim");
      }).filter(Boolean);
      if (els.length) {
        MOTION.markersIn(els, {
          each: Math.max(0.005, Math.min(0.018, 0.45 / els.length)),
          duration: 0.42,
        });
      }
    }

    firstSync = false;
    queueLayout();
    return list;
  }

  function syncActive() {
    const s = getState();
    setActive(s.activePlaceId ? PLACE_BY_ID[s.activePlaceId] : null);
  }

  /* 只在「真正影响地图」的键变化时才同步，避免无谓重算 */
  let lastFilterKey = "";
  let lastActive = null;
  subscribe(function () {
    const s = getState();
    const key = [s.q, s.dynasty, s.form, s.author, s.tag, s.school].join("\u0000");
    if (key !== lastFilterKey) {
      lastFilterKey = key;
      syncVisibility();
    }
    if (s.activePlaceId !== lastActive) {
      lastActive = s.activePlaceId;
      syncActive();
    }
  });

  /* ============================================================
     地图事件
     ============================================================ */
  /* 缩放分档：地标珠子的大小、地名签的字号都挂在 body 的类上，
     省得每个 marker 都算一遍（.dot-wrap 里读 --dot 即可） */
  function syncZoomClasses() {
    const z = map.getZoom();
    document.body.classList.toggle("show-prov", z >= 4.0);
    document.body.classList.toggle("zoom-far", z < 4.6);
    document.body.classList.toggle("zoom-near", z >= 6.2);
  }
  map.on("zoomend moveend", function () {
    syncZoomClasses();
    queueLayout();
    const s = getState();
    if (s.poemListPlaceId) placePoemList(PLACE_BY_ID[s.poemListPlaceId]);
  });
  map.on("move zoom", queueLayout);
  /* 点地图空白：卡片、磨砂浮层、右侧详情抽屉一并收起（单次原子变更，见 store 注释） */
  /* 点地图空白：卡片、磨砂浮层、右侧详情抽屉一并收起（单次原子变更，见 store 注释） */
  map.on("click", function () { dismissOverlays(); });

  /* ============================================================
     对外接口
     ============================================================ */
  engine = {
    map: map,
    fitChina: fitChina,
    layout: queueLayout,
    markerAnimEls: function markerAnimEls() {
      const out = [];
      PLACES.forEach(function (n) {
        if (!map.hasLayer(n.marker)) return;
        const el = n.marker.getElement();
        const a = el && el.querySelector(".mk-anim");
        if (a) out.push(a);
      });
      return out;
    },
    /** 飞去某处并开卡（侧栏点篇目 / 命令面板 / 随机一首都走这里）。
        落点略偏左：抽屉从右侧盖过来时，地标不至于正正好被压住。
        ——只在**用户明确说「去这里」**时才飞；打开抽屉本身不碰地图，
        见 components/Detail.jsx 里的说明。 */
    goToPlace: function (placeId, minZoom) {
      const node = PLACE_BY_ID[placeId];
      if (!node) return null;
      const z = Math.max(map.getZoom(), minZoom || 5.6);
      const center = offsetCenter(node, z, 0.38);
      if (MOTION.on) map.flyTo(center, z, { duration: 1.05 });
      else map.setView(center, z, { animate: false });
      return node;
    },
    closeAll: function () { dismissOverlays(); },
    invalidate: function () { map.invalidateSize(); },
  };

  /* 首屏：按当前筛选点亮地标 */
  syncVisibility();
  syncZoomClasses();

  return engine;
}
