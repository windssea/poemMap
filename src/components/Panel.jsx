/* ============================================================
   索引面板（左滑出）：篇目 · 诗人 · 主题
   ============================================================ */
import { useStore, closePanel, toggleDynasty, toggleForm, setAuthor, setTag, clearFacets } from "../store.js";
import { useFilteredPoems } from "../hooks/useFiltered.js";
import { placeText, poetIndex, themeIndex } from "../data/select.js";
import { AUTHORS } from "../data/index.js";
import { goToPoem } from "../actions.js";
import { IconChevron, IconClose } from "./icons.jsx";

const TITLES = { list: "篇目", poet: "诗人", theme: "主题" };
const DYNASTIES = ["全部", "唐", "宋"];
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
  const openPoemId = useStore("openPoemId");
  const list = useFilteredPoems();
  const on = !!mode;

  return (
    <aside id="panel" className={on ? "on" : ""} aria-hidden={!on} aria-label="索引面板">
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
            dynasty={dynasty} form={form} author={author} tag={tag}
            list={list} openPoemId={openPoemId}
          />
        )}
      </div>
    </aside>
  );
}

function PoetBody() {
  const poets = poetIndex();
  return (
    <>
      <p className="panel-note">共 {poets.length} 位诗人 · 按收录首数排序</p>
      {poets.map(function (it) {
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
      })}
    </>
  );
}

function ThemeBody({ tag, list, openPoemId }) {
  const themes = themeIndex();
  return (
    <>
      <p className="panel-note">共 {themes.length} 个主题 · 点选筛选</p>
      <div className="filters">
        {themes.map(function (it) {
          return (
            <button type="button" key={it.tag} data-tag={it.tag}
              aria-pressed={tag === it.tag}
              onClick={() => setTag(tag === it.tag ? "" : it.tag)}>
              {it.tag} {it.count}
            </button>
          );
        })}
      </div>
      {tag ? list.map(function (p) {
        return <Row key={p.id} poem={p} on={p.id === openPoemId} />;
      }) : null}
    </>
  );
}

function ListBody({ dynasty, form, author, tag, list, openPoemId }) {
  return (
    <>
      <div className="filters">
        <Chips values={DYNASTIES} cur={dynasty} onPick={toggleDynasty} />
        <span style={{ width: "8px" }} />
        <Chips values={FORMS} cur={form} onPick={toggleForm} />
      </div>

      {(author || tag) && (
        <p className="panel-note">
          筛选：
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
        return (
          <button type="button" key={v} data-val={v} aria-pressed={v === cur}
            onClick={() => onPick(v)}>
            {v}
          </button>
        );
      })}
    </>
  );
}
