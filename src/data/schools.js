/* ============================================================
   作者群体（流派 / 并称）
   ----------------------------------------------------------
   为什么单开一层，而不是塞进 tags.js：
   tags 是**作品的主题**（行旅 / 山水 / 登临…），而「唐宋八大家」是
   **作者的身份**。混在一起，主题索引里就会冒出一条既不是主题、
   也没法用主题去理解的条目。
   单开一层之后，筛选、面板说明、命令面板都能干净地引用它，
   以后要加「初唐四杰」「苏门四学士」「南宋四大家」也只在这里补一行。
   ============================================================ */

export const SCHOOLS = {
  唐宋八大家: ["韩愈", "柳宗元", "欧阳修", "苏洵", "苏轼", "苏辙", "王安石", "曾巩"],
};

export const SCHOOL_NAMES = Object.keys(SCHOOLS);

/** 作者 → 所属群体（不属于任何群体返回空串） */
export function schoolOf(author) {
  const names = Object.keys(SCHOOLS);
  for (let i = 0; i < names.length; i++) {
    if (SCHOOLS[names[i]].indexOf(author) !== -1) return names[i];
  }
  return "";
}

/** 该群体在数据里实际收到了几首（给界面显示用） */
export function schoolCount(poems, name) {
  const members = SCHOOLS[name] || [];
  return poems.filter(function (p) { return members.indexOf(p.author) !== -1; }).length;
}
