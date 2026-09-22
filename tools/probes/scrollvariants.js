/* 三种「容器 + 内容」组合，看哪一种真的能滚、且起点是诗的**开头**
   ----------------------------------------------------------
   A 容器 vertical-rl（现状）        + 内容 vertical-rl/max-content
   B 容器 普通横向                   + 内容 vertical-rl/max-content
   C 容器 普通横向 + direction:rtl   + 内容 vertical-rl/max-content
   D 同 C，但给内容一个确定高度
   每档都扫 scrollLeft 并记首句屏幕位置：
     · scrollLeft 动得了 → 这一档可用
     · 且 scrollLeft=0 时首句可见 → 起点就是诗的开头（竖排右起）
   用法：CDP_STEP_ARG=A|B|C|D CDP_SETUP=tools/probes/scrollvariants.js ... */
(async function () {
  var s = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var m = window.__stepArg || "A";
  var CSS = {
    A: "#dPoem{writing-mode:vertical-rl !important;direction:ltr !important}",
    B: "#dPoem{writing-mode:horizontal-tb !important;direction:ltr !important}",
    C: "#dPoem{writing-mode:horizontal-tb !important;direction:rtl !important}",
    D: "#dPoem{writing-mode:horizontal-tb !important;direction:rtl !important}" +
       ".d-poem-inner{height:240px !important}",
  }[m];
  var st = document.createElement("style");
  st.textContent = CSS;
  document.head.appendChild(st);
  await s(300);

  var el = document.querySelector("#dPoem");
  var first = document.querySelector("#dPoem .line");
  var lines = document.querySelectorAll("#dPoem .line");
  var last = lines[lines.length - 1];
  var box = el.getBoundingClientRect();
  var max = el.scrollWidth - el.clientWidth;

  var rec = [];
  var vals = [0, -max / 2, -max, max / 2, max];
  for (var i = 0; i < vals.length; i++) {
    el.scrollLeft = vals[i]; await s(80);
    rec.push({ 设: Math.round(vals[i]), 读: Math.round(el.scrollLeft),
               首句: Math.round(first.getBoundingClientRect().left),
               末句: Math.round(last.getBoundingClientRect().left) });
  }
  el.scrollLeft = 0; await s(80);
  var f0 = first.getBoundingClientRect();
  var startOK = f0.left >= box.left - 2 && f0.left <= box.right + 2;   // 起点应在容器内
  /* 能不能到达末句：扫一遍看有没有哪一档让末句落进容器 */
  var endReachable = false;
  for (var v = 0; v >= -max; v -= Math.max(1, max / 40)) {
    el.scrollLeft = v; await s(0);
    var r = last.getBoundingClientRect();
    if (r.left >= box.left - 2 && r.right <= box.right + 2) { endReachable = true; break; }
  }
  el.scrollLeft = 0;
  return { 组合: m, sw: el.scrollWidth, cw: el.clientWidth, max: Math.round(max),
           起点是开头: startOK, 末句可达: endReachable, 扫描: rec };
})()
