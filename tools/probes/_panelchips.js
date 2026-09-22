/* 打开索引面板的「篇目」体，点一个朝代芯片，检查选中态用的是什么色
   （方案 P1-E：筛选选中＝深石绿 + 白字，不得用朱砂） */
(async function () {
  var s = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var click = function (el) {
    if (el) el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  };
  click(document.querySelector("#menuBtn"));
  await s(400);
  var btns = [].slice.call(document.querySelectorAll("#menuPop button"));
  var ba = btns.filter(function (b) { return b.textContent.indexOf("唐宋八大家") > -1; })[0];
  click(ba || btns[1]);
  await s(900);
  var chips = [].slice.call(document.querySelectorAll("#panel .filters button"));
  var tang = chips.filter(function (b) { return b.textContent.trim() === "唐"; })[0];
  click(tang || chips[1]);
  await s(500);
  var sel = document.querySelector("#panel .filters button[aria-pressed='true']");
  if (!sel) return { err: "没有选中的芯片", chips: chips.length };
  var cs = getComputedStyle(sel);
  return {
    panelOn: document.querySelector("#panel").classList.contains("on"),
    chips: chips.length,
    selectedText: sel.textContent.trim(),
    color: cs.color,
    background: cs.backgroundImage !== "none" ? cs.backgroundImage : cs.backgroundColor,
    borderColor: cs.borderTopColor,
  };
})()
