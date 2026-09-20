/* ============================================================
   App：版式装配 + 三件「引擎」的启停
   ----------------------------------------------------------
   组件各管一块界面；地图 / 云气 / 动效是命令式的，在这里起步。
   全局副作用（键盘、尺寸、地址栏、降载）也集中在本组件，
   免得散落到各处互相打架。
   ============================================================ */
import { useEffect, useRef } from "react";

import { useStore, getState, setState, closeCard, closeMenu, closeSide, closePoemList,
  closeDetail, closePanel, openDetail, dismissOverlays, setMotionOn, showToast,
  togglePalette, closePalette, closeHelp, openHelp } from "./store.js";
import { useFilteredPoems } from "./hooks/useFiltered.js";
import { PLACE_BY_ID } from "./data/places.js";
import { POEM_BY_ID } from "./data/index.js";
import { createEngine, getEngine } from "./engine/mapEngine.js";
import { placeCard, placePoemList } from "./engine/anchor.js";
import { MOTION } from "./engine/motion.js";
import { ATMOSPHERE } from "./engine/atmosphere.js";
import { narrow } from "./lib/dom.js";
import { exposeDiagnostics } from "./devtools.js";

import Brand from "./components/Brand.jsx";
import { Tools, MenuPop } from "./components/Tools.jsx";
import Sidebar from "./components/Sidebar.jsx";
import BottomBar from "./components/BottomBar.jsx";
import Card from "./components/Card.jsx";
import PoemList from "./components/PoemList.jsx";
import PlaceHover from "./components/PlaceHover.jsx";
import Detail from "./components/Detail.jsx";
import Panel from "./components/Panel.jsx";
import Palette from "./components/Palette.jsx";
import Help from "./components/Help.jsx";
import Toast from "./components/Toast.jsx";
import { Compass, SideVerse, Zoomer } from "./components/Chrome.jsx";
import { MapCanvas, Paint, Mount } from "./components/Paint.jsx";

/* 深链解析：#/p/<id> → 把地图挪到该诗所在的地标，并打开详情抽屉。
   初次加载与后续 hashchange 共用一份逻辑。 */
function openFromHash(engine) {
  const m = /^#\/p\/([\w-]+)$/.exec(location.hash);
  if (!m) return;
  const p = POEM_BY_ID[m[1]];
  if (!p) return;
  const node = PLACE_BY_ID[p.__placeId];
  if (node && engine && engine.map) {
    engine.map.setView([node.lat, node.lng], 6, { animate: false });
    engine.map.fire("moveend");
  }
  /* 顺手点亮它所在的地标：深链进来也该看到「是哪一处」 */
  openDetail(p.id, node ? node.id : undefined);
}

