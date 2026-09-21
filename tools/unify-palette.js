/* ============================================================
   设计语言统一：把「配色汤」收敛到一套语义色板
   ----------------------------------------------------------
   起因：style.css 里有 **234 种颜色、374 次出现**，其中光是暖金/米色一族
   就有 135 种。同一个语义（分割线、控件描边、主题点）各自用了十几档不同的值，
   于是整张页面看起来「糊」——不是分辨率问题，是没有色板。

   做法不是逐个手改（374 处必然出错），而是**按语义族批量映射**：

     暖金发丝族  rgba(195,166,103,A)   → 山青 rgba(76,103,91,A)
        （这些其实是导航 / 筛选 / 主题的强调线，本来就该是主题色，不是金色）
     米色描边族  rgba(214,196,164,A)   → 纸灰 rgba(216,208,195,A)
     更浅的米边  rgba(224,210,184,A) 等 → 纸灰的浅档
     朱红一族    各类 #b8382e / rgba(168,50,42,A) → 朱砂 #a84f3f / rgba(168,79,63,A)
     暖褐阴影    rgba(112,88,52,A)     → 墨色阴影 rgba(41,46,43,A)
        （设计规范：阴影要染成背景色相，不要中性纯黑，也不要暖褐）

   每个族替换了多少次都会打出来——改配色最怕「改完不知道改了哪」。
   令牌块本身另写（见 :root），这里只管硬编码的值。

   用法：node tools/unify-palette.js [--dry]
   ============================================================ */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const FILE = "src/styles/style.css";
const DRY = process.argv.includes("--dry");

let src = fs.readFileSync(path.join(ROOT, FILE), "utf8");
const before = src;

/* ---------- 语义族映射：顺序有意义，先具体后宽泛 ---------- */

/* 1) 暖金发丝族 → 山青（主题色）。保留原来的 alpha。
      覆盖 rgba(195,166,103,A)、rgba(186,155,92,A)、rgba(178,146,88,A) 等。 */
const GOLD_FAMILY = [
  /rgba\(195, 166, 103, ([^)]+)\)/g,
  /rgba\(186, 155, 92, ([^)]+)\)/g,
  /rgba\(178, 146, 88, ([^)]+)\)/g,
  /rgba\(168, 133, 68, ([^)]+)\)/g,
];
const SHAN = "rgba(76, 103, 91, ";

/* 2) 米色描边族 → 纸灰
      ⚠️ 这里必须用函数把捕获到的 alpha 接回去。传字符串的话，
      匹配整段（含右括号）被替换掉、alpha 丢了，就会写出
      `rgba(216, 208, 195, ;` 这种把整个样式表搞崩的东西。 */
const BEIGE_RGB = "rgba(216, 208, 195, ";
const BEIGE_FAMILY = [
  /rgba\(214, 196, 164, ([^)]+)\)/g,
  /rgba\(224, 210, 184, ([^)]+)\)/g,
  /rgba\(226, 214, 190, ([^)]+)\)/g,
];

/* 3) 朱红一族 → 朱砂 #a84f3f = rgb(168,79,63) */
const SEAL_RGB = "rgba(168, 79, 63, ";
const SEAL_DARK_RGB = "rgba(140, 63, 49, ";

/* 4) 暖褐阴影 → 墨色阴影（染背景色相，不要暖褐也不要纯黑） */
const SHADOW = "rgba(41, 46, 43, ";

const stats = [];

function apply(label, re, to, count) {
  let n = 0;
  src = src.replace(re, function () {
    n++;
    if (typeof to === "function") return to.apply(null, arguments);
    return to;
  });
  stats.push([label, n]);
  return n;
}

/* ---- 4) 阴影先做：暖褐出现在 box-shadow 里 ---- */
[
  /rgba\(112, 88, 52, ([^)]+)\)/g,
  /rgba\(102, 78, 44, ([^)]+)\)/g,
  /rgba\(104, 60, 30, ([^)]+)\)/g,
  /rgba\(140, 46, 34, ([^)]+)\)/g,
  /rgba\(120, 40, 30, ([^)]+)\)/g,
].forEach(function (re) {
  apply("阴影 → 墨色", re, function (m, a) { return SHADOW + a + ")"; });
});

/* ---- 3) 朱红一族：先处理 rgba 形式，再处理硬编码 hex ---- */
[
  /rgba\(168, 50, 42, ([^)]+)\)/g,
  /rgba\(168, 50, 42, ([^)]+)\)/g,
].forEach(function (re) {
  apply("朱红 rgba → 朱砂", re, function (m, a) { return SEAL_RGB + a + ")"; });
});
[
  /rgba\(120, 30, 24, ([^)]+)\)/g,
  /rgba\(140, 30, 24, ([^)]+)\)/g,
].forEach(function (re) {
  apply("朱红深 rgba → 朱砂深", re, function (m, a) { return SEAL_DARK_RGB + a + ")"; });
});

