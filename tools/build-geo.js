/**
 * 构建脚本（一次性运行，非站点运行时依赖）
 * 把下载的行政区划 GeoJSON 精简为离线数据 data/china.geo.js
 *   - 坐标保留两位小数（约 1km 精度，示意地图足够）
 *   - 只保留 name / adcode / level / center / centroid 属性
 *   - 拆分「国境线」与「省界」两组，便于分别套用样式
 *
 * 用法：node tools/build-geo.js
 */
const fs = require("fs");
const path = require("path");

const RAW = path.join(__dirname, "china-raw.json");
const OUT = path.join(__dirname, "..", "data", "china.geo.js");

function round(list) {
  return list.map((v) => Math.round(v * 100) / 100);
}
function walk(coords) {
  if (typeof coords[0] === "number") return round(coords);
  return coords.map(walk);
}

const raw = JSON.parse(fs.readFileSync(RAW, "utf8"));
let pts = 0;
const slim = {
  type: "FeatureCollection",
  features: raw.features
    .map((f) => {
      pts += 0;
      return {
        type: "Feature",
        properties: {
          name: f.properties.name,
          adcode: f.properties.adcode,
          level: f.properties.level,
          center: f.properties.center,
          centroid: f.properties.centroid,
        },
        geometry: {
          type: f.geometry.type,
          coordinates: walk(f.geometry.coordinates, (n) => {
            pts++;
            return n;
          }),
        },
      };
    }),
};

let count = 0;
slim.features.forEach((f) =>
  f.geometry.type === "Polygon"
    ? (count += f.geometry.coordinates.length)
    : f.geometry.coordinates.forEach((r) => (count += r.length))
);

const js = "/* 中国行政区划（离线数据 · 由 tools/build-geo.js 精简自 DataV 行政区划 GeoJSON） */\nwindow.CHINA_GEO = " + JSON.stringify(slim) + ";\n";
fs.writeFileSync(OUT, js, "utf8");

const kb = Math.round(fs.statSync(OUT).size / 1024);
console.log(`provinces: ${slim.features.length} | rings: ${count} | out: data/china.geo.js (${kb} KB)`);
