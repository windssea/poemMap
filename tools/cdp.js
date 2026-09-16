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

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "cdp-profile-"));
  const chrome = spawn(CHROME, [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    "--no-first-run", "--no-default-browser-check",
    "--disable-extensions", "--disable-background-networking",
    "--window-size=1440,900",
    "--enable-unsafe-swiftshader",
    "--hide-scrollbars",
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
    if (process.env.CDP_SETUP) {
      const setup = fs.readFileSync(process.env.CDP_SETUP, "utf8");
      await cdp.send("Runtime.evaluate", {
        expression: setup, returnByValue: true, awaitPromise: true,
      });
      await sleep(Number(process.env.CDP_SETUP_WAIT || 400));
    }

    if (isEval) {
      const r = await cdp.send("Runtime.evaluate", {
        expression: expr, returnByValue: true, awaitPromise: true,
      });
      console.log(JSON.stringify(r.result && r.result.value !== undefined ? r.result.value : r, null, 2));
    } else {
      const shot = await cdp.send("Page.captureScreenshot", { format: "png" });
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
