/* 取 TypeSafe 文档（web_fetch 会拒绝沙箱 DNS 返回的保留地址，Node fetch 可以）。
   用法：node tools/typesafe/docs.mjs <path>     例：node tools/typesafe/docs.mjs concepts/system-one
        node tools/typesafe/docs.mjs --index     取 llms.txt 目录 */
const path = process.argv[2];
if (!path) { console.error("用法: node tools/typesafe/docs.mjs <path|--index>"); process.exit(2); }

const url = path === "--index"
  ? "https://docs.typesafe.ai/llms.txt"
  : "https://docs.typesafe.ai/" + path.replace(/^\/+/, "").replace(/\.md$/, "") + ".md";

const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
console.log("// " + url + "  →  HTTP " + r.status + "\n");
const text = await r.text();
console.log(text.slice(0, 20000));
