/* ============================================================
   页面优化审计 · 候选清单（核心模型产出）
   ----------------------------------------------------------
   这一份是**我自己读完代码、跑完各视口截图之后写下的观察**，
   不是模型给的。每条都写了证据（文件 / 实测数据 / 截图状态），
   因为 Jev 只能判断「这条观察有多重要」，无法替我核实它是否属实。
   核实是我的活。

   字段：
     id          编号
     area        我粗分的类（只用来组织清单，不是最终分类）
     observation 一句话说清问题（给 Jev 判断用，必须是自洽的事实陈述）
     evidence    我是怎么知道的
     cost        修复成本 1–5 —— **由我按代码估**，不交给 Jev：
                 Jev 读不到仓库，估代码工作量不是它擅长的事。
                 1 = 改一行/纯配置
                 2 = 改一个组件或一处样式
                 3 = 跨几个文件的小改造，需要回归
                 4 = 涉及数据结构或架构调整
                 5 = 需要重做一块功能
     control     对照组（我已知正确答案，用来验证 Jev 的判断是否可信）
   ============================================================ */

export const APP_CONTEXT = {
  name: "中华诗词地图",
  what: "全离线单页应用：Leaflet 矢量中国地图，325 首诗词落在 155 处地标上；点地标读诗，右侧抽屉显示竖排诗文、背景故事、诗意简析、注释与赏析",
  audience: "青少年儿童（约 10–15 岁）、家长与语文老师",
  stack: "React 19 + Vite 8，无后端，零外部请求",
  already_done:
    "手卷装裱框、地标悬停卡、⌘K 命令面板、抽屉上下篇翻页、325 段背景故事、唐宋八大家作者群体筛选、窄屏顶部精简为一行搜索框",
  constraints: "全离线、零外链；任何改动要能通过现有的数据校验（check-data / qa-data）与生产构建",
};

