/* 等开场动效走完再截图。
   cdp.js 在 load 之后只等 min(2500, waitMs)，而开场时间线约 2.7s——
   直接截图会拍到「题名还没浮出来」的那一帧。这个步骤补上剩下的等待。 */
(async function () {
  await __wait(3400);
  return {
    prep: document.documentElement.classList.contains("motion-prep"),
    brand: getComputedStyle(document.getElementById("brand")).opacity,
  };
})();
