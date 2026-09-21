/* ============================================================
   地图图例（底部居中，窄屏隐藏）
   ----------------------------------------------------------
   为什么需要它：用户把长城那条**红色虚线**读成了「诗人的游历路线」，
   甚至可能读成「选中态」——因为它原来的颜色和朱砂几乎一样。
   地图上还有蓝色实线（河流）与蓝色虚线（运河），同样没有说明。

   两条线各有其色，但**颜色本身不解释自己**。所以给一条最简的图例：
   三段线样 + 三个词，不占地方，也不用点开。

   顺带把长城的颜色从朱砂改掉（见 mapEngine）：朱砂在本界面里
   专指「当前选中」，不该被一条地理线借用。
   ============================================================ */

const ITEMS = [
  { key: "river", label: "河流", cls: "lg-river" },
  { key: "canal", label: "运河", cls: "lg-canal" },
  { key: "wall", label: "长城", cls: "lg-wall" },
];

export default function Legend() {
  return (
    <div id="legend" role="note" aria-label="地图图例">
      <span className="lg-title">图例</span>
      {ITEMS.map(function (it) {
        return (
          <span className="lg-item" key={it.key}>
            <i className={it.cls} aria-hidden="true" />
            <em>{it.label}</em>
          </span>
        );
      })}
    </div>
  );
}
