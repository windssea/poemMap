/* 文字「发灰」的 A/B 实验台（方案 §1.1.4 的四个怀疑对象，逐个隔离）
   ----------------------------------------------------------
   方案要求"先排查实际渲染原因，不能把所有问题简单归咎于字体或抗锯齿"。
   这里把四个最常见的怀疑对象做成可开关的对照组，一次只动一个变量，
   改完用 tools/text-contrast.js 或像素统计去比 —— **不要靠眼睛看**。

   用法：
     CDP_STEP_ARG=<mode> CDP_SETUP=tools/probes/textblur-ab.js \
       node tools/cdp.js <url> shots/ab-<mode>.png 7000
   模式：
     opaque    详情抽屉底改成完全不透明（背板仍留 backdrop-filter）
     nobdf     不透明 + 摘掉 backdrop-filter       ← 与 opaque 一起隔离背板模糊
     halonone  地图小字去掉那圈纸色硬描边
     noiseoff  摘掉 #detail::before 的纸纹伪元素

   —— 2026-09-22 实测结论（1424×805 / dpr 1 / HeadlessChrome 153）——
     opaque   墨色像素 3.889% → 3.885%，最暗亮度 58 → 58   → **无影响**
     nobdf    同上（背板模糊对字形渲染没有可测影响）        → **无影响**
     halonone 名签最暗像素 [105,135,122] → [102,133,116]    → 差 3/255，**无影响**
     noiseoff 竖排诗最暗亮度 58 → 58                        → **无影响**
   四条都不成立，所以这四处**都没有改**。别凭印象去"修"它们。
   （真正的成因是 dpr：dpr 1 下 12px 汉字的笔画全是边缘像素、够不到全墨；
     dpr 2 实测最暗像素 [44,65,60] ≈ 目标色 #293f3b 的 [41,63,59]。）
   ============================================================ */
(function () {
  var mode = window.__stepArg || "none";
  var CSS = {
    opaque: "#detail{background:rgb(247,243,232) !important}",
    nobdf: "#detail{background:rgb(247,243,232) !important;" +
           "-webkit-backdrop-filter:none !important;backdrop-filter:none !important}",
    halonone: ".dot-name,.prov-label span,.mtn-label span,.geo-label span{text-shadow:none !important}",
    noiseoff: "#detail::before{display:none !important}",
    none: "",
  };
  var css = CSS[mode];
  if (css === undefined) return "未知模式：" + mode + "（可用：" + Object.keys(CSS).join("/") + "）";
  var st = document.createElement("style");
  st.id = "probe-textblur";
  st.textContent = css || "/* noop */";
  document.head.appendChild(st);
  return "mode=" + mode + (css ? " 已注入" : " 对照组（未改任何东西）");
})()
