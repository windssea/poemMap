/* ============================================================
   把 tools/_new/*.json 里的补编诗词合并进 src/data 的正册
   ----------------------------------------------------------
   为什么不让补编直接手写进正册：一次补几十首，手工插入最容易
   漏逗号、错缩进。这里由 JSON 生成 JS 源码，格式与既有条目一致，
   再插到数组末尾——语法由生成器保证。

   用法：node tools/apply-new-poems.js [--dry]

   幂等：已在正册里的 id 会被跳过，重复跑不会写进两份。
   ============================================================ */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const NEW_DIR = path.join(ROOT, "tools", "_new");
const DRY = process.argv.indexOf("--dry") !== -1;

/* 分册：文件前缀 → 正册文件 + 数组名。
   `recovered.json` 是特例：它由 tools/recover-from-dist.js 从旧构建产物里
   捞回整份数据，诗要按 dynasty 分流到各册，不能按文件名判断。 */
const BOOKS = [
  { match: /^pre/, target: "src/data/poems.pre.js", array: "PRE_POEMS" },
  { match: /^tang/, target: "src/data/poems.tang.js", array: "TANG_POEMS" },
  { match: /^song/, target: "src/data/poems.song.js", array: "SONG_POEMS" },
];
const BY_DYNASTY = {
  先秦: "src/data/poems.pre.js",
  汉: "src/data/poems.pre.js",
  魏晋: "src/data/poems.pre.js",
  南北朝: "src/data/poems.pre.js",
  唐: "src/data/poems.tang.js",
  宋: "src/data/poems.song.js",
};
const ARRAY_OF = {
  "src/data/poems.pre.js": "PRE_POEMS",
  "src/data/poems.tang.js": "TANG_POEMS",
  "src/data/poems.song.js": "SONG_POEMS",
};

const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const write = (p, s) => fs.writeFileSync(path.join(ROOT, p), s, "utf8");

/* ---------- 源码生成 ---------- */
const q = (s) => JSON.stringify(String(s));

function fmtPlace(pl) {
  const out = [
    "    place: {",
    "      name: " + q(pl.name) + ",",
    "      region: " + q(pl.region) + ",",
    "      lat: " + Number(pl.lat) + ",",
    "      lng: " + Number(pl.lng) + ",",
    "      origin: " + q(pl.origin || "") + ",",
    "    },",
  ];
  return out.join("\n");
}

function fmtPoem(p) {
  const L = [];
  L.push("  {");
  L.push("    id: " + q(p.id) + ",");
  L.push("    title: " + q(p.title) + ",");
  L.push("    dynasty: " + q(p.dynasty) + ",");
  L.push("    author: " + q(p.author) + ",");
  L.push("    form: " + q(p.form) + ",");
  L.push(fmtPlace(p.place));
  L.push("    lines: [" + p.lines.map(q).join(", ") + "],");
  if (p.prologue) L.push("    prologue: " + q(p.prologue) + ",");
  L.push("    tr: " + q(p.tr) + ",");
  L.push("    notes: [");
  (p.notes || []).forEach(function (n) {
    L.push("      [" + q(n[0]) + ", " + q(n[1]) + "],");
  });
  L.push("    ],");
  L.push("    appr: " + q(p.appr) + ",");
  L.push("  },");
  return L.join("\n");
}

function fmtAuthor(name, a) {
  return "  " + name + ": {\n" +
    "    years: " + q(a.years || "") + ",\n" +
    "    bio: " + q(a.bio || "") + ",\n" +
    "  },";
}

function fmtTag(id, tags) {
  return "  " + q(id) + ": [" + tags.map(q).join(", ") + "],";
}

/* 把一段源码插到「数组/对象字面量的闭合行」之前。
   ⚠️ 必须先把 head 末尾的逗号补齐：正册里最后一条**没有**尾逗号
   （`  }\n];`），直接插进去会变成 `  }\n  {`，整份数据语法就废了。 */
