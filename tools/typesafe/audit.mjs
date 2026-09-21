/* ============================================================
   页面优化审计 · 把「简单判断」交给 Jev，把「核实与估工」留给自己
   ----------------------------------------------------------
   分工（这是这次用 TypeSafe 的核心设计）：

     Jev（System One / jev-latest）负责四类**窄判断**，每条候选各问一次：
       · _kind   Choice  这是哪一类问题        ← 分类
       · _impact Score   对使用体验影响多大      ← 简单判断（有序分级）
       · _worth  Noul    值不值得现在动手       ← 筛选
       · _route  Choice  该走哪条处理路径       ← 路由

     核心模型（我）负责：
       · 候选本身的核实（读代码、跑截图、量对比度）—— Jev 读不到仓库
       · 修复成本估算 cost —— 估代码工作量不是文本模型的活
       · 拿到 Jev 的分级后做最终排序与方案设计 —— 组合与取舍是复杂推理

   为什么这样切：Jev 的答案是可复用的**信号**，改权重、改阈值、换排序
   都不用重新推理；而「这条观察是否属实」是事实核验，交给模型只会得到
   一个听起来合理的猜测。

   用法：
     node tools/typesafe/audit.mjs            正常跑
     node tools/typesafe/audit.mjs --dry      只打印将要发出的问题，不调 API
     node tools/typesafe/audit.mjs --chunk=32 分批大小（默认一次全发）
   ============================================================ */
import { APP_CONTEXT, CANDIDATES } from "./candidates.mjs";
import { ask, readAnswer, resolveKey } from "./jev.mjs";

const DRY = process.argv.includes("--dry");
const chunkArg = process.argv.find((a) => a.startsWith("--chunk="));
const CHUNK = chunkArg ? Number(chunkArg.split("=")[1]) : CANDIDATES.length;

/* ---------------- 三类判断的取值定义（集中一处，改口径只改这里） ---------------- */

const KIND = {
  功能缺失: "少了一个用户会期待的能力（例如某处本该能搜索却没有）",
  可用性缺陷: "能力有，但用起来别扭，用户会卡住或反复试错",
  无障碍问题: "某类用户（键盘操作、屏幕阅读器、低视力、触控）无法使用或很难使用",
  性能问题: "影响加载速度或操作流畅度",
  技术债: "不影响任何用户，只影响代码维护",
  审美偏好: "纯粹是好看不好看，不影响任何任务的完成",
  内容问题: "数据、文案或元信息本身有误或不足",
};

const IMPACT_LEVELS = [
  "几乎无感：不改也不影响任何人完成任务",
  "轻微：少数用户偶感不便，不改也能用",
  "明显：一部分用户会卡住或反复试错",
  "严重：主要路径受阻，或明显劝退一类用户",
  "阻断：功能不可用或完全不可达",
];

const ROUTE = {
  直接修: "问题明确、改法明确，按现有代码风格就能做掉",
  先设计再改: "改动会牵动多处（状态、地图、样式联动），需要先出方案",
  先问用户: "涉及产品取舍或内容判断，需要人来拍板",
  不做: "记录在案即可，不值得投入",
};

/* ---------------- 构造问题 ---------------- */
/* 说明：候选全文放进 instructions 而不是只写 state 路径。
   文档支持用反引号引用 `candidates.C01`，但把观察原文直接摆在问题里
   更不容易串味——一条判断只依赖一个问题，出错时也更好定位。
   代价是每条观察重复四次；实测总量仍在 64k 上下文内，输入约 1.8 万 token。 */

function questionsFor(c) {
  const ctx = { area: c.area, observation: c.observation };
  return {
    [c.id + "_kind"]: {
      type: "choice",
      instructions: {
        app: APP_CONTEXT.name + "：" + APP_CONTEXT.what,
        observation: ctx,
        question: "这条观察描述的是哪一类问题？",
      },
      criteria: KIND,
    },
    [c.id + "_impact"]: {
      type: "score",
      instructions: {
        app: APP_CONTEXT.name + "：" + APP_CONTEXT.what,
        audience: APP_CONTEXT.audience,
        observation: ctx,
        question: "这条观察对实际使用体验的影响有多大？",
      },
      criteria: IMPACT_LEVELS,
    },
    [c.id + "_worth"]: {
      type: "noul",
      instructions: {
        app: APP_CONTEXT.name,
        constraints: APP_CONTEXT.constraints,
        already_done: APP_CONTEXT.already_done,
        observation: ctx,
        question: "在现有约束下，这条观察是否值得现在就投入修复，而不是记录待办或不做？",
      },
      criteria: {
        true: "值得现在做：收益明确，且在现有约束下做得成",
        false: "不值得现在做：收益太小、属于口味问题、或时机未到",
      },
    },
    [c.id + "_route"]: {
      type: "choice",
      instructions: {
        app: APP_CONTEXT.name + "：" + APP_CONTEXT.what,
        observation: ctx,
        question: "这条观察应该走哪条处理路径？",
      },
      criteria: ROUTE,
    },
  };
}

const allQuestions = Object.assign({}, ...CANDIDATES.map(questionsFor));

/* ---------------- 跑 ---------------- */
const key = await resolveKey();
if (!key) {
  console.log("✘ 找不到 TypeSafe API key，无法调用 Jev。");
  console.log("  期望来源：TYPESAFE_API_KEY 环境变量 / .env / .env.local / .typesafe-key");
  console.log("");
}

