/* TypeSafe 可达性探测：确认这个环境能不能真的调到 Jev。
   用法：node tools/typesafe/probe.mjs */
import { readFile } from "node:fs/promises";

const BASE = process.env.TYPESAFE_BASE_URL || "https://api.typesafe.ai";

async function resolveKey() {
  const env = process.env.TYPESAFE_API_KEY?.trim();
  if (env) return { key: env, from: "env:TYPESAFE_API_KEY" };
  for (const file of [".env", ".env.local", ".typesafe-key"]) {
    let raw;
    try { raw = await readFile(file, "utf8"); } catch { continue; }
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*(?:export\s+)?TYPESAFE_API_KEY\s*[=:]\s*(.+?)\s*$/);
      if (m) return { key: m[1].replace(/^["']|["']$/g, ""), from: file };
    }
  }
  return null;
}

const resolved = await resolveKey();
console.log("① API key：" + (resolved ? "找到（来源 " + resolved.from + "，长度 " + resolved.key.length + "）" : "**未找到**（env:TYPESAFE_API_KEY / .env / .env.local / .typesafe-key 都没有）"));

console.log("② 目标：" + BASE);
try {
  const r = await fetch(BASE, { method: "GET", signal: AbortSignal.timeout(8000) });
  console.log("   可达，HTTP " + r.status);
} catch (e) {
  console.log("   **不可达**：" + (e.cause?.code || e.name) + " " + (e.cause?.message || e.message));
}

if (resolved) {
  try {
    const r = await fetch(BASE + "/v1/health", {
      headers: { Authorization: "Bearer " + resolved.key },
      signal: AbortSignal.timeout(8000),
    });
    console.log("③ 带 key 请求 /v1/health：HTTP " + r.status);
  } catch (e) {
    console.log("③ 带 key 请求失败：" + (e.cause?.code || e.name) + " " + (e.cause?.message || e.message));
  }
}
