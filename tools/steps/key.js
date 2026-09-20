/* 按一个键（派发 keydown）。
   参数：window.__stepArg =
     "?"            单键
     "meta+k"       ⌘/Ctrl + K（meta 与 ctrl 同时置位，Mac / Windows 都认）
     "arrowleft"   方向键（大小写不敏感，会转成 ArrowLeft） */
(async function () {
  await __wait(700);
  var raw = String(window.__stepArg || "").trim();
  if (!raw) return "no key";
  var parts = raw.split("+").map(function (s) { return s.trim(); }).filter(Boolean);
  var key = parts.pop();
  var mods = parts.map(function (s) { return s.toLowerCase(); });

  var named = { arrowleft: "ArrowLeft", arrowright: "ArrowRight", arrowup: "ArrowUp", arrowdown: "ArrowDown" };
  if (named[key.toLowerCase()]) key = named[key.toLowerCase()];

  var init = {
    key: key,
    code: key === "?" ? "Slash" : (key.length === 1 ? "Key" + key.toUpperCase() : key),
    bubbles: true, cancelable: true, view: window,
    metaKey: mods.indexOf("meta") !== -1,
    ctrlKey: mods.indexOf("ctrl") !== -1,
    shiftKey: mods.indexOf("shift") !== -1,
    altKey: mods.indexOf("alt") !== -1,
  };
  document.dispatchEvent(new KeyboardEvent("keydown", init));
  await __raf(); await __wait(420);
  return {
    pressed: raw,
    palette: !!document.querySelector("#palette.on"),
    help: !!document.querySelector("#help.on"),
    detailTitle: (document.getElementById("dTitle") || {}).textContent || "",
  };
})();
