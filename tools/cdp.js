/**
 * 极简 CDP 驱动（工具，非站点依赖）
 * ----------------------------------------------------------
 * 直接用 Chrome 的 DevTools 协议做无头验证：导航、取数、截图、量帧率。
 * 不再依赖外部浏览器代理，任何环境都能跑。
 *
 * 用法：
 *   node tools/cdp.js <url> <输出png> [等待毫秒]
 *   node tools/cdp.js <url> --eval "<js 表达式>"      // 只取数，不截图
 *
 * 例：
 *   node tools/cdp.js http://127.0.0.1:5179/ shot.png 3500
 *   node tools/cdp.js http://127.0.0.1:5179/ --eval "1+1"
 */
const { spawn, execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const CHROME = process.env.CHROME_PATH ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = Number(process.env.CDP_PORT || 9333);

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function getWsUrl() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await r.json();
      const page = list.find((t) => t.type === "page");
      if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch (e) { /* 还没起来 */ }
    await sleep(250);
  }
  throw new Error("CDP 未就绪");
}

function makeClient(ws) {
  let id = 0;
  const pending = new Map();
  const events = [];
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    } else if (msg.method) {
      events.push(msg);
    }
  });
  return {
    events,
    send(method, params) {
      const mid = ++id;
      return new Promise((resolve, reject) => {
        pending.set(mid, { resolve, reject });
        ws.send(JSON.stringify({ id: mid, method, params: params || {} }));
        setTimeout(() => {
          if (pending.has(mid)) { pending.delete(mid); reject(new Error("超时: " + method)); }
        }, 40000);
      });
    },
  };
}

