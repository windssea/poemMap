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
