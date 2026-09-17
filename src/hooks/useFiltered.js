/* ============================================================
   筛选结果（记忆化）
   ----------------------------------------------------------
   五个筛选条件任一变化才重算；153 首的过滤很快，但结果被
   多个组件共用（侧栏 / 统计 / 引擎），算一次就够了。
   ============================================================ */
import { useMemo } from "react";
import { useStore } from "../store.js";
import { selectFiltered } from "../data/select.js";

export function useFilteredPoems() {
  const q = useStore("q");
  const dynasty = useStore("dynasty");
  const form = useStore("form");
  const author = useStore("author");
  const tag = useStore("tag");
  return useMemo(function () {
    return selectFiltered({ q: q, dynasty: dynasty, form: form, author: author, tag: tag });
  }, [q, dynasty, form, author, tag]);
}
