/* 复现/回归：抽屉开着时点地图空白，中间那一帧卡片会不会「闪现」。
   ----------------------------------------------------------
   为什么要单独写一个：tools/steps/_pre.js 的 __press() 把 pointerdown / mouseup /
   click 在**同一个任务**里同步发完，React 会批处理成一次提交，中间没有绘制帧，
   所以永远测不出「先关抽屉（卡片短暂复活）再关卡片」这个中间态。
   真实用户按下与抬起之间隔着几十毫秒，浏览器会画一帧——把两段拆到不同帧才对得上。

   判定：从 pointerdown 开始逐帧采样 #card 的 .on 与 #detail 的 .on。
   修复正确 → card 任何一帧都不为 true；修复前 → 会看到 card 为 true 的帧。

   用法（前置需已开卡 + 开抽屉）：
     CDP_SETUP=tools/steps/_pre.js,tools/steps/place.js,tools/steps/pick.js,tools/steps/detail.js \
       CDP_STEP_ARG='长安,|last,' \
       node tools/cdp.js <url> --eval @tools/probes/dismiss-flash.js [waitMs] */
new Promise(function (resolve) {
  var q = function (s) { return document.querySelector(s); };
  function on(sel) { var e = q(sel); return !!(e && e.classList.contains("on")); }

  var before = { card: on("#card"), detail: on("#detail"), list: on("#poemList") };
  var samples = [];
  var sampling = true;

  /* 逐帧采样，记录每一帧两个面板的状态 */
  (function sample() {
    if (!sampling) return;
    samples.push({ card: on("#card"), detail: on("#detail") });
    requestAnimationFrame(sample);
  })();

  var map = q("#map");
  if (!map) { resolve(JSON.stringify({ error: "no-map" })); return; }
  var r = map.getBoundingClientRect();
  var x = Math.round(r.left + r.width * 0.18);
  var y = Math.round(r.top + r.height * 0.78);
  var opt = { bubbles: true, cancelable: true, clientX: x, clientY: y, view: window };

  /* —— 阶段 1：pointerdown（真实交互里这一步比 click 早几十毫秒）—— */
  try { map.dispatchEvent(new PointerEvent("pointerdown", opt)); }
  catch (e) { map.dispatchEvent(new MouseEvent("mousedown", opt)); }

  /* 放几帧过去，让 React 提交 + 浏览器绘制 —— 闪现就发生在这个窗口里 */
  var frames = 0;
  function waitFrames(n, then) {
    if (frames++ < n) requestAnimationFrame(function () { waitFrames(n, then); });
    else then();
  }
  waitFrames(4, function () {
    var afterDown = samples.slice();
    /* —— 阶段 2：抬起 + click（Leaflet 的 map.on("click") 在这里才触发）—— */
    map.dispatchEvent(new MouseEvent("mouseup", opt));
    map.dispatchEvent(new MouseEvent("click", opt));

    waitFrames(10, function () {
      sampling = false;
      var flashed = afterDown.filter(function (s) { return s.card; }).length;
      resolve(JSON.stringify({
        at: x + "," + y,
        before: before,
        after: { card: on("#card"), detail: on("#detail"), list: on("#poemList") },
        framesSampled: samples.length,
        framesUntilClick: afterDown.length,
        /* 关键指标 */
        cardFlashedFrames: flashed,
        cardFlashDetected: flashed > 0,
        /* 顺带看抽屉有没有在 pointerdown 那一帧就消失（应为 true） */
        detailClosedOnDown: afterDown.length > 0 && !afterDown[afterDown.length - 1].detail,
        timeline: samples.map(function (s, i) {
          return i + ":" + (s.card ? "C" : "-") + (s.detail ? "D" : "-");
        }).join(" "),
      }));
    });
  });
})
