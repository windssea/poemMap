// 极简静态服务器：本地预览 **构建产物** dist/
// 用途：不想装 vite 依赖、或想确认产物体积/路径时，起一个零依赖的服务。
// 开发请用 `npm run dev`（带 HMR），预览请用 `npm run preview`。
const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "dist");
const port = 5179;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
};

if (!fs.existsSync(path.join(root, "index.html"))) {
  console.error("没找到 dist/index.html —— 先跑 `npm run build` 再起这个服务。");
  process.exit(1);
}

const server = http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split("?")[0]);
  if (rel === "/") rel = "/index.html";
  const file = path.join(root, path.normalize(rel).replace(/^(\.\.[/\\])+/, ""));
  fs.readFile(file, (err, data) => {
    if (err) {
      res.statusCode = 404;
      res.end("404");
      return;
    }
    res.setHeader("Content-Type", TYPES[path.extname(file).toLowerCase()] || "application/octet-stream");
    res.end(data);
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`serving dist/ -> http://127.0.0.1:${port}/`);
});
