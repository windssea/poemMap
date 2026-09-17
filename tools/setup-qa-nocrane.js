/* 停掉仙鹤的无限动画，看它对「逐帧提交」占多大比重 */
(function () {
  var s = document.createElement("style");
  s.textContent = ".p-crane{animation:none !important}";
  document.head.appendChild(s);
})();
