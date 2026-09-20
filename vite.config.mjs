import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/* ============================================================
   中华诗词地图 · 构建配置
   ----------------------------------------------------------
   base: "./"          产出用相对路径，放子目录/任意静态服务都能跑
   assetsDir: "bundle" 打包产物避开 public/assets（那 35 张画稿）
   build.target: es2020 现代浏览器；不做 legacy 兜底（体积换清晰）
   ============================================================ */
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5179,
    strictPort: true,
    /* 原子写文件的编辑器/工具会在 src 下建一个 `.xxx.<pid>.<uuid>.tmpdir/`
       临时目录再 rename。chokidar 跟进去 watch 时，那一瞬目录已被删掉，
       于是整个 dev server 抛 EBUSY 直接退出。把这类临时目录排除掉。 */
    watch: {
      ignored: [
        "**/.*.tmpdir/**",
        "**/*.tmpdir/**",
        "**/.*.tmp",
      ],
    },
  },
  preview: {
    host: "127.0.0.1",
    port: 5179,
    strictPort: true,
  },
  build: {
    target: "es2020",
    assetsDir: "bundle",
    assetsInlineLimit: 0,          // 画稿独立成文件，便于缓存
    cssCodeSplit: false,           // 单张样式表，避免 FOUC
    chunkSizeWarningLimit: 1400,
    rollupOptions: {
      output: {
        /* 地图与三维是两套大依赖，拆开让首屏先拿到 Leaflet。
           Vite 8 走 rolldown，manualChunks 只认函数形式（对象形式会报
           "manualChunks is not a function"） */
        manualChunks(id) {
          if (id.includes("node_modules/three")) return "three";
          if (id.includes("node_modules/leaflet")) return "leaflet";
          return null;
        },
      },
    },
  },
});