if (DRY || !key) {
  console.log("── 将要发出的问题（" + CANDIDATES.length + " 条候选 × 4 = " + Object.keys(allQuestions).length + " 问）──");
  const sample = CANDIDATES[0];
  console.log(JSON.stringify({ state: APP_CONTEXT, model: "jev-latest", questions: questionsFor(sample) }, null, 2));
  console.log("\n… 其余 " + (CANDIDATES.length - 1) + " 条候选同构。");
  process.exit(key ? 0 : 2);
}

console.log("key 来源：" + key.from);
const state = { app: APP_CONTEXT, candidates: Object.fromEntries(CANDIDATES.map((c) => [c.id, { area: c.area, observation: c.observation }])) };

const ids = Object.keys(allQuestions);
const answers = {};
let usage = { input_tokens: 0, output_tokens: 0 };
const t0 = Date.now();

for (let i = 0; i < ids.length; i += CHUNK) {
  const slice = ids.slice(i, i + CHUNK);
  const qs = Object.fromEntries(slice.map((k) => [k, allQuestions[k]]));
  process.stderr.write("  发出 " + (i / CHUNK + 1) + "/" + Math.ceil(ids.length / CHUNK) + " 批（" + slice.length + " 问）…\n");
  const res = await ask(state, qs);
  Object.assign(answers, res.answers || {});
  if (res.usage) {
    usage.input_tokens += res.usage.input_tokens || 0;
    usage.output_tokens += res.usage.output_tokens || 0;
  }
}
const ms = Date.now() - t0;

/* ---------------- 合并与排序 ---------------- */
const rows = CANDIDATES.map((c) => {
  const kind = readAnswer(answers[c.id + "_kind"]);
  const impact = readAnswer(answers[c.id + "_impact"]);
  const worth = readAnswer(answers[c.id + "_worth"]);
  const route = readAnswer(answers[c.id + "_route"]);
  const imp = impact.type === "score" ? impact.value : null;
  const w = worth.type === "noul" ? worth.value : null;
  /* 单位成本的收益：影响等级（0–4，+1 避免 0 抹平）乘以「值得做」的概率，再除以我的成本估算。
     权重与阈值都留在代码里，改口径不用重新推理。 */
  const score = imp !== null && w !== null ? ((imp + 1) * w) / c.cost : null;
  return { c, kind, impact, worth, route, imp, w, score };
});

console.log("\n模型：" + (answers[ids[0]] ? "jev-latest" : "?") + " · " + ms + " ms · 输入 " + usage.input_tokens + " tok / 输出 " + usage.output_tokens + " tok");

/* ---- 对照组校验：Jev 的判断可不可信 ---- */
const controls = rows.filter((r) => r.c.control);
if (controls.length) {
  console.log("\n════ 对照组校验（我已知答案，用来看 Jev 是否可信） ════");
  controls.forEach((r) => {
    const got = r.kind.type === "choice" ? r.kind.value : "?";
    const expectIsAesthetic = r.c.control.expect === "审美偏好";
    const gotIsAesthetic = got === "审美偏好";
    const pass = expectIsAesthetic === gotIsAesthetic;
    console.log((pass ? "  ✔ " : "  ✘ ") + r.c.id + "  期望「" + r.c.control.expect + "」→ 实得「" + got + "」");
    console.log("      " + r.c.control.why);
  });
}

/* ---- 按「值得做 + 单位成本收益」排序 ---- */
const worthDoing = rows.filter((r) => (r.w ?? 0) >= 0.5).sort((a, b) => b.score - a.score);
const skip = rows.filter((r) => (r.w ?? 0) < 0.5);

const fmt = (r) => {
  const kind = r.kind.type === "choice" ? r.kind.value : "?";
  const route = r.route.type === "choice" ? r.route.value : "?";
  const kc = r.kind.confidence !== undefined ? " (conf " + r.kind.confidence.toFixed(2) + ")" : "";
  return "  " + r.c.id + "  " + String(r.score.toFixed(2)).padStart(5) +
    "  影响 " + (r.imp ?? "?").toFixed(2) + "  值得 " + (r.w ?? "?").toFixed(2) +
    "  成本 " + r.c.cost + "  " + kind + kc + "  → " + route + "\n      " + r.c.observation;
};

console.log("\n════ 值得现在做（按「影响 × 值得 / 成本」降序） ════");
worthDoing.forEach((r) => console.log(fmt(r)));

if (skip.length) {
  console.log("\n════ Jev 判为「不值得现在做」 ════");
  skip.forEach((r) => console.log(fmt(r)));
}

/* ---- 按处理路径分组：哪些要我拍板 ---- */
console.log("\n════ 按处理路径分组 ════");
Object.keys(ROUTE).forEach((route) => {
  const list = rows.filter((r) => r.route.type === "choice" && r.route.value === route);
  if (!list.length) return;
  console.log("  【" + route + "】" + list.length + " 条：" + list.map((r) => r.c.id).join(" "));
});

/* ---- 落盘，供后续引用 ---- */
const out = {
  ran_at: new Date().toISOString(),
  model: "jev-latest",
  usage, ms,
  rows: rows.map((r) => ({
    id: r.c.id, area: r.c.area, observation: r.c.observation, evidence: r.c.evidence,
    my_cost: r.c.cost,
    jev: {
      kind: r.kind.value ?? null, kind_confidence: r.kind.confidence ?? null,
      impact: r.imp, impact_confidence: r.impact.confidence ?? null,
      worth: r.w, route: r.route.value ?? null, route_confidence: r.route.confidence ?? null,
    },
    priority: r.score,
  })),
};
const fs = await import("node:fs");
fs.writeFileSync("tools/typesafe/last-audit.json", JSON.stringify(out, null, 1), "utf8");
console.log("\n已写入 tools/typesafe/last-audit.json");
