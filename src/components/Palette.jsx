/* ============================================================
   命令面板（⌘K / Ctrl+K）
   ----------------------------------------------------------
   一个输入框，同时是「找诗」「找人」「找地方」「执行动作」四个入口。
   为什么要它：收了三百首之后，靠右上那个搜索框只能搜到诗，
   想「跳到李白」「去长安」「换个主题」都得先想起菜单在哪一层。

   匹配用「子串优先 + 子序列兜底」：中文没有词形变化，
   逐字子序列已经够用（「李太」能命中「李白」的条目名不算，
   但「将进」能命中「将进酒」，跨字跳着打也能中）。

   索引只在首次打开时建一次，之后常驻——它只是几百条字符串，
   比每次输入都重新遍历 POEMS 划算得多。
   ============================================================ */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useStore, closePalette, openDetail, openPoemList, setAuthor, clearFacets,
  setDynasty, setForm,
} from "../store.js";
import { POEMS } from "../data/index.js";
import { PLACES, PLACE_BY_ID } from "../data/places.js";
import { poetIndex, themeIndex } from "../data/select.js";
import { SCHOOLS, SCHOOL_NAMES, schoolCount } from "../data/schools.js";
import { getEngine } from "../engine/mapEngine.js";
import {
  pickRandom, resetView, toggleMotion, openPanelSafe, toggleSidebar, focusTag, about,
  focusSchool,
} from "../actions.js";
import { openHelp } from "../store.js";
import { IconSearch, IconChevron } from "./icons.jsx";

/* ---------------- 打分 ---------------- */
/** 命中越靠前、越短，分越高；完全不沾边返回 -1 */
function score(hay, q) {
  if (!q) return 0;
  const t = hay.toLowerCase();
  const i = t.indexOf(q);
  if (i === 0) return 1000 - Math.min(400, hay.length * 4);
  if (i > 0) return 600 - Math.min(300, i * 6);
  /* 子序列兜底：跳着打的字也算中，但分数低一档 */
  let p = 0;
  for (let k = 0; k < q.length; k++) {
    p = t.indexOf(q[k], p);
    if (p === -1) return -1;
    p++;
  }
  return 120;
}

/* ---------------- 索引（首次打开时建一次） ---------------- */
let INDEX = null;
function buildIndex() {
  if (INDEX) return INDEX;
  const poems = POEMS.map(function (p) {
    return {
      kind: "poem", id: p.id, title: p.title, author: p.author, dynasty: p.dynasty,
      place: p.place.name, region: p.place.region,
      /* 参与匹配的所有字段拼成一串，免得每个字段各打一次分 */
      hay: [p.title, p.author, p.dynasty, p.place.name, p.place.region,
        (p.lines || []).slice(0, 2).join("")].join(" "),
    };
  });
  const authors = poetIndex().map(function (it) {
    return { kind: "author", name: it.name, count: it.count, hay: it.name };
  });
  const tags = themeIndex().map(function (it) {
    return { kind: "tag", tag: it.tag, count: it.count, hay: it.tag };
  });
  const places = PLACES.map(function (n) {
    return {
      kind: "place", id: n.id, name: n.name, region: n.region, count: n.poems.length,
      hay: n.name + " " + n.region,
    };
  });
  INDEX = { poems: poems, authors: authors, tags: tags, places: places };
  return INDEX;
}

/* ---------------- 动作 ----------------
   窄屏会把顶部的题名与筛选条整块收掉，搜索与筛选全靠这个面板。
   所以「朝代 / 体裁」这些原本在筛选条上的开关也必须在这里有一份，
   否则藏起顶栏就等于砍掉了筛选能力。 */
