import * as THREE from "three";
/* ============================================================
   水墨云气层（Three.js / WebGL）
   ----------------------------------------------------------
   叠在地图之上的一层「活的画卷」：远山雾霭、流云、飘落花瓣、
   墨点与光尘，全部纹理由 Canvas 现场生成（不引入任何图片），
   因此依旧完全离线。

   相机做真实三维透视：鼠标移动、地图平移时，远近层自然错位，
   形成景深与空间感。选中地标时可在此处散开一圈墨晕。
   ============================================================ */
export const ATMOSPHERE = (function () {
  "use strict";

  var api = { ok: false, enabled: false, reason: "" };
  var renderer = null, scene = null, camera = null, canvas = null, clock = null;
  var raf = 0, running = false;
  var items = [];          // 普通精灵：{sprite, kind, data}
  var pulses = [];         // 临时墨晕
  var halfW = 700, halfH = 400;
  var pointer = { x: 0, y: 0 }, cameraAt = { x: 0, y: 0 }, camWant = { x: 0, y: 0 };
  var shift = { x: 0, y: 0 }, shiftAt = { x: 0, y: 0 };
  var reduce = false, quality = 1, mode = "full", density = 1;

  /* ---------------- 纹理（Canvas 生成） ---------------- */
  function cv(size) {
    var c = document.createElement("canvas");
    c.width = c.height = size;
    return c;
  }
  function tex(c) {
    var t = new THREE.CanvasTexture(c);
    t.needsUpdate = true;
    return t;
  }

  function mistTexture(size) {
    var c = cv(size), g = c.getContext("2d");
    g.filter = "blur(" + (size * 0.055).toFixed(1) + "px)";
    for (var i = 0; i < 7; i++) {
      var r = size * (0.16 + Math.random() * 0.18);
      var x = size * (0.18 + Math.random() * 0.64);
      var y = size * (0.3 + Math.random() * 0.42);
      var grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, "rgba(255,253,247,.5)");
      grd.addColorStop(0.55, "rgba(255,252,244,.22)");
      grd.addColorStop(1, "rgba(255,250,240,0)");
      g.fillStyle = grd;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
    return tex(c);
  }

  function cloudTexture(size) {
    var c = cv(size), g = c.getContext("2d");
    g.filter = "blur(" + (size * 0.05).toFixed(1) + "px)";
    var lobes = 6 + Math.floor(Math.random() * 4);
    for (var i = 0; i < lobes; i++) {
      var t = i / (lobes - 1);
      var x = size * (0.14 + 0.72 * t);
      var y = size * (0.52 - 0.16 * Math.sin(Math.PI * t));
      var r = size * (0.1 + 0.1 * Math.sin(Math.PI * t));
      var grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, "rgba(255,254,250,.62)");
      grd.addColorStop(0.6, "rgba(252,250,244,.26)");
      grd.addColorStop(1, "rgba(250,248,240,0)");
      g.fillStyle = grd;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
    return tex(c);
  }

  function petalTexture(size, color) {
    var c = cv(size), g = c.getContext("2d");
    var w = size, h = size;
    g.translate(w / 2, h / 2);
    g.filter = "blur(1.2px)";
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, -h * 0.34);
    g.bezierCurveTo(w * 0.3, -h * 0.18, w * 0.24, h * 0.2, 0, h * 0.34);
    g.bezierCurveTo(-w * 0.24, h * 0.2, -w * 0.3, -h * 0.18, 0, -h * 0.34);
    g.fill();
    g.filter = "none";
    g.strokeStyle = "rgba(120,84,62,.28)";
    g.lineWidth = Math.max(1, size * 0.016);
    g.beginPath();
    g.moveTo(0, -h * 0.26);
    g.lineTo(0, h * 0.26);
    g.stroke();
    return tex(c);
  }

  function dotTexture(size, color) {
    var c = cv(size), g = c.getContext("2d");
    g.filter = "blur(" + (size * 0.09).toFixed(1) + "px)";
    g.fillStyle = color;
    g.beginPath();
    g.arc(size / 2, size / 2, size * 0.24, 0, Math.PI * 2);
    g.fill();
    return tex(c);
  }

  function ringTexture(size) {
    var c = cv(size), g = c.getContext("2d");
    g.filter = "blur(" + (size * 0.02).toFixed(1) + "px)";
    g.strokeStyle = "rgba(120,110,90,.55)";
    g.lineWidth = size * 0.052;
    g.beginPath();
    g.arc(size / 2, size / 2, size * 0.36, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = "rgba(181,67,58,.42)";
    g.lineWidth = size * 0.022;
    g.beginPath();
    g.arc(size / 2, size / 2, size * 0.44, 0, Math.PI * 2);
    g.stroke();
    return tex(c);
  }

  /* ---------------- 精灵 ---------------- */
  function sprite(texture, o) {
    var mat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: o.opacity,
      depthTest: false,
      depthWrite: false,
    });
    if (o.additive) mat.blending = THREE.AdditiveBlending;
    var s = new THREE.Sprite(mat);
    s.position.set(o.x, o.y, o.z);
    s.scale.set(o.w, o.h, 1);
    s.material.rotation = o.rot || 0;
    scene.add(s);
    return s;
  }

  function rnd(a, b) { return a + Math.random() * (b - a); }

  function build() {
    var n = quality;
    var i, s;
    var light = mode === "petals";   // 「花瓣」模式：只要落英与微光，不要云雾

    if (!light) {
      /* 远山雾霭 */
      var mistT = [mistTexture(256), mistTexture(256), mistTexture(256)];
      var mistN = Math.round(9 * n);
      for (i = 0; i < mistN; i++) {
        var mw = rnd(420, 900), mh = mw * rnd(0.3, 0.5);
        s = sprite(mistT[i % mistT.length], {
          x: rnd(-halfW * 1.2, halfW * 1.2), y: rnd(-halfH * 0.8, halfH * 0.8),
          z: rnd(-520, -300), w: mw, h: mh, opacity: rnd(0.16, 0.34), rot: rnd(-0.06, 0.06),
        });
        items.push({ sprite: s, kind: "mist", v: rnd(3, 9), ph: rnd(0, 6.28) });
      }

      /* 流云 */
      var cloudT = [cloudTexture(256), cloudTexture(256), cloudTexture(256)];
      var cloudN = Math.round(7 * n);
      for (i = 0; i < cloudN; i++) {
        var cw = rnd(260, 620), ch = cw * rnd(0.26, 0.4);
        s = sprite(cloudT[i % cloudT.length], {
          x: rnd(-halfW * 1.2, halfW * 1.2), y: rnd(-halfH * 0.7, halfH * 0.85),
          z: rnd(-260, -90), w: cw, h: ch, opacity: rnd(0.2, 0.42),
        });
        items.push({ sprite: s, kind: "cloud", v: rnd(8, 20), ph: rnd(0, 6.28) });
      }
    }

    /* 落英：**降低存在感，但不删**。
       用户反馈花瓣与地名、标记在色彩和位置上互相干扰——
       原来 46 片、透明度 0.5–0.9，压在密集标记区上确实吵。
       现在数量降到 30、透明度降到 0.32–0.6，颜色也往纸色靠一档
       （原来那组偏粉，等于色板之外多出第 4 个色相）。
       保留是因为它是这张「活的画卷」里唯一持续在动的东西——
       全删掉，页面会从「活的」变成「静的」。 */
    var petalCols = ["#dfbdb0", "#d6a898", "#e3cbb0", "#cf9f92", "#e8d8c2"];
    var petalT = petalCols.map(function (col) { return petalTexture(64, col); });
    var petalN = Math.round((light ? 30 : 24) * n);
    for (i = 0; i < petalN; i++) {
      var pw = rnd(light ? 8 : 9, light ? 17 : 20);
      s = sprite(petalT[i % petalT.length], {
        x: rnd(-halfW, halfW), y: rnd(-halfH, halfH * 1.2),
        z: rnd(-40, 150), w: pw, h: pw, opacity: rnd(0.32, 0.6), rot: rnd(0, 6.28),
      });
      items.push({
        sprite: s, kind: "petal", vy: rnd(14, 34), sway: rnd(10, 30),
        ph: rnd(0, 6.28), spin: rnd(-0.6, 0.6),
      });
    }

    if (!light) {
      /* 墨点 */
      var inkT = dotTexture(64, "rgba(58,53,44,.5)");
      var inkN = Math.round(12 * n);
      for (i = 0; i < inkN; i++) {
        var iw = rnd(5, 13);
        s = sprite(inkT, {
          x: rnd(-halfW, halfW), y: rnd(-halfH, halfH),
          z: rnd(-60, 120), w: iw, h: iw, opacity: rnd(0.16, 0.4),
        });
        items.push({ sprite: s, kind: "ink", v: rnd(4, 12), ph: rnd(0, 6.28) });
      }
    }

    /* 光尘 */
    var moteT = dotTexture(64, "rgba(255,236,190,.9)");
    var moteN = Math.round((light ? 10 : 16) * n);
    for (i = 0; i < moteN; i++) {
      var dw = rnd(4, 11);
      s = sprite(moteT, {
        x: rnd(-halfW, halfW), y: rnd(-halfH, halfH),
        z: rnd(40, 200), w: dw, h: dw, opacity: rnd(0.2, 0.5), additive: true,
      });
      items.push({ sprite: s, kind: "mote", v: rnd(3, 9), ph: rnd(0, 6.28) });
    }
  }

  /* ---------------- 尺寸 ---------------- */
  function fit() {
    if (!renderer || !camera) return;
    var w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    var vh = 2 * Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
    halfH = vh / 2;
    halfW = (vh * camera.aspect) / 2;
  }

  /* ---------------- 主循环 ---------------- */
  /* 限帧：云气是「慢动作」，30fps 与 144fps 肉眼分不出，
     但高刷屏上按刷新率重绘＝每秒白白重绘整屏 120~144 次。
     这是长时间挂机发烫、拖动时掉帧的主因，故按时长闸门限帧。 */
  var FPS_CAP = 30, minStep = 1000 / FPS_CAP, lastAt = 0;

  function tick(now) {
    if (!running) return;
    raf = requestAnimationFrame(tick);
    if (now - lastAt < minStep - 1) return;
    lastAt = now;

    var dt = Math.min(clock.getDelta(), 0.05);
    var t = clock.elapsedTime;
    var i, it, s;

    for (i = 0; i < items.length; i++) {
      it = items[i];
      s = it.sprite;
      var pad;
      switch (it.kind) {
        case "mist":
          s.position.x += it.v * dt;
          s.position.y += Math.sin(t * 0.12 + it.ph) * 2.2 * dt;
          pad = s.scale.x * 0.6;
          if (s.position.x - pad > halfW) s.position.x = -halfW - pad;
          break;
        case "cloud":
          s.position.x += it.v * dt;
          s.position.y += Math.sin(t * 0.2 + it.ph) * 4 * dt;
          pad = s.scale.x * 0.6;
          if (s.position.x - pad > halfW) s.position.x = -halfW - pad;
          break;
        case "petal":
          s.position.y -= it.vy * dt;
          s.position.x += Math.sin(t * 0.5 + it.ph) * it.sway * dt;
          s.material.rotation += it.spin * dt;
          if (s.position.y < -halfH - 40) {
            s.position.y = halfH + 40;
            s.position.x = rnd(-halfW, halfW);
          }
          break;
        case "ink":
          s.position.y += it.v * dt;
          s.position.x += Math.cos(t * 0.3 + it.ph) * 3 * dt;
          if (s.position.y - 30 > halfH) s.position.y = -halfH;
          break;
        case "mote":
          s.position.y += it.v * dt;
          s.position.x += Math.sin(t * 0.35 + it.ph) * 5 * dt;
          s.material.opacity = 0.18 + 0.3 * (0.5 + 0.5 * Math.sin(t * 0.8 + it.ph));
          if (s.position.y - 20 > halfH) s.position.y = -halfH;
          break;
      }
    }

    /* 墨晕 */
    for (i = pulses.length - 1; i >= 0; i--) {
      var p = pulses[i];
      p.t += dt;
      var k = p.t / p.dur;
      if (k >= 1) {
        scene.remove(p.sprite);
        p.sprite.material.dispose();
        pulses.splice(i, 1);
        continue;
      }
      var e = 1 - Math.pow(1 - k, 3);
      var sc = p.from + (p.to - p.from) * e;
      p.sprite.scale.set(sc, sc, 1);
      p.sprite.material.opacity = p.opacity * (1 - e);
    }

    /* 相机：鼠标视差 + 地图位移视差 */
    camWant.x = -(pointer.x * 30 + shift.x);
    camWant.y = pointer.y * 20 + shift.y;
    cameraAt.x += (camWant.x - cameraAt.x) * 0.05;
    cameraAt.y += (camWant.y - cameraAt.y) * 0.05;
    camera.position.x = cameraAt.x;
    camera.position.y = cameraAt.y;

    renderer.render(scene, camera);
  }

  function start() {
    if (!api.ok || running || document.hidden) return;
    running = true;
    lastAt = 0;
    clock.getDelta();
    raf = requestAnimationFrame(tick);
  }
  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  /* ---------------- 对外接口 ---------------- */
  api.mount = function (options) {
    options = options || {};
    if (typeof THREE === "undefined") { api.reason = "no-three"; return api; }
    reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    quality = reduce ? 0.5 : options.quality || 1;
    if (options.quality === undefined && window.innerWidth < 760) quality = reduce ? 0.4 : 0.55;
    mode = options.mode || "full";   // "petals"：只要落英与微光

    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: "low-power" });
    } catch (err) {
      api.reason = "no-webgl";
      renderer = null;
      return api;
    }
    if (!renderer || !renderer.getContext()) { api.reason = "no-context"; renderer = null; return api; }

    canvas = renderer.domElement;
    canvas.className = "atmosphere-canvas";
    renderer.setClearAlpha(0);
    /* 全屏透明画布，像素比 1.6 → 1.25：填充率省 ~40%，云气这种虚化层看不出差别 */
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    (options.layer || document.body).appendChild(canvas);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 4000);
    camera.position.z = 620;
    clock = new THREE.Clock();

    fit();
    build();
    api.ok = true;
    api.enabled = false;

    window.addEventListener("resize", fit);
    window.addEventListener("pointermove", onPointer, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    if (reduce) { renderer.render(scene, camera); }   // 静态一帧

    return api;
  };

  function onPointer(e) {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
  }
  function onVisibility() {
    if (!api.enabled) return;
    if (document.hidden) stop();
    else start();
  }

  api.setEnabled = function (on) {
    api.enabled = !!on;
    if (!api.ok) return api;
    canvas.style.display = on ? "" : "none";
    if (on && !reduce) start();
    else stop();
    return api;
  };

  /* 地图平移时给一点空间位移，云气会「跟不上」而显出层次 */
  api.setMapShift = function (nx, ny) {
    shift.x = Math.max(-120, Math.min(120, nx * 120));
    shift.y = Math.max(-70, Math.min(70, ny * 70));
  };

  /* 在归一化屏幕坐标处散开一圈墨晕 */
  api.pulse = function (nx, ny, size) {
    if (!api.ok || !api.enabled) return;
    var vh = 2 * Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
    var vw = vh * camera.aspect;
    var x = (nx * vw) / 2 - cameraAt.x;
    var y = (ny * vh) / 2 - cameraAt.y;
    var t = ringTexture(256);
    var s = sprite(t, { x: x, y: y, z: 60, w: size || 90, h: size || 90, opacity: 0.85 });
    pulses.push({ sprite: s, t: 0, dur: 1.1, from: 0.25, to: 2.6, opacity: 0.8 });
  };

  api.destroy = function () {
    stop();
    window.removeEventListener("resize", fit);
    window.removeEventListener("pointermove", onPointer);
    document.removeEventListener("visibilitychange", onVisibility);
    items.forEach(function (it) {
      scene.remove(it.sprite);
      if (it.sprite.material.map) it.sprite.material.map.dispose();
      it.sprite.material.dispose();
    });
    items = [];
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    api.ok = false;
  };

  /* 按比例抽稀：弱机降载用，不重建场景，只切 visible */
  api.setDensity = function (frac) {
    frac = Math.max(0.1, Math.min(1, Number(frac) || 1));
    var step = 1 / frac;
    var shown = 0;
    items.forEach(function (it, i) {
      it.sprite.visible = (i % step) < 1;
      if (it.sprite.visible) shown++;
    });
    density = frac;
    return api;
  };

  api.setFps = function (fps) {
    FPS_CAP = Math.max(10, Math.min(120, Number(fps) || 30));
    minStep = 1000 / FPS_CAP;
    return api;
  };

  api.stats = function () {
    return {
      ok: api.ok, enabled: api.enabled, running: running,
      sprites: items.filter(function (it) { return it.sprite.visible; }).length + pulses.length,
      total: items.length, density: density, fpsCap: FPS_CAP, quality: quality, reason: api.reason,
    };
  };

  return api;
})();

export default ATMOSPHERE;
