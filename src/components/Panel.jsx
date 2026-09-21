/* ============================================================
   索引面板（左滑出）：篇目 · 诗人 · 主题
   ============================================================ */
import { useMemo, useRef, useState } from "react";
import { useStore, closePanel, toggleDynasty, toggleForm, setAuthor, setTag, clearFacets } from "../store.js";
import { useFilteredPoems } from "../hooks/useFiltered.js";
import { useFocusReturn } from "../hooks/useFocusReturn.js";
import { placeText, poetIndex, themeIndex } from "../data/select.js";
import { AUTHORS, ERA_COUNT } from "../data/index.js";
import { ERAS } from "../data/eras.js";
import { goToPoem } from "../actions.js";
import { IconChevron, IconClose, IconSearch } from "./icons.jsx";

const TITLES = { list: "篇目", poet: "诗人", theme: "主题" };
/* 与筛选条同一套时代组；先唐只在真有作品时出现 */
const DYNASTIES = ERAS.filter(function (e) {
  return e.val !== "先唐" || (ERA_COUNT.先唐 || 0) > 0;
});
const FORMS = ["全部", "诗", "词"];

function Row({ poem, on }) {
  return (
    <button className={"row" + (on ? " on" : "")} type="button" data-id={poem.id}
      onClick={() => goToPoem(poem.id)}>
      <span className="row-main">
        <span className="t">{poem.title}</span>
        <span className="m">{poem.dynasty} · {poem.author} · {placeText(poem)}</span>
      </span>
      <IconChevron />
    </button>
  );
}

export default function Panel() {
  const mode = useStore("panel");
  const dynasty = useStore("dynasty");
  const form = useStore("form");
  const author = useStore("author");
  const tag = useStore("tag");
  const school = useStore("school");
  const openPoemId = useStore("openPoemId");
  const list = useFilteredPoems();
  const ref = useRef(null);
  const on = !!mode;

  /* 与抽屉同一套：打开时焦点移入，关闭时还给打开它的按钮（C10） */
  useFocusReturn(on, ref, { delay: 80 });

  return (
    <aside id="panel" ref={ref} className={on ? "on" : ""} aria-hidden={!on}
      inert={!on}
      aria-label="索引面板" tabIndex={-1}>
      <header className="panel-head">
        <h2 id="panelTitle">{TITLES[mode] || "篇目"}</h2>
        <button id="panelClose" className="panel-close" type="button" aria-label="关闭" onClick={closePanel}>
          <IconClose />
        </button>
      </header>

      <div id="panelBody" className="panel-body">
        {mode === "poet" && <PoetBody />}
        {mode === "theme" && (
          <ThemeBody tag={tag} list={list} openPoemId={openPoemId} />
        )}
        {mode === "list" && (
          <ListBody
            dynasty={dynasty} form={form} author={author} tag={tag} school={school}
            list={list} openPoemId={openPoemId}
          />
        )}
      </div>
    </aside>
  );
}

/* 面板里的检索框（C14 / C15）
   ----------------------------------------------------------
   诗人索引 114 位、主题索引 64 个：原来只能上下翻。数量到三位数之后，
   「找一个人」比「筛出他的诗」还费劲——所以给两个面板各加一个搜索。
   这是**面板内的局部筛选**，不进 store：它不改变「当前收录哪些诗」，
   只改变「这一栏里显示哪几行」，退出面板就作废。 */
function SearchBox({ value, onChange, placeholder, count, total }) {
  return (
    <div className="panel-search">
      <IconSearch />
      <input type="search" value={value} placeholder={placeholder}
        aria-label={placeholder} autoComplete="off"
        onChange={(e) => onChange(e.target.value)} />
      {value ? (
        <>
          <span className="ps-n">{count} / {total}</span>
          <button type="button" className="ps-x" aria-label="清空"
            onClick={() => onChange("")}>
            <IconClose />
          </button>
        </>
      ) : null}
    </div>
  );
}

function PoetBody() {
  const poets = poetIndex();
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const hits = useMemo(function () {
    if (!needle) return poets;
    return poets.filter(function (it) { return it.name.toLowerCase().indexOf(needle) > -1; });
  }, [poets, needle]);

  return (
    <>
      <SearchBox value={q} onChange={setQ} placeholder="搜诗人姓名"
        count={hits.length} total={poets.length} />
      <p className="panel-note">共 {poets.length} 位诗人 · 按收录首数排序</p>
      {hits.length ? hits.map(function (it) {
        return (
          <button className="row" type="button" key={it.name} data-author={it.name}
            onClick={() => setAuthor(it.name)}>
            <span className="row-main">
              <span className="t">{it.name}</span>
              <span className="m">{(AUTHORS[it.name] || {}).years || ""}</span>
            </span>
            <span className="n">{it.count}</span>
          </button>
        );
      }) : <div className="panel-empty">没有这位诗人呢。<br />换个字试试，或看看「全部」。</div>}
    </>
  );
}

function ThemeBody({ tag, list, openPoemId }) {
  const themes = themeIndex();
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const hits = useMemo(function () {
    if (!needle) return themes;
    return themes.filter(function (it) { return it.tag.toLowerCase().indexOf(needle) > -1; });
  }, [themes, needle]);

  return (
    <>
      <SearchBox value={q} onChange={setQ} placeholder="搜主题词"
        count={hits.length} total={themes.length} />
      <p className="panel-note">共 {themes.length} 个主题 · 点选筛选</p>
      <div className="filters">
        {hits.map(function (it) {
          return (
            <button type="button" key={it.tag} data-tag={it.tag}
              aria-pressed={tag === it.tag}
              onClick={() => setTag(tag === it.tag ? "" : it.tag)}>
              {it.tag} {it.count}
            </button>
          );
        })}
      </div>
      {!hits.length && <div className="panel-empty">没有这个主题呢。<br />换个字试试。</div>}
      {tag ? list.map(function (p) {
        return <Row key={p.id} poem={p} on={p.id === openPoemId} />;
      }) : null}
    </>
  );
}

function ListBody({ dynasty, form, author, tag, school, list, openPoemId }) {
  return (
    <>
      <div className="filters">
        <Chips values={DYNASTIES} cur={dynasty} onPick={toggleDynasty} />
        <span style={{ width: "8px" }} />
        <Chips values={FORMS} cur={form} onPick={toggleForm} />
      </div>

      {(author || tag || school) && (
        <p className="panel-note">
          筛选：
          {school || ""}
          {school && (author || tag) ? " · " : ""}
          {author || ""}
          {author && tag ? " · " : ""}
          {tag || ""}
          {" "}
          <button type="button" className="clear-filter"
            style={{ color: "var(--seal)", background: "none", border: "none", fontSize: "12px" }}
            onClick={clearFacets}>
            清除
          </button>
        </p>
      )}

      {list.length
        ? list.map(function (p) {
            return <Row key={p.id} poem={p} on={p.id === openPoemId} />;
          })
        : <div className="panel-empty">没有找到呢。<br />换个关键词，或试试「全部」。</div>}
    </>
  );
}

function Chips({ values, cur, onPick }) {
  return (
    <>
      {values.map(function (v) {
        /* 时代组传的是 { val, label }，体裁传的是裸字符串 */
        const val = typeof v === "string" ? v : v.val;
        const label = typeof v === "string" ? v : v.label;
        return (
          <button type="button" key={val} data-val={val} aria-pressed={val === cur}
            onClick={() => onPick(val)}>
            {label}
          </button>
        );
      })}
    </>
  );
}