/* 硬编码朱红 hex（渐变的两个端点、印章描边等） */
const RED_HEX = {
  "#a8322a": "#a84f3f",  // 主朱砂
  "#8d261f": "#8c3f31",  // 深朱砂
  "#b8382e": "#a84f3f",
  "#96271f": "#8c3f31",
  "#b0362c": "#a84f3f",
  "#98281f": "#8c3f31",
  "#92271e": "#8c3f31",
  "#a32c23": "#8c3f31",
  "#8b241d": "#8c3f31",
  "#b03228": "#8c3f31",
  "#cf4a3e": "#b85f4d",  // 珠子的亮端
  "#c94034": "#a84f3f",
  "#c14a3a": "#a84f3f",
  "#f7d2ad": "#e8b9a4",  // 珠子高光
  "#f3b79c": "#e0a892",
};
Object.keys(RED_HEX).forEach(function (k) {
  apply("朱红 hex → 朱砂", new RegExp(k.replace("#", "#"), "g"), RED_HEX[k]);
});

/* ---- 1) 暖金发丝族 → 山青 ---- */
GOLD_FAMILY.forEach(function (re) {
  apply("暖金 → 山青", re, function (m, a) { return SHAN + a + ")"; });
});

/* ---- 2) 米色描边族 → 纸灰（用函数接回 alpha） ---- */
BEIGE_FAMILY.forEach(function (re) {
  apply("米色边 → 纸灰", re, function (m, a) { return BEIGE_RGB + a + ")"; });
});

/* ---- 令牌块：整段重写 ---- */
const TOKENS = `:root {
  /* ══ 表面 ══ 宣纸白 → 暖白，三级足够，不再有第四级 */
  --paper:    #f6f3ea;   /* 页面底 · 宣纸白 */
  --paper-1:  #fbf9f3;   /* 栏面 */
  --paper-2:  #fffcf5;   /* 卡面 · 暖白 */
  --paper-3:  #fffdf9;   /* 最亮，用于反白徽标底 */

  /* ══ 文字 ══ 三级都过 AA（4.5:1），第四级只给图形 */
  --ink:      #292e2b;   /* 主文字 · 墨黑        12.45:1 on --paper */
  --ink-2:    #4e5a52;   /* 次级                  7.0:1 */
  --ink-3:    #6a6e68;   /* 辅助 · 灰绿           4.68:1 */
  --ink-gfx:  #979b93;   /* **仅图形**：箭头、图标描边 */

  /* ══ 线 ══ */
  --line:      #d8d0c3;  /* 分割线 · 纸灰（装饰，1.38:1 足够） */
  --line-2:    #ece6dc;  /* 更浅的分隔 */
  --line-ctrl: #8e8676;  /* **控件描边**：表单/按钮边界要 3:1 */

  /* ══ 主题色 · 山青 ══ 导航、筛选、链接、焦点环、地图主题 */
  --shan:      #4c675b;
  --shan-d:    #3d5349;
  --shan-l:    #7f9589;
  --shan-wash: rgba(76, 103, 91, .09);

  /* ══ 强调色 · 朱砂 ══ **只用于「当前选中」与品牌朱印**，不做通用装饰 */
  --seal:      #a84f3f;
  --seal-d:    #8c3f31;
  --seal-wash: rgba(168, 79, 63, .09);

  /* ══ 青绿山水 ══ 比原来降一档饱和度，让地标成为第一视觉重点 */
  --green-1:  #7f978a;
  --green-2:  #a3b7a8;
  --green-3:  #c8d6c8;
  --green-4:  #dfe8dd;
  --water:    #93aeb8;
  --sea:      #eceee5;

  /* ══ 旧名保留 ══ 3000 行 CSS 里还有引用，映射到新语义而不是删掉 */
  --gold:     var(--shan-l);
  --gold-l:   #b9c7bc;
  --gold-d:   var(--shan);

  --serif: "Songti SC", "STSong", "Noto Serif SC", "Source Han Serif SC", "SimSun", serif;
  --sans:  "PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei", "Hiragino Sans GB", "Noto Sans SC", system-ui, sans-serif;

  /* ══ 圆角 ══ 规范：小控件 6 / 卡片 10 / 浮层 12 */
  --r-sm: 6px;
  --r-md: 10px;
  --r-lg: 12px;

  /* ══ 间距 ══ 8px 基准 */
  --s1: 8px;
  --s2: 16px;
  --s3: 24px;
  --s4: 32px;

  /* ══ 阴影 ══ 默认不加，只在悬停与浮层用。色相染背景墨色，不用中性纯黑 */
  --shadow-s: 0 1px 3px rgba(41, 46, 43, .07);
  --shadow-m: 0 6px 18px rgba(41, 46, 43, .10);
  --shadow-l: 0 16px 40px rgba(41, 46, 43, .16);

  /* ══ 动效时长 ══ 规范：悬停 120–160 / 状态切换 180–240 / 地图 300–500 */
  --t-hover: .14s;
  --t-state: .2s;
  --t-map: .4s;
  --ease: cubic-bezier(.22, 1, .28, 1);

  --side-w: 274px;
  --side-gap: 18px;
}`;

const tokenRe = /:root \{[\s\S]*?\n\}/;
if (tokenRe.test(src)) {
  src = src.replace(tokenRe, TOKENS);
  stats.push(["令牌块重写", 1]);
} else {
  console.log("✘ 找不到 :root 令牌块");
}

if (src !== before && !DRY) fs.writeFileSync(path.join(ROOT, FILE), src, "utf8");

console.log((DRY ? "（--dry，未写入）\n" : "") + "族别替换次数：");
let total = 0;
stats.forEach(function ([k, n]) { if (n) { console.log("  " + String(n).padStart(4) + "×  " + k); total += n; } });
console.log("  ─────────\n  " + String(total).padStart(4) + "×  合计");