export const CANDIDATES = [
  /* ── 死代码与仓库卫生 ── */
  {
    id: "C01", area: "技术债", cost: 2,
    observation: "中央诗词卡组件 #card 已停用（源码里 on 恒为 false），但组件文件与约 250 行 CSS 仍留在打包产物里",
    evidence: "src/components/Card.jsx 第 32 行 `const on = false;`；style.css 中 #card 相关规则仍在",
  },
  {
    id: "C02", area: "技术债", cost: 1,
    observation: "src/engine/eave.js 未被任何模块 import，是上一版设计的遗留文件",
    evidence: "全仓 grep 'eave' 只命中该文件自身与 README 的说明",
  },
  {
    id: "C03", area: "技术债", cost: 1,
    observation: "仓库根目录存在一个名为 `-` 的残留文件（2646 字节，内容是一串诗名清单），非项目文件",
    evidence: "git status 长期显示为未跟踪；内容为上一次会话重定向误产生的文本",
  },
  {
    id: "C04", area: "技术债", cost: 2,
    observation: "data/ js/ vendor/ 三个目录是 React 化之前的旧实现，已废弃不再被引用，但仍占据仓库约 1.5 MB",
    evidence: "README 第十节明确写「已废弃，保留只为对照与回滚」；index.html 不引用",
  },

  /* ── 体积与性能 ── */
  {
    id: "C05", area: "性能", cost: 4,
    observation: "主包 gzip 后 452 KB，其中约 200 KB 是 325 段背景故事与全部诗文；这些文本首屏只需要其中 1 首，其余要等到用户点开才用得上",
    evidence: "实测 dist/bundle：index 1287 KB → gzip 452 KB；数据文件 poems.tang/song/pre 合计 597 KB 源码",
  },
  {
    id: "C06", area: "性能", cost: 3,
    observation: "地图平移时，155 个地标与地名签的透明度/位置在每个节流帧里被逐个写入 DOM",
    evidence: "mapEngine.js 的 layoutLabels() 对每个可见地标写 label.style.opacity 与 el.style.opacity，由 move 事件经 frameTick%2 节流触发",
  },
  {
    id: "C07", area: "性能", cost: 2,
    observation: "Three.js 云气层常驻以 30fps 重绘整屏，即使用户只是静止读诗、没有任何交互",
    evidence: "atmosphere.js 的 rAF 时长闸门限 30fps；实测空转帧率 143fps、云气是唯一持续动的层",
  },
  {
    id: "C08", area: "性能", cost: 1,
    observation: "诗人索引与主题索引在每次组件渲染时都重新遍历 325 首统计一遍（poetIndex / themeIndex 无缓存）",
    evidence: "src/data/select.js 的 poetIndex/themeIndex 每次调用全量遍历；Panel.jsx 在渲染时直接调用",
  },

  /* ── 无障碍 ── */
  {
    id: "C09", area: "无障碍", cost: 3,
    observation: "地图上的 155 个诗词地标是 Leaflet divIcon（div 元素），不可 Tab 聚焦、屏幕阅读器也读不到，纯键盘用户无法通过地图选诗",
    evidence: "mapEngine.js 创建 marker 时 `keyboard: false`；icon 用 L.divIcon 渲染成 span",
  },
  {
    id: "C10", area: "无障碍", cost: 2,
    observation: "抽屉打开后键盘焦点没有移入抽屉，按 Tab 会继续走到底下地图与顶栏的控件上",
    evidence: "Detail.jsx 打开时只做 MOTION.cardIn 与 scrollTop 归零，没有 focus 管理",
  },
  {
    id: "C11", area: "无障碍", cost: 2,
    observation: "诗人/主题索引面板与命令面板打开时，背景内容没有被标记为 inert，屏幕阅读器仍可读到背后的地图与按钮",
    evidence: "Panel.jsx / Palette.jsx 只设 aria-hidden 于自身关闭态，未处理背景",
  },
  {
    id: "C12", area: "无障碍", cost: 2,
    observation: "次级文字色 --ink-4 (#b6a892) 用在米白纸底 (#f2e9d7) 上，对比度约 2.3:1，低于 WCAG AA 对正文要求的 4.5:1",
    evidence: "style.css 令牌定义；多处小字（落款元信息、键位提示、篇目行地点）使用该色",
  },
  {
    id: "C13", area: "无障碍", cost: 2,
    observation: "抽屉右上角的关闭按钮点击区域为 30×30 像素，小于移动端触控目标 44×44 像素的通行建议",
    evidence: "style.css .panel-close { width: 30px; height: 30px; }",
    control: { expect: "真问题", why: "触控目标过小是可测量的可用性缺陷，不属于审美偏好" },
  },

  /* ── 交互与功能缺口 ── */
  {
    id: "C14", area: "交互", cost: 3,
    observation: "诗人索引面板列出 114 位诗人，没有任何搜索或筛选，找一个不常见的作者要一直滚",
    evidence: "实测截图 shots/a-poet.png：面板只有标题、计数与长列表；Panel.jsx 的 PoetBody 无输入框",
  },
  {
    id: "C15", area: "交互", cost: 3,
    observation: "主题索引面板列出 64 个主题标签，没有搜索、没有分组，标签按首数降序平铺",
    evidence: "Panel.jsx 的 ThemeBody 直接 map 出 chips；themeIndex() 返回 64 项",
  },
  {
    id: "C16", area: "交互", cost: 3,
    observation: "一地多诗时弹出的磨砂浮层最多列 14 首，超出部分只能内部滚动，浮层内没有搜索或按朝代筛选",
    evidence: "README 与 PoemList.jsx：node.poems 全量渲染，CSS 限高；黄州 14 首、杭州 16 首",
  },
  {
    id: "C17", area: "交互", cost: 2,
    observation: "顶部搜索框只做 180ms 去抖后过滤，输入过程中没有任何联想建议或「正在查找」的反馈",
    evidence: "Tools.jsx 的 onInput 用 setTimeout 180ms 推给 store；无建议下拉",
  },
  {
    id: "C18", area: "交互", cost: 2,
    observation: "左侧篇目栏的 ↑↓ 键只在篇目栏展开时生效；收起状态下按 ↑↓ 完全没有反应",
    evidence: "Sidebar.jsx 的 keydown 监听以 if (!sideOpen) return 开头",
  },
  {
    id: "C19", area: "交互", cost: 3,
    observation: "在多地浮层里选了一首诗之后浮层立即消失，想在同处换一首读必须重新点回地标",
    evidence: "actions.js 的 choosePoem 直接 openDetail，store.openDetail 会把 poemListPlaceId 置空",
  },
  {
    id: "C20", area: "交互", cost: 4,
    observation: "长诗（如 88 句的琵琶行）在抽屉里只能横向拖动，没有跳到某一段或按句检索的手段，只有一条进度条",
    evidence: "实测 #/p/pipa-xing：scrollWidth 3859 / clientWidth 1171，仅左缘渐隐与进度条",
  },
  {
    id: "C21", area: "交互", cost: 2,
    observation: "抽屉底部读完落款之后没有「回到地图」或「收起」的动作，只能去右上角找关闭按钮或按 Esc",
    evidence: "Detail.jsx 的 .d-colophon 之后即结束，无收尾动作",
  },
  {
    id: "C22", area: "交互", cost: 2,
    observation: "抽屉里「此处另有 N 首」是与标签、翻页钮同级的虚线药丸，视觉权重接近，容易被当成装饰而忽略",
    evidence: "style.css .others-more 用 dashed 边框与浅色底；截图里与上方标签挤在一起",
  },

  /* ── 视觉与表达 ── */
  {
    id: "C23", area: "视觉", cost: 2,
    observation: "窄屏隐藏了题名与副题之后，页面上完全没有站点标识，把页面加到主屏或分享出去时认不出是什么",
    evidence: "style.css @media 820 里 #brand { display: none }；实测窄屏截图左上角为空",
  },
  {
    id: "C24", area: "视觉", cost: 1,
    observation: "窄屏装裱框内缩到 7px，而搜索框距顶 12px，两者只差 5px，框线与控件视觉上贴得很紧",
    evidence: "style.css #mount { inset: 7px } 与 #tools { top: 12px }",
  },
  {
    id: "C25", area: "视觉", cost: 1,
    observation: "装裱框四角的包角线是 1 像素宽，在部分屏幕上几乎看不见，四角看起来是断的",
    evidence: "style.css .mt-corner 用 border-*-width: 1px",
    control: { expect: "审美偏好", why: "线宽 1px 还是 1.5px 是纯口味问题，不影响任何任务完成" },
  },

  /* ── 内容与元信息 ── */
  {
    id: "C26", area: "内容", cost: 1,
    observation: "曾巩《城南》的写作地被标为福州，但相当一部分教辅与选本注为齐州（今济南），两说并存",
    evidence: "补编写手定为「熙宁十年曾巩知福州」；本轮联网核实时 docs 与百科在本环境均不可达",
  },
  {
    id: "C27", area: "内容", cost: 1,
    observation: "index.html 只有 title 与 description，没有 Open Graph / 结构化数据，分享到社交平台时不显示卡片",
    evidence: "index.html 仅含 title、description、theme-color、内联 SVG favicon",
  },
  {
    id: "C28", area: "内容", cost: 4,
    observation: "应用完全离线可用，但没有 manifest 与 service worker，不能安装到主屏、也不能在断网后从缓存打开",
    evidence: "仓库无 manifest.json / sw.js；wrangler.jsonc 仅做静态托管",
  },
];
