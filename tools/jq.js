/* 从 cdp.js 的输出里取出第一个完整的 JSON 对象并美化打印。
   ----------------------------------------------------------
   为什么需要它：cdp.js 会把 --eval 的结果 JSON.stringify(x, null, 2) 打到
   stdout，而 CDP_VERBOSE=1 时 stderr 里还有 REQUESTS(...) 之类的杂音，
   两边一起进管道，直接 JSON.parse 会炸。这里做括号配平，取第一个完整对象。
   用法：node tools/cdp.js <url> --eval "..." | node tools/jq.js
   （管道里的脚本别用 heredoc 写——Windows 的 shell 会吃掉反斜杠。） */
let s = "";
process.stdin.on("data", (d) => (s += d)).on("end", () => {
  const i = s.indexOf("{");
  if (i < 0) { console.log("(输出里没有 JSON) " + s.slice(0, 200)); return; }
  let depth = 0, inStr = false, esc = false;
  for (let k = i; k < s.length; k++) {
    const c = s[k];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        try { console.log(JSON.stringify(JSON.parse(s.slice(i, k + 1)), null, 1)); }
        catch (e) { console.log("(JSON 解析失败) " + e.message); }
        return;
      }
    }
  }
  console.log("(括号没配平)");
});