const ACTIONS = [
  { kind: "act", id: "random", label: "随机读一首", hint: "R", run: pickRandom },
  { kind: "act", id: "nation", label: "回到全国", hint: "G", run: resetView },
  { kind: "act", id: "poet", label: "打开诗人索引", run: () => openPanelSafe("poet") },
  { kind: "act", id: "theme", label: "打开主题索引", run: () => openPanelSafe("theme") },
  { kind: "act", id: "list", label: "展开或收起篇目栏", run: toggleSidebar },
  { kind: "act", id: "d-all", label: "不限朝代", kw: "全部 朝代", run: () => setDynasty("全部") },
  { kind: "act", id: "d-pre", label: "只看先唐（先秦 · 汉 · 魏晋 · 南北朝）", kw: "古诗 先唐 先秦 汉 魏晋 南北朝", run: () => setDynasty("先唐") },
  { kind: "act", id: "d-tang", label: "只看唐诗", kw: "唐 诗", run: () => setDynasty("唐") },
  { kind: "act", id: "d-song", label: "只看宋词", kw: "宋 词", run: () => setDynasty("宋") },
  { kind: "act", id: "f-all", label: "不限体裁", kw: "全部 体裁", run: () => setForm("全部") },
  { kind: "act", id: "f-shi", label: "只看诗", kw: "诗 体裁", run: () => setForm("诗") },
  { kind: "act", id: "f-ci", label: "只看词", kw: "词 体裁", run: () => setForm("词") },
  { kind: "act", id: "motion", label: "开关动效", run: toggleMotion },
  { kind: "act", id: "help", label: "快捷键速查", run: openHelp },
  { kind: "act", id: "clear", label: "清除作者 / 主题 / 群体筛选", run: clearFacets },
  { kind: "act", id: "about", label: "关于本图", run: about },
];

/* 作者群体也做成动作：搜「八大家」「韩愈」都能直接筛出这一组 */
SCHOOL_NAMES.forEach(function (name) {
  ACTIONS.push({
    kind: "act",
    id: "school-" + name,
    label: "只看" + name + "（" + (SCHOOLS[name] || []).join(" · ") + "）",
    kw: name + " 八大家 " + (SCHOOLS[name] || []).join(" "),
    run: function () { focusSchool(name); },
  });
});

const KIND_LABEL = { poem: "诗", author: "人", tag: "题", place: "地", act: "做" };

