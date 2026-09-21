/* ============================================================
   TypeSafe / Jev 极薄客户端
   ----------------------------------------------------------
   只做一件事：把 state + questions 发到 POST /v1/systemone，
   把 answers 原样取回来。业务判断不写在这里。

   契约来自 https://docs.typesafe.ai/api （已核对）：
     POST https://api.typesafe.ai/v1/systemone
     Authorization: Bearer <API_KEY>
     { state, model: "jev-latest", questions: { <id>: Question } }
   → { model, answers: { <id>: Answer }, usage: { input_tokens, output_tokens } }

   Answer 形状：
     noul   → { type:"noul",   noul: 0..1 }
     choice → { type:"choice", choice:"<opt>", probabilities:{...}, confidence:0..1 }
     score  → { type:"score",  score: <加权值>, legend:{...}, probabilities:{...}, confidence:0..1 }

   key 解析顺序：TYPESAFE_API_KEY → .env → .env.local → .typesafe-key
   ============================================================ */
import { readFile } from "node:fs/promises";

export const API = process.env.TYPESAFE_BASE_URL || "https://api.typesafe.ai";
export const MODEL = process.env.TYPESAFE_MODEL || "jev-latest";

let cached = null;

export async function resolveKey() {
  if (cached) return cached;
  const env = process.env.TYPESAFE_API_KEY?.trim();
  if (env) return (cached = { key: env, from: "env:TYPESAFE_API_KEY" });
  for (const file of [".env", ".env.local", ".typesafe-key"]) {
    let raw;
    try { raw = await readFile(file, "utf8"); } catch { continue; }
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*(?:export\s+)?TYPESAFE_API_KEY\s*[=:]\s*(.+?)\s*$/);
      if (m) return (cached = { key: m[1].replace(/^["']|["']$/g, ""), from: file });
      if (file === ".typesafe-key" && line.trim() && !line.trim().startsWith("#")) {
        return (cached = { key: line.trim(), from: file });
      }
    }
  }
  return null;
}

/** 发一次请求。questions 是 map<string, Question>。 */
export async function ask(state, questions, opts = {}) {
  const resolved = await resolveKey();
  if (!resolved) {
    const e = new Error("NO_KEY");
    e.code = "NO_KEY";
    throw e;
  }
  const body = { state, model: opts.model || MODEL, questions };
  const r = await fetch(API + "/v1/systemone", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + resolved.key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(opts.timeoutMs || 120000),
  });
  const text = await r.text();
  if (!r.ok) {
    const e = new Error("HTTP " + r.status + " " + text.slice(0, 400));
    e.code = "HTTP_" + r.status;
    e.status = r.status;
    throw e;
  }
  let json;
  try { json = JSON.parse(text); }
  catch { throw new Error("响应不是 JSON：" + text.slice(0, 300)); }
  return json;
}

/** 把 answers 里各种 primitive 的取值抽成一个扁平结构，方便下游算分。 */
export function readAnswer(a) {
  if (!a) return { type: "missing" };
  if (a.type === "noul") return { type: "noul", value: a.noul };
  if (a.type === "choice") return { type: "choice", value: a.choice, confidence: a.confidence, probabilities: a.probabilities };
  if (a.type === "score") return { type: "score", value: a.score, confidence: a.confidence, probabilities: a.probabilities, legend: a.legend };
  return { type: a.type || "unknown" };
}