function insertBeforeClose(src, closeToken, block, label) {
  const idx = src.lastIndexOf(closeToken);
  if (idx === -1) throw new Error("找不到 " + label + " 的闭合符 " + closeToken);
  let head = src.slice(0, idx).replace(/\s*$/, "");
  if (!/[,{[]$/.test(head)) head += ",";
  const tail = src.slice(idx);
  return head + "\n" + block + "\n" + tail;
}

/* ---------- 收拢补编 ---------- */
const staged = fs.existsSync(NEW_DIR)
  ? fs.readdirSync(NEW_DIR).filter(function (f) { return f.endsWith(".json"); })
  : [];

if (!staged.length) {
  console.log("tools/_new/ 里没有 .json，无事可做。");
  process.exit(0);
}

const bookPoems = new Map();   // target → []
const allAuthors = {};
const allTags = {};
let bad = 0;

staged.forEach(function (f) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(path.join(NEW_DIR, f), "utf8"));
  } catch (e) {
    console.log("✘ " + f + " 不是合法 JSON：" + e.message);
    bad++;
    return;
  }

  /* 分流：recovered.json 按 dynasty 走，其余按文件名前缀 */
  const routes = new Map();
  const byPrefix = BOOKS.find(function (b) { return b.match.test(f); });
  (data.poems || []).forEach(function (p) {
    const target = BY_DYNASTY[p.dynasty] || (byPrefix && byPrefix.target);
    if (!target) return;
    if (!routes.has(target)) routes.set(target, []);
    routes.get(target).push(p);
  });

  routes.forEach(function (poems, target) {
    if (!bookPoems.has(target)) bookPoems.set(target, []);
    bookPoems.get(target).push.apply(bookPoems.get(target), poems);
  });
  Object.assign(allAuthors, data.authors || {});
  Object.assign(allTags, data.tags || {});

  const spread = [...routes.entries()].map(function (e) {
    return e[0].replace("src/data/poems.", "").replace(".js", "") + " " + e[1].length;
  }).join(" / ");
  console.log("读入 " + f + "：" + (data.poems || []).length + " 首" + (spread ? "（" + spread + "）" : ""));
});

if (bad) { console.log("\n有文件解析失败，先修好再跑。"); process.exit(1); }

/* ---------- 去重（对正册已有的 id） ---------- */
const existingIds = new Set();
BOOKS.forEach(function (b) {
  const src = read(b.target);
  [...src.matchAll(/^\s*id:\s*"([^"]+)"/gm)].forEach(function (m) { existingIds.add(m[1]); });
});

let addedPoems = 0;
let addedAuthors = 0;
let addedTags = 0;

bookPoems.forEach(function (poems, target) {
  const book = BOOKS.find(function (b) { return b.target === target; });
  let src = read(target);
  const fresh = poems.filter(function (p) {
    if (existingIds.has(p.id)) { console.log("跳过重复 id：" + p.id); return false; }
    existingIds.add(p.id);
    return true;
  });
  if (!fresh.length) return;
  const block = fresh.map(fmtPoem).join("\n");
  src = insertBeforeClose(src, "];", block, book.array);
  if (!DRY) write(target, src);
  addedPoems += fresh.length;
  console.log(target + " 追加 " + fresh.length + " 首");
});

/* ---------- 作者 ---------- */
{
  let src = read("src/data/authors.js");
  const have = new Set([...src.matchAll(/^\s{2}([\u4e00-\u9fa5]+):\s*\{\s*$/gm)].map(function (m) { return m[1]; }));
  const fresh = Object.keys(allAuthors).filter(function (n) {
    if (have.has(n)) return false;
    have.add(n);
    return true;
  });
  if (fresh.length) {
    const block = fresh.map(function (n) { return fmtAuthor(n, allAuthors[n]); }).join("\n");
    src = insertBeforeClose(src, "};", block, "AUTHORS");
    if (!DRY) write("src/data/authors.js", src);
    addedAuthors = fresh.length;
    console.log("authors.js 追加 " + fresh.length + " 位：" + fresh.join("、"));
  }
}

/* ---------- 标签 ---------- */
{
  let src = read("src/data/tags.js");
  const have = new Set([...src.matchAll(/^\s*"([\w-]+)":\s*\[/gm)].map(function (m) { return m[1]; }));
  const fresh = Object.keys(allTags).filter(function (id) {
    if (have.has(id) || !Array.isArray(allTags[id]) || !allTags[id].length) return false;
    have.add(id);
    return true;
  });
  if (fresh.length) {
    const block = fresh.map(function (id) { return fmtTag(id, allTags[id]); }).join("\n");
    src = insertBeforeClose(src, "};", block, "POEM_TAGS");
    if (!DRY) write("src/data/tags.js", src);
    addedTags = fresh.length;
    console.log("tags.js 追加 " + fresh.length + " 条");
  }
}

console.log("\n合计：诗 " + addedPoems + " 首 · 作者 " + addedAuthors + " 位 · 标签 " + addedTags + " 条" +
  (DRY ? "（--dry，未写入）" : ""));
