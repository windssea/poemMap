/* ============================================================
   长卷点景与地图底：全幅铺底的两层
   ----------------------------------------------------------
   点景素材是设计画稿的一部分（远山 · 流云 · 仙鹤 · 松石 · 江涛），
   由 public/assets 直接引用——不走打包器，路径与旧版一致。
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
      <img className="p-mount" src="assets/mountains-mist.png" alt="" />
      <img className="p-cloud" src="assets/cloud-blue.png" alt="" />
      <img className="p-crane" src="assets/crane.png" alt="" />
      <img className="p-pine" src="assets/pines.png" alt="" />
      <img className="p-wave" src="assets/waves.png" alt="" />
    </div>
  );
}
