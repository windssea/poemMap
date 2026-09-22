/* ============================================================
   把样式表里剩下的硬编码颜色迁到《千里江山图》色板
   ----------------------------------------------------------
   令牌块已经整段换过（:root），这里处理**令牌之外的硬编码值**。
   216 种颜色里还有一大批是旧色板的：宣纸白 #f6f3ea 一族、
   山青 rgba(76,103,91,A) 一族、墨黑 rgba(41,46,43,A) 一族。

   按族映射，不逐个手改（382 处必错）。每一族替换了多少次都打出来——
   改配色最怕「改完不知道改了哪」。

   用法：node tools/migrate-palette-qianli.js [--dry]
   ============================================================ */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const FILE = "src/styles/style.css";
const DRY = process.argv.includes("--dry");

let src = fs.readFileSync(path.join(ROOT, FILE), "utf8");
const before = src;
const stats = [];

function fam(label, re, to) {
  let n = 0;
  src = src.replace(re, function () {
    n++;
    return typeof to === "function" ? to.apply(null, arguments) : to;
  });
  if (n) stats.push([label, n]);
}

/* ---------- 1) 文字：墨黑 → 墨青 ---------- */
fam("墨黑 → 墨青", /#292e2b/gi, "#293f3b");
fam("次级文字", /#4e5a52/gi, "#3f5149");
fam("辅助文字", /#6a6e68/gi, "#656f68");
fam("图形色", /#979b93/gi, "#8f9489");

/* ---------- 2) 表面：宣纸白 → 绢本/暖绢白 ---------- */
fam("卡面 → 暖绢白", /#fffcf5/gi, "#faf7ed");
fam("最亮面", /#fffdf9/gi, "#fdfbf4");
fam("栏面", /#fbf9f3/gi, "#f7f3e5");
fam("页面底 → 绢本", /#f6f3ea/gi, "#f3efdf");
/* 半透明绢白（浮层、控件底） */
fam("绢白半透明", /rgba\(255, 253, 247, ([^)]+)\)/g, function (m, a) { return "rgba(250, 247, 237, " + a + ")"; });
fam("更暖的绢白", /rgba\(253, 248, 236, ([^)]+)\)/g, function (m, a) { return "rgba(250, 247, 237, " + a + ")"; });
fam("绢白 253,250,242", /rgba\(253, 250, 242, ([^)]+)\)/g, function (m, a) { return "rgba(250, 247, 237, " + a + ")"; });
fam("绢白 255,254,250", /rgba\(255, 254, 250, ([^)]+)\)/g, function (m, a) { return "rgba(250, 247, 237, " + a + ")"; });
fam("绢白 255,253,246", /rgba\(255, 253, 246, ([^)]+)\)/g, function (m, a) { return "rgba(250, 247, 237, " + a + ")"; });
fam("绢白 246,250,244", /rgba\(246, 250, 244, ([^)]+)\)/g, function (m, a) { return "rgba(238, 240, 229, " + a + ")"; });
fam("绢白 255,236,214", /rgba\(255, 236, 214, ([^)]+)\)/g, function (m, a) { return "rgba(250, 247, 237, " + a + ")"; });

/* ---------- 3) 线：纸灰 → 绢黄灰 ---------- */
fam("分割线", /#d8d0c3/gi, "#d5c9af");
fam("更浅的分隔", /#ece6dc/gi, "#e8e0cd");
fam("控件描边", /#8e8676/gi, "#8a7f66");
fam("边框半透明", /rgba\(216, 208, 195, ([^)]+)\)/g, function (m, a) { return "rgba(213, 201, 175, " + a + ")"; });

/* ---------- 4) 主题色：山青 → 石绿 ---------- */
/* 半透明的一族：填充/描边/洗色 */
fam("山青 rgba → 石绿", /rgba\(76, 103, 91, ([^)]+)\)/g, function (m, a) { return "rgba(86, 140, 120, " + a + ")"; });
fam("石绿实底", /#4c675b/gi, "#376b60");
fam("深石绿", /#3d5349/gi, "#2f5a51");
fam("浅石绿", /#7f9589/gi, "#568c78");
fam("石绿过渡色", /#b9c7bc/gi, "#c8b183");
fam("石绿浅绿", /#b6c8ba/gi, "#a8c6b3");
fam("石绿中绿", /#6f8a79/gi, "#568c78");
fam("石绿深绿", /#3f5549/gi, "#2f5a51");

/* ---------- 5) 朱砂 ---------- */
fam("朱砂主色", /#a84f3f/gi, "#a94f3c");
fam("朱砂深色", /#8c3f31/gi, "#8f4030");
fam("朱砂 rgba", /rgba\(168, 79, 63, ([^)]+)\)/g, function (m, a) { return "rgba(169, 79, 60, " + a + ")"; });
fam("朱砂深 rgba", /rgba\(140, 63, 49, ([^)]+)\)/g, function (m, a) { return "rgba(143, 64, 48, " + a + ")"; });
fam("朱砂渐变端", /#557063/gi, "#376b60");
fam("朱砂渐变端深", /#435b4f/gi, "#2f5a51");
fam("朱砂亮端", /#b85f4d/gi, "#a94f3c");
fam("朱砂高光", /#d8b3a5/gi, "#e0b8a8");

/* ---------- 6) 阴影：墨黑 → 墨青 ---------- */
fam("阴影染墨青", /rgba\(41, 46, 43, ([^)]+)\)/g, function (m, a) { return "rgba(41, 63, 59, " + a + ")"; });

/* ---------- 7) 地图/山水相关 ---------- */
fam("旧水色 → 青碧", /#93aeb8/gi, "#518498");
fam("旧水色深", /#659db2/gi, "#518498");
fam("旧水色浅", /#a0bfc8/gi, "#8fb2bf");
fam("海面", /#eceee5/gi, "#eef0e5");
fam("旧绿 1", /#7f978a/gi, "#376b76");
fam("旧绿 2", /#a3b7a8/gi, "#568c78");
fam("旧绿 3", /#c8d6c8/gi, "#94b5a0");
fam("旧绿 4", /#dfe8dd/gi, "#c3d4c2");
fam("旧山雾", /#acc8b5/gi, "#9dbfae");
fam("旧山纹", /#7a9382/gi, "#6f8f80");
fam("旧山脊白", /#f3f9ef/gi, "#f2f7ee");
fam("旧省界", /#a8ad92/gi, "#c6b78f");
fam("长城底色", /#c2a878/gi, "#c8b183");
fam("长城线", /#8f7748/gi, "#967948");
fam("徽标底", /#fdf4e4/gi, "#fdfbf4");
fam("徽标底 2", /#fdf4e6/gi, "#fdfbf4");
fam("暖纸 2", /#faf5e8/gi, "#f7f3e5");
fam("暖纸 3", /#fdf8ec/gi, "#faf7ed");
fam("暖纸 4", /#fffdf7/gi, "#fdfbf4");
fam("暖纸 5", /#f2e9d7/gi, "#f3efdf");
fam("暖纸 6", /#eef0e3/gi, "#eef0e5");

if (src !== before && !DRY) fs.writeFileSync(path.join(ROOT, FILE), src, "utf8");

console.log((DRY ? "（--dry，未写入）\n" : "") + "族别替换：");
let total = 0;
stats.forEach(function (s) { console.log("  " + String(s[1]).padStart(4) + "×  " + s[0]); total += s[1]; });
console.log("  ─────────\n  " + String(total).padStart(4) + "×  合计");
