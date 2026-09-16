/**
 * 极简 PNG 像素采样器（工具，非站点依赖）
 * 把截图按网格采样，输出 ASCII 色块图，用于无视觉环境下的版面检查。
 * 用法：node tools/pixdump.js <png路径> [格宽] [格高]
 */
const fs = require("fs");
const zlib = require("zlib");

function decodePng(buf) {
  let pos = 8;
  let idat = [];
  let w = 0, h = 0, bit = 0, ct = 0;
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    if (type === "IHDR") {
      w = buf.readUInt32BE(pos + 8);
      h = buf.readUInt32BE(pos + 12);
      bit = buf[pos + 16];
      ct = buf[pos + 17];
    } else if (type === "IDAT") {
      idat.push(buf.slice(pos + 8, pos + 8 + len));
    } else if (type === "IEND") {
      break;
    }
    pos += 12 + len;
  }
  if (bit !== 8 || (ct !== 6 && ct !== 2)) throw new Error(`unsupported PNG: bit=${bit} colortype=${ct}`);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const ch = ct === 6 ? 4 : 3;
  const stride = w * ch;
  const out = Buffer.alloc(h * stride);
  let prev = Buffer.alloc(stride);
  let rp = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[rp++];
    const line = raw.slice(rp, rp + stride);
    rp += stride;
    const cur = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0;
      const b = prev[x];
      const c = x >= ch ? prev[x - ch] : 0;
      let v;
      if (f === 0) v = line[x];
      else if (f === 1) v = (line[x] + a) & 0xff;
      else if (f === 2) v = (line[x] + b) & 0xff;
      else if (f === 3) v = (line[x] + ((a + b) >> 1)) & 0xff;
      else {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        v = (line[x] + pr) & 0xff;
      }
      cur[x] = v;
    }
    cur.copy(out, y * stride);
    prev = cur;
  }
  return { w, h, data: out };
}

function classify(r, g, b) {
  if (r > 110 && g < 90 && b < 90 && r - g > 60) return "R"; // 朱红墙面 / 朱砂
  if (r > 170 && g > 120 && g < 216 && b < 140 && r - b > 70) return "G"; // 檐金
  if (b > r + 12 && b > g + 4) return "~"; // 海面蓝
  if (r > 205 && g > 205 && b > 185 && Math.abs(r - g) < 24 && Math.abs(g - b) < 24) return "#"; // 纸色
  if (g > r && g > b) return "."; // 绿地
  if (r > g && r > b) return "o"; // 赭石/棕
  return "?";
}

const file = process.argv[2];
const GW = parseInt(process.argv[3] || "92", 10);
const GH = parseInt(process.argv[4] || "46", 10);
const { w, h, data } = decodePng(fs.readFileSync(file));
const channels = data.length / (w * h);
const cw = w / GW, chh = h / GH;
let lines = [];
for (let gy = 0; gy < GH; gy++) {
  let line = "";
  for (let gx = 0; gx < GW; gx++) {
    const px = Math.floor((gx + 0.5) * cw);
    const py = Math.floor((gy + 0.5) * chh);
    const i = (py * w + px) * channels;
    line += classify(data[i], data[i + 1], data[i + 2]);
  }
  lines.push(line);
}
console.log(`size=${w}x${h} grid=${GW}x${GH} legend: # 纸面UI  ~ 海  * 朱砂地标  . 绿地  o 赭石`);
console.log(lines.join("\n"));
