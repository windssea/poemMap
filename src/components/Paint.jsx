/* ============================================================
   长卷点景与地图底：全幅铺底的两层
   ----------------------------------------------------------
   点景素材是设计画稿的一部分（流云 · 仙鹤 · 松石 · 江涛），由 public/assets
   直接引用——不走打包器，路径与旧版一致。

   原来还有两幅「山」（mountains-mist / mountains-fall）：位图山与矢量山体
   两套笔法放在同一屏里，边缘与皴法对不上，看着就是贴上去的，已移除。
   山的部分交给 terrain.js 程序绘制的那一套。
   ============================================================ */

export function MapCanvas({ mapRef }) {
  return (
    <>
      <main id="map" ref={mapRef} aria-label="诗词地图" />
      <div id="mapWash" aria-hidden="true" />
    </>
  );
}

export function Paint() {
  return (
    <div id="paint" aria-hidden="true">
      <img className="p-cloud" src="assets/cloud-blue.png" alt="" />
      <img className="p-crane" src="assets/crane.png" alt="" />
      <img className="p-wave" src="assets/waves.png" alt="" />
    </div>
  );
}

/* 装裱框：把整屏地图「裱」进一张手卷里。
   ------------------------------------------------------------
   长卷之所以不像一张网页截图，靠的是四周那圈裱边——画心之外留出绫绢，
   再用两道细金线压边。这里只做「两道线 + 四角包角」，不加任何花纹：
   地图本身已经很满，裱边一花就抢戏。
   层级 590：压在地图与云气（300/550）之上，却在全部界面（610+）之下，
   所以题名、筛选条、底栏都还压在框上，框只负责把画面收拢。 */
export function Mount() {
  return (
    <div id="mount" aria-hidden="true">
      <i className="mt-corner mt-c1" />
      <i className="mt-corner mt-c2" />
      <i className="mt-corner mt-c3" />
      <i className="mt-corner mt-c4" />
    </div>
  );
}