async function main() {
  const url = process.argv[2];
  const mode = process.argv[3];
  const isEval = mode === "--eval";
  // --eval 后可给表达式，或给 @文件路径 以载入较长的脚本
  const expr = isEval
    ? (process.argv[4] && process.argv[4].startsWith("@")
        ? fs.readFileSync(process.argv[4].slice(1), "utf8")
        : process.argv[4])
    : null;
  const waitMs = Number((isEval ? process.argv[5] : process.argv[4]) || 3000) || 3000;
  const outPng = isEval ? null : mode;
  if (!url) { console.error("用法: node tools/cdp.js <url> <png|--eval> [waitMs]"); process.exit(2); }

  /* CDP_PROFILE=<目录>：用固定的用户目录，而不是每次新建临时目录。
     测 Service Worker 必须这样——SW 与 Cache Storage 都存在用户目录里，
     每次换目录等于每次都从零开始，永远验不到「二次访问」。
     ⚠️ 用完要自己删，它会留缓存文件。 */
  const profile = process.env.CDP_PROFILE
    ? (fs.mkdirSync(process.env.CDP_PROFILE, { recursive: true }), process.env.CDP_PROFILE)
    : fs.mkdtempSync(path.join(os.tmpdir(), "cdp-profile-"));
  const chrome = spawn(CHROME, [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    "--no-first-run", "--no-default-browser-check",
    "--disable-extensions", "--disable-background-networking",
    "--window-size=1440,900",
    "--enable-unsafe-swiftshader",
    // 无头默认隐藏滚动条（截图干净）。要量「滚动条占位」时用 CDP_SCROLLBARS=1。
    ...(process.env.CDP_SCROLLBARS ? [] : ["--hide-scrollbars"]),
    "about:blank",
  ], { stdio: "ignore" });

  const cleanup = () => {
    try { chrome.kill(); } catch (e) {}
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
  };

  try {
    const wsUrl = await getWsUrl();
    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => {
      ws.addEventListener("open", res);
      ws.addEventListener("error", rej);
    });
    const cdp = makeClient(ws);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Log.enable");
    await cdp.send("Network.enable");
    /* CDP_OFFLINE=1：断网。用来验「Service Worker 的缓存真的能顶住断网」——
       这是「本地缓存」里最该被证明的一条，光看缓存里有东西不算数。 */
    if (process.env.CDP_OFFLINE) {
      await cdp.send("Network.emulateNetworkConditions", {
        offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0,
      });
    }

    // 可用环境变量模拟无障碍与移动端
    if (process.env.CDP_REDUCED) {
      await cdp.send("Emulation.setEmulatedMedia", {
        features: [{ name: "prefers-reduced-motion", value: "reduce" }],
      });
    }
    if (process.env.CDP_MOBILE) {
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: 390, height: 844, deviceScaleFactor: 2, mobile: true,
      });
    }
    /* CDP_VIEWPORT=980x860 或 980x860@3：任意视口尺寸，可选设备像素比。
       只有 390 与全屏两档是量不出「顶栏在两行之间错位」这类问题的——
       那个 bug 只在中间的某个宽度区间出现。
       @N 主要用来**判断小字渲染质量**：12px 的字在 1× 截图里根本看不清
       有没有发虚，3× 才能看出光晕和亚像素的差别。 */
    if (process.env.CDP_VIEWPORT) {
      const m = /^(\d+)x(\d+)(?:@([\d.]+))?$/.exec(process.env.CDP_VIEWPORT.trim());
      if (m) {
        await cdp.send("Emulation.setDeviceMetricsOverride", {
          width: Number(m[1]), height: Number(m[2]),
          deviceScaleFactor: m[3] ? Number(m[3]) : 1, mobile: false,
        });
      } else {
        console.warn("CDP_VIEWPORT 格式应为 宽x高 或 宽x高@倍率，例如 980x860@2；已忽略：" + process.env.CDP_VIEWPORT);
      }
    }

    // CDP_INJECT=<文件>：在每个新文档的最前面注入脚本——量「首帧起」的布局时序
    // （React 提交与动画的中间态只有从第 0 帧开始采样才看得到）。
    if (process.env.CDP_INJECT) {
      await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
        source: fs.readFileSync(process.env.CDP_INJECT, "utf8"),
      });
    }

    await cdp.send("Page.navigate", { url });

    // 等 load 事件，或等到超时
    const t0 = Date.now();
    while (Date.now() - t0 < waitMs) {
      if (cdp.events.some((e) => e.method === "Page.loadEventFired")) break;
      await sleep(120);
    }
    await sleep(Math.min(2500, waitMs));   // 让脚本与动画跑起来

    if (process.env.CDP_VERBOSE) {
      const reqs = cdp.events
        .filter((e) => e.method === "Network.requestWillBeSent")
        .map((e) => e.params.request.url.replace("http://127.0.0.1:5179/", ""));
      const failed = cdp.events
        .filter((e) => e.method === "Network.loadingFailed")
        .map((e) => e.params.errorText);
      console.error("REQUESTS(" + reqs.length + "): " + JSON.stringify(reqs));
      if (failed.length) console.error("FAILED: " + JSON.stringify(failed));
      const loaded = cdp.events.some((e) => e.method === "Page.loadEventFired");
      console.error("LOAD_EVENT: " + loaded);
    }

    // 取数或截图之前，可先跑一段准备脚本（例如先打开某首诗、先点开注释）
    // CDP_SETUP 支持逗号分隔的多个文件，按顺序执行——React 的渲染是异步的，
    // 「点地标 → 等一帧 → 浮层里挑一首」这类多步操作这样写才准。
    // CDP_STEP_ARG 按同样的顺序给每步传参；文件名以 _ 开头的（公共工具）不占位。
    if (process.env.CDP_SETUP) {
      const files = process.env.CDP_SETUP.split(",").map((s) => s.trim()).filter(Boolean);
      const args = String(process.env.CDP_STEP_ARG || "").split(",");
      let slot = 0;
      for (const f of files) {
        const takesArg = !path.basename(f).startsWith("_");
        const arg = takesArg ? (args[slot++] || "") : "";
        const setup = "window.__stepArg = " + JSON.stringify(arg) + ";\n" +
          fs.readFileSync(f, "utf8");
        const r = await cdp.send("Runtime.evaluate", {
          expression: setup, returnByValue: true, awaitPromise: true,
        });
        if (process.env.CDP_VERBOSE) {
          const v = r.result && r.result.value;
          if (v !== undefined) console.error("SETUP " + f + " -> " + JSON.stringify(v));
        }
        await sleep(Number(process.env.CDP_SETUP_WAIT || 400));
      }
    }

    // CDP_FONTS=<css选择器>：查某个元素**实际**用的是哪个字体。
    // JS 没有标准 API 能拿到「已使用的字体」——document.fonts 只列已加载的
    // webfont，而 canvas 量宽度对中文字体没用（汉字都是全角，宽度一样，
    // 实测十个候选字体量出来全是 91px）。只有 CDP 的
    // CSS.getPlatformFontsForNode 能给权威答案。
    if (process.env.CDP_FONTS) {
      const sel = process.env.CDP_FONTS;
      await cdp.send("DOM.enable");
      await cdp.send("CSS.enable");
      const doc = await cdp.send("DOM.getDocument", { depth: 0 });
      const found = await cdp.send("DOM.querySelectorAll", { nodeId: doc.root.nodeId, selector: sel });
      const rows = [];
      for (const nid of (found.nodeIds || []).slice(0, 8)) {
        const r = await cdp.send("CSS.getPlatformFontsForNode", { nodeId: nid });
        const el = await cdp.send("DOM.describeNode", { nodeId: nid });
        const a = el.node.attributes || [];
        let cls = "", txt = el.node.nodeValue || "";
        for (let i = 0; i < a.length; i += 2) if (a[i] === "class") cls = "." + a[i + 1].split(" ")[0];
        rows.push({
          node: (el.node.localName || "") + cls,
          fonts: (r.fonts || []).map((f) => f.familyName + " ×" + f.glyphCount + " 字形"),
        });
      }
      console.log(JSON.stringify({ selector: sel, matched: (found.nodeIds || []).length, rows }, null, 2));
      await cdp.send("Browser.close").catch(() => {});
      return;
    }

    // CDP_TRACE=1：给 --eval 的那段脚本套一层性能跟踪，回报光栅 / 合成 / 布局耗时
    if (isEval && process.env.CDP_TRACE) {
      await cdp.send("Tracing.start", {
        categories: "devtools.timeline,cc,benchmark",
        transferMode: "ReportEvents",
      });
    }

    if (isEval) {
      const r = await cdp.send("Runtime.evaluate", {
        expression: expr, returnByValue: true, awaitPromise: true,
      });
      console.log(JSON.stringify(r.result && r.result.value !== undefined ? r.result.value : r, null, 2));
    } else {
      /* CDP_CLIP=x,y,w,h：只截一块。
         判断小字渲染质量必须用裁剪——整屏 1424px 的图里，12px 的字
         在预览里被缩得看不清，而放大 DPR 又会让字变清楚（等于测了个假的）。
         只有「1× 渲染 + 按原像素裁剪」才是用户真正看到的那些像素。 */
      const clipOpt = {};
      if (process.env.CDP_CLIP) {
        const c = process.env.CDP_CLIP.split(",").map(Number);
        if (c.length === 4 && c.every((n) => !isNaN(n))) {
          clipOpt.clip = { x: c[0], y: c[1], width: c[2], height: c[3], scale: 1 };
        } else {
          console.warn("CDP_CLIP 格式应为 x,y,w,h；已忽略：" + process.env.CDP_CLIP);
        }
      }
      const shot = await cdp.send("Page.captureScreenshot", Object.assign({ format: "png" }, clipOpt));
      const bufA = Buffer.from(shot.data, "base64");
      fs.writeFileSync(outPng, bufA);
      console.log("screenshot -> " + outPng + " (" + fs.statSync(outPng).size + " bytes)");

      // 再拍一张，用于确认画面确实在动（云气/落英/摆动）
      if (process.env.CDP_SHOT2) {
        await sleep(Number(process.env.CDP_SHOT2));
        const shot2 = await cdp.send("Page.captureScreenshot", { format: "png" });
        const bufB = Buffer.from(shot2.data, "base64");
        const same = bufA.equals(bufB);
        const out2 = outPng.replace(/\.png$/, "-b.png");
        fs.writeFileSync(out2, bufB);
        console.log("ANIMATING: " + (!same) + " (second frame -> " + out2 + ")");
      }
    }

    if (isEval && process.env.CDP_TRACE) {
      await cdp.send("Tracing.end");
      const t0 = Date.now();
      while (Date.now() - t0 < 6000 && !cdp.events.some((e) => e.method === "Tracing.tracingComplete")) {
        await sleep(150);
      }
      const tev = [];
      cdp.events.forEach((e) => {
        if (e.method === "Tracing.dataCollected" && Array.isArray(e.params.value)) {
          e.params.value.forEach((v) => { if (v.ph === "X" && v.dur) tev.push(v); });
        }
      });
      const byName = new Map();
      tev.forEach((v) => {
        const cur = byName.get(v.name) || { n: 0, ms: 0 };
        cur.n++; cur.ms += v.dur / 1000;
        byName.set(v.name, cur);
      });
      const rows = [...byName.entries()]
        .map(([name, o]) => ({ name, n: o.n, ms: +o.ms.toFixed(1) }))
        .sort((a, b) => b.ms - a.ms);
      const pick = (re) => +rows.filter((r) => re.test(r.name)).reduce((s, r) => s + r.ms, 0).toFixed(1);
      console.error("TRACE events=" + tev.length + " threads/names=" + rows.length);
      console.error("TRACE buckets(ms): raster=" + pick(/Raster|TileManager|ImageDecode/i) +
        " paint=" + pick(/^Paint$|PaintArtifact|PrePaint/i) +
        " composite=" + pick(/Composite|Commit|LayerTree|UpdateLayer/i) +
        " layout=" + pick(/Layout|RecalcStyle/i) +
        " script=" + pick(/Script|Function|Timer|EventDispatch/i));
      console.error("TRACE top12: " + JSON.stringify(rows.slice(0, 12)));
    }

    // 顺带回报控制台错误
    const errs = cdp.events
      .filter((e) => e.method === "Runtime.exceptionThrown" || e.method === "Log.entryAdded")
      .map((e) => e.method === "Runtime.exceptionThrown"
        ? e.params.exceptionDetails.text + " " + (e.params.exceptionDetails.exception || {}).description
        : e.params.entry.text)
      .slice(0, 10);
    if (errs.length) console.error("PAGE ERRORS: " + JSON.stringify(errs, null, 2));
    ws.close();
  } finally {
    cleanup();
  }
}

main().catch((e) => { console.error("FAIL: " + e.message); process.exit(1); });
