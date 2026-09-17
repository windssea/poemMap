/* ============================================================
   生产构建（一行命令搞定，输出原样透传）
   ----------------------------------------------------------
   为什么不直接 `npm run build`：
   在这台机器的 shell 里，长命令行经管壳转发时偶发被截断（SIGTERM），
   而 `node tools/build.js` 短且稳定。输出与退出码都原样带回。
   ============================================================ */
const { spawnSync } = require("child_process");
const path = require("path");

const root = path.resolve(__dirname, "..");
const r = spawnSync(
  process.execPath,
  [path.join(root, "node_modules", "vite", "bin", "vite.js"), "build"],
  { cwd: root, stdio: "inherit" }
);
if (r.error) {
  console.error("构建启动失败: " + r.error.message);
  process.exit(1);
}
process.exit(r.status === null ? 1 : r.status);
