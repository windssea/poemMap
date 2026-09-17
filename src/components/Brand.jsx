/* 左上：朱印 · 题名 · 竖排小联 */

export default function Brand() {
  return (
    <header id="brand">
      <span className="seal-big" aria-hidden="true">诗</span>
      <div className="b-text">
        <h1>中华诗词地图</h1>
        <p>唐风宋韵 · 山河形胜</p>
      </div>
      <div className="couplet" aria-hidden="true">
        <span className="cp-line">读万卷诗书</span>
        <span className="cp-line">行万里山河</span>
        <i className="cp-seal" />
      </div>
    </header>
  );
}
