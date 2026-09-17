(function () {
  // 1) 点开黄州地标 → 弹出多地诗词浮层
  var names = document.querySelectorAll(".dot-name");
  for (var i = 0; i < names.length; i++) {
    if (names[i].textContent.indexOf("黄州") > -1) {
      var icon = names[i].closest(".leaflet-marker-icon") || names[i].closest(".mk-wrap");
      if (icon) { icon.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window })); break; }
    }
  }
  // 2) 在浮层里点「念奴娇·赤壁怀古」→ 开诗词卡
  var items = document.querySelectorAll("#poemList .pl-item");
  var hit = null;
  for (var j = 0; j < items.length; j++) {
    if (items[j].textContent.indexOf("念奴娇") > -1) { hit = items[j]; break; }
  }
  if (!hit && items.length) hit = items[0];
  if (hit) hit.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  // 3) 卡内「查看完整注释」→ 打开右侧详情抽屉（并应自动关闭诗词卡）
  var more = document.querySelector("#cardMore");
  if (more) more.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  return "detail:念奴娇-on=" + document.querySelector("#detail").classList.contains("on") +
         "; card-on=" + document.querySelector("#card").classList.contains("on");
})()