export default function App() {
  const mapEl = useRef(null);
  const atmoEl = useRef(null);
  const sideOpen = useStore("sideOpen");
  const detailPoemId = useStore("detailPoemId");
  const poemListPlaceId = useStore("poemListPlaceId");
  const panel = useStore("panel");
  const list = useFilteredPoems();

  /* ---------- 启动：地图 → 动效 → 云气 → 开场 ---------- */
  useEffect(function () {
    const engine = createEngine(mapEl.current);
    engine.fitChina();
    exposeDiagnostics();          // 仅开发期：把引擎挂到 window 供无头探针取用

    MOTION.init();
    if (ATMOSPHERE) {
      ATMOSPHERE.mount({ layer: atmoEl.current, mode: "petals" });
      ATMOSPHERE.setEnabled(!!MOTION.on);
    }
    setMotionOn(MOTION.on);

    if (MOTION.on) {
      requestAnimationFrame(function () {
        MOTION.intro({ markers: engine.markerAnimEls() });
      });
    }
    perfGuard();

    /* 深链：#/p/<id> 直接打开某首的详情（顺手把地图挪到它所在的地标） */
    openFromHash(engine);
  }, []);

  /* ---------- 地址栏手改 / 前进后退也能打开 ---------- */
  useEffect(function () {
    function onHash() { openFromHash(getEngine()); }
    window.addEventListener("hashchange", onHash);
    return function () { window.removeEventListener("hashchange", onHash); };
  }, []);

  /* ---------- body 上的三个状态类 ---------- */
  useEffect(function () {
    document.body.classList.toggle("side-open", sideOpen);
  }, [sideOpen]);

  /* 索引面板从左滑出，会把左下统计 dock 整条盖掉一半——
     挂个类让 dock 整体退场，比露半截干净。 */
  useEffect(function () {
    document.body.classList.toggle("panel-open", panel);
  }, [panel]);

  /* ---------- 地址栏与抽屉同步 ---------- */
  useEffect(function () {
    if (detailPoemId) {
      if (location.hash !== "#/p/" + detailPoemId) {
        history.replaceState(null, "", "#/p/" + detailPoemId);
      }
    } else if (/^#\/p\//.test(location.hash)) {
      history.replaceState(null, "", location.pathname + location.search);
    }
  }, [detailPoemId]);

  /* ---------- 正在读的诗若被筛掉，收起来 ---------- */
  useEffect(function () {
    const s = getState();
    const viewed = s.detailPoemId || s.openPoemId;
    if (viewed && !list.some(function (p) { return p.id === viewed; })) {
      setState({
        activePlaceId: null,
        openPoemId: null,
        detailPoemId: null,
        notesOpen: false,
      });
    }
  }, [list]);

  /* ---------- 窗口尺寸 ---------- */
  useEffect(function () {
    let t = 0;
    function onResize() {
      clearTimeout(t);
      t = setTimeout(function () {
        const e = getEngine();
        if (!e) return;
        e.invalidate();
        e.fitChina();
        placeCard();
        const s = getState();
        if (s.poemListPlaceId) placePoemList(PLACE_BY_ID[s.poemListPlaceId]);
        if (!narrow()) closeSide();
      }, 220);
    }
    window.addEventListener("resize", onResize);
    return function () { window.removeEventListener("resize", onResize); clearTimeout(t); };
  }, []);

  /* ---------- 键盘：⌘K 命令面板 · ? 快捷键 · Esc 逐层收 ---------- */
  useEffect(function () {
    function onKey(e) {
      const t = e.target;
      const typing = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);

      /* ⌘K / Ctrl+K：命令面板。这是全局的，输入框里也认——
         「正在搜索」时想换个入口，不该先按 Esc 退出来。 */
      if ((e.metaKey || e.ctrlKey) && !e.altKey && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        togglePalette();
        return;
      }

      if (e.key === "?" && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        openHelp();
        return;
      }

      /* 「/」是搜索框的通用快捷方式。输入框里、或按着修饰键时不抢。 */
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (!typing) {
          const q = document.getElementById("q");
          if (q) { e.preventDefault(); q.focus(); q.select(); }
        }
        return;
      }

      if (e.key !== "Escape") return;
      const s = getState();
      /* 从最上面一层往下收 */
      if (s.paletteOpen) { closePalette(); return; }
      if (s.helpOpen) { closeHelp(); return; }
      if (s.menuOpen) { closeMenu(); return; }
      if (s.sideOpen) { closeSide(); return; }
      if (s.poemListPlaceId) { closePoemList(); return; }
      if (s.detailPoemId) { closeDetail(); return; }
      if (s.panel) { closePanel(); return; }
      if (s.openPoemId) closeCard();
    }
    document.addEventListener("keydown", onKey);
    return function () { document.removeEventListener("keydown", onKey); };
  }, []);

  /* ---------- 抽屉/浮层开着时点地图也要收（引擎已处理 click，这里兜一层空白区） ----------
     ⚠️ 必须调 dismissOverlays() 一次性收干净，不能拆成多次 setState。 */
  useEffect(function () {
    if (!detailPoemId && !poemListPlaceId) return;
    function onDown(e) {
      const s = getState();
      if (!s.detailPoemId && !s.poemListPlaceId) return;
      const t = e.target;
      if (!t || !t.closest) return;
      if (t.closest("#detail") || t.closest("#poemList") || t.closest("#card") ||
        t.closest("#panel") || t.closest("#sidebar") || t.closest("#bottomBar") ||
        t.closest("#tools") || t.closest("#zoomer") || t.closest("#menuPop")) return;
      /* 落在地图上（或其它空白处）→ 卡片、浮层、抽屉一并收起 */
      dismissOverlays();
    }
    document.addEventListener("pointerdown", onDown);
    return function () { document.removeEventListener("pointerdown", onDown); };
  }, [detailPoemId, poemListPlaceId]);

  return (
    <>
      <MapCanvas mapRef={mapEl} />
      <Paint />
      <Mount />
      <div id="atmosphere" ref={atmoEl} aria-hidden="true" />

      <Brand />
      <Tools />
      <Sidebar />
      <PoemList />
      <PlaceHover />
      <Card />
      <BottomBar />
      <SideVerse />
      <Compass />
      <Zoomer />
      <Detail />
      <Panel />
      <MenuPop />
      <Palette />
      <Help />
      <Toast />
    </>
  );
}

/* ============================================================
   自适应降载：开场采样帧间隔，弱机先抽稀云气、再不行整层关掉
   ============================================================ */
function perfGuard() {
  if (!ATMOSPHERE.ok) return;
  if (!MOTION.on) return;

  function sample(dur, cb) {
    let t0 = 0, last = 0, n = 0, sum = 0;
    requestAnimationFrame(function step(now) {
      if (!t0) { t0 = last = now; }
      else if (n > 4) { sum += now - last; last = now; }
      n++;
      if (now - t0 < dur) requestAnimationFrame(step);
      else cb(sum / Math.max(1, n - 6));
    });
  }
  function report(ms, level) {
    window.__perf = { msPerFrame: +ms.toFixed(2), level: level };
  }

  sample(2200, function (a1) {
    if (a1 <= 27) { report(a1, "full"); return; }
    ATMOSPHERE.setDensity(0.45);
    sample(1800, function (a2) {
      if (a2 <= 30) { report(a2, "reduced"); return; }
      ATMOSPHERE.setEnabled(false);
      report(a2, "off");
      showToast("为保流畅已收起云气（菜单「动效」可恢复）", 4200);
    });
  });
}
