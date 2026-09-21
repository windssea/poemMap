/* ============================================================
   入口
   ----------------------------------------------------------
   React 挂载在 #root。地图、云气、动效三件「引擎」都是命令式
   模块，由组件在挂载时启动，不进 React 的 diff。

   这里**不用 StrictMode**：Leaflet 地图实例与 WebGL 渲染器都是
   「只能初始化一次」的资源，StrictMode 在开发环境下会双跑 effect，
   轻则重复挂一个 canvas，重则两个地图实例抢同一个容器。
   ============================================================ */
import { createRoot } from "react-dom/client";

import "leaflet/dist/leaflet.css";
import "./styles/style.css";

import App from "./App.jsx";

createRoot(document.getElementById("root")).render(<App />);

/* ============================================================
   注册 Service Worker（本地缓存）
   ----------------------------------------------------------
   作用有两个，第二个比第一个重要：
     · 二次打开不再重新下载与解析资源（cache-first）
     · **断网也能打开** —— 这本来就是「全离线」该有的能力，
       在此之前它只是「不需要后端」，断网照样白屏

   只在生产构建里注册：开发环境走 vite dev，模块是即时编译的，
   SW 的 cache-first 会把源码缓存住，改一行看不到效果，很难查。
   （这也是为什么判断条件用 import.meta.env.PROD 而不是端口号。）
   ============================================================ */
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("/sw.js").catch(function (err) {
      /* 注册失败不该影响应用本身：它只是「更快 / 断网可用」，
         不是功能。所以只记一条日志，不抛、不提示。 */
      console.warn("Service Worker 注册失败（不影响使用）：", err);
    });
  });
}