export default function Palette() {
  const open = useStore("paletteOpen");
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  /* 每次打开都清空、聚焦——上一次搜到一半的状态留着反而碍事 */
  useEffect(function () {
    if (!open) return;
    setQ("");
    setCursor(0);
    const t = setTimeout(function () { inputRef.current && inputRef.current.focus(); }, 30);
    return function () { clearTimeout(t); };
  }, [open]);

  const results = useMemo(function () {
    if (!open) return [];
    const needle = q.trim().toLowerCase();
    const idx = buildIndex();

    /* 空查询：给一组「常去的地方」而不是空白，面板一开就有东西可点 */
    if (!needle) {
      const hot = idx.places.slice().sort(function (a, b) { return b.count - a.count; }).slice(0, 6);
      return [
        { group: "动作", items: ACTIONS.slice(0, 4) },
        { group: "题咏最多的地方", items: hot },
      ];
    }

    const hit = function (list, key) {
      const out = [];
      for (let i = 0; i < list.length; i++) {
        const it = list[i];
        const s = key ? score(key(it), needle) : score(it.hay, needle);
        if (s >= 0) out.push({ it: it, s: s });
      }
      out.sort(function (a, b) { return b.s - a.s; });
      return out;
    };

    /* 诗题命中权重最高：搜「静夜思」时不该被「李白」的其他诗挤下去 */
    const poems = hit(idx.poems, function (p) {
      const s1 = score(p.title, needle);
      if (s1 >= 0) return p.title;
      const s2 = score(p.author, needle);
      if (s2 >= 0) return p.author;
      return p.hay;
    }).slice(0, 8).map(function (r) { return r.it; });

    const authors = hit(idx.authors).slice(0, 5).map(function (r) { return r.it; });
    const places = hit(idx.places).slice(0, 5).map(function (r) { return r.it; });
    const tags = hit(idx.tags).slice(0, 6).map(function (r) { return r.it; });
    const acts = ACTIONS.filter(function (a) {
      /* kw 是给搜索用的别名：搜「唐朝」「词牌」也能命中对应开关 */
      return score(a.label, needle) >= 0 || (a.kw ? score(a.kw, needle) >= 0 : false);
    }).slice(0, 5);

    const groups = [];
    if (poems.length) groups.push({ group: "诗词", items: poems });
    if (authors.length) groups.push({ group: "诗人", items: authors });
    if (places.length) groups.push({ group: "地标", items: places });
    if (tags.length) groups.push({ group: "主题", items: tags });
    if (acts.length) groups.push({ group: "动作", items: acts });
    return groups;
  }, [open, q]);

  /* 摊平，键盘上下走的就是这个序列 */
  const flat = useMemo(function () {
    const out = [];
    results.forEach(function (g) { g.items.forEach(function (it) { out.push(it); }); });
    return out;
  }, [results]);

  useEffect(function () { setCursor(0); }, [q]);
  useEffect(function () { setCursor(function (c) { return Math.min(c, Math.max(0, flat.length - 1)); }); }, [flat.length]);

  /* 选中项滚进视野 */
  useEffect(function () {
    const box = listRef.current;
    if (!box) return;
    const el = box.querySelector('[data-cur="1"]');
    if (!el) return;
    const b = box.getBoundingClientRect(), r = el.getBoundingClientRect();
    if (r.top < b.top) box.scrollTop -= b.top - r.top + 6;
    else if (r.bottom > b.bottom) box.scrollTop += r.bottom - b.bottom + 6;
  }, [cursor, flat.length]);

  function run(item) {
    if (!item) return;
    closePalette();
    if (item.kind === "poem") {
      const p = POEMS.find(function (x) { return x.id === item.id; });
      const node = p && PLACE_BY_ID[p.__placeId];
      if (node) {
        const e = getEngine();
        if (e) e.goToPlace(node.id);
        openDetail(p.id, node.id);
      }
      return;
    }
    if (item.kind === "author") { clearFacets(); setAuthor(item.name); return; }
    if (item.kind === "tag") { clearFacets(); focusTag(item.tag); return; }
    if (item.kind === "place") {
      const node = PLACE_BY_ID[item.id];
      const e = getEngine();
      if (!node) return;
      if (e) e.goToPlace(node.id);
      /* 一处一首直接读；一处多首先把浮层摆出来（与点珠子一致） */
      if (node.poems.length === 1) openDetail(node.poems[0].id, node.id);
      else openPoemList(node.id);
      return;
    }
    if (item.kind === "act") item.run();
  }

  function onKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor(function (c) { return flat.length ? (c + 1) % flat.length : 0; });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor(function (c) { return flat.length ? (c - 1 + flat.length) % flat.length : 0; });
    } else if (e.key === "Enter") {
      e.preventDefault();
      run(flat[cursor]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      closePalette();
    }
  }

  /* 点背景收起 */
  function onBackdrop(e) {
    if (e.target === e.currentTarget) closePalette();
  }

  if (!open) return null;

  let idx = -1;
  return (
    <div id="palette" className="on" onMouseDown={onBackdrop} role="dialog" aria-modal="true"
      aria-label="命令面板">
      <div className="pal-box">
        <div className="pal-input">
          <IconSearch />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="搜诗词、诗人、地标、主题，或直接执行一个动作…"
            aria-label="命令面板搜索"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd>Esc</kbd>
        </div>

        <div className="pal-list" ref={listRef}>
          {!flat.length && (
            <div className="pal-empty">
              没有找到呢。<br />换个关键词，或直接搜「李白」「长安」「边塞」。
            </div>
          )}
          {results.map(function (g) {
            return (
              <section className="pal-group" key={g.group}>
                <h4>{g.group}</h4>
                {g.items.map(function (it) {
                  idx++;
                  const cur = idx === cursor;
                  return (
                    <button
                      key={(it.kind || "") + (it.id || it.name || it.tag || it.label)}
                      type="button"
                      className={"pal-item" + (cur ? " cur" : "")}
                      data-cur={cur ? "1" : "0"}
                      onMouseEnter={() => setCursor(idx)}
                      onClick={() => run(it)}
                    >
                      <span className={"pal-badge b-" + it.kind}>{KIND_LABEL[it.kind]}</span>
                      <span className="pal-main">
                        <span className="pal-t">{labelOf(it)}</span>
                        <span className="pal-m">{metaOf(it)}</span>
                      </span>
                      {it.hint && <kbd className="pal-k">{it.hint}</kbd>}
                      <IconChevron />
                    </button>
                  );
                })}
              </section>
            );
          })}
        </div>

        <div className="pal-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> 选择</span>
          <span><kbd>↵</kbd> 打开</span>
          <span><kbd>Esc</kbd> 收起</span>
          <span className="pal-foot-r">共 {POEMS.length} 首 · {PLACES.length} 处地标</span>
        </div>
      </div>
    </div>
  );
}

function labelOf(it) {
  if (it.kind === "poem") return it.title;
  if (it.kind === "author") return it.name;
  if (it.kind === "tag") return it.tag;
  if (it.kind === "place") return it.name;
  return it.label;
}

function metaOf(it) {
  if (it.kind === "poem") return it.dynasty + " · " + it.author + " · " + it.place;
  if (it.kind === "author") return it.count + " 首";
  if (it.kind === "tag") return it.count + " 首";
  if (it.kind === "place") return it.region + " · " + it.count + " 首";
  return "";
}
