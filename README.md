# 中华诗词地图 · 唐风宋韵

一个面向青少年儿童的中国诗词地图网页。青绿山水长卷上标注唐诗宋词的诞生地标，
点击地标即弹出竖排诗词卡（右起，与古籍一致），再看右侧磨砂玻璃抽屉里的标签、
诗意简析与完整注释。

**全部离线**：地图、诗词、作者、标签、素材均为本地文件，跑起来后**零外部请求**
（无瓦片、无 CDN、无字体外链）。用 `CDP_VERBOSE=1` 可以把页面全部网络请求打出来核对——
生产版只有 12 个请求，全部指向本机。

---

## 一、快速开始

```bash
npm install
npm run dev        # http://127.0.0.1:5179/   开发（HMR）
npm run build      # 产出 dist/（纯静态，零外链）
npm run preview    # 本地预览 dist/（同端口 5179）
```

`vite.config.mjs` 里 `base: "./"`，所以 `dist/` 放到任意静态服务器、放子目录、
甚至直接双击 `dist/index.html` 都能跑（`file://` 下同样有效）。

---

## 二、技术架构

**React 19 + Vite 8**，但**不是全盘 React 化**。分两层：

```
┌─ 声明式外壳（React）────────────────────────────┐
│  题名 · 筛选条 · 篇目栏 · 统计 dock · 诗词卡      │
│  多地浮层 · 详情抽屉 · 索引面板 · 吐司 · 点景      │
└───────────────┬─────────────────────────────────┘
                │  useSyncExternalStore 订阅
        ┌───────┴────────┐
        │  src/store.js  │  单一数据源（唯一真相）
        └───────┬────────┘
                │  subscribe()
┌───────────────┴─ 命令式引擎（不进 React diff）────┐
│  Leaflet 地图 · Three.js 云气 · GSAP 动效         │
│  山脊剪影 · 定位计算（anchor）                     │
└──────────────────────────────────────────────────┘
```

**为什么不全塞进 React**：Leaflet 管着上千个 DOM 节点与自己的投影/事件系统，
Three.js 管着 WebGL 上下文。让它们走 React 的 diff 只会带来双重真相与整片重挂载。
所以地图与三维保持**单例命令式模块**，只通过 `store` 与 React 交换「筛选条件 / 选中项」
这两件真正需要共享的事——React 重渲染不会碰到地图，地图平移也不会上抛状态。

| 层 | 位置 | 职责 |
| --- | --- | --- |
| 状态 | `src/store.js` | `getState / subscribe / useStore(key)`；所有动作是纯函数式 `setState` |
| 数据 | `src/data/` | 诗词、作者、标签、省界、地标聚合、筛选纯函数（`selectFiltered`） |
| 引擎 | `src/engine/` | 地图、云气、动效、山体、定位——命令式单例 |
| 界面 | `src/components/` | 12 个组件，各管一块，不碰引擎内部 |
| 动作 | `src/actions.js` | 同时牵动「状态 + 地图」的跨层操作（点地标、飞过去、换一批） |
| 工具 | `src/lib/` | 字符串转义、窄屏判定、几何抽稀与重采样 |

---

## 三、目录结构

```
poemMap/
├── index.html              Vite 入口（含「动效引导」内联脚本，防开场闪白）
├── vite.config.mjs         构建配置（base: "./"、手动分包、端口 5179）
├── server.js               零依赖静态服务器（`npm run serve`，不装依赖时的兜底预览）
├── src/
│   ├── main.jsx            挂载点（不用 StrictMode——避免 Leaflet/WebGL 双初始化）
│   ├── App.jsx             版式装配 + 引擎启停 + 全局副作用（键盘/尺寸/地址栏/降载）
│   ├── store.js            单一数据源 + useStore
│   ├── actions.js          跨层动作
│   ├── devtools.js         开发期诊断钩子（仅 DEV 生效，生产被 tree-shake）
│   ├── data/
│   │   ├── index.js        聚合入口：POEMS / POEM_BY_ID / tagsOf / 计数
│   │   ├── poems.tang.js   唐诗数据
│   │   ├── poems.song.js   宋词数据（含苏轼 37 首）
│   │   ├── authors.js      作者资料库（生卒年 + 简介）
│   │   ├── tags.js         每首诗的主题标签（行旅/山水/登临…）
│   │   ├── china.geo.js    中国省界离线数据（368 KB）
│   │   ├── geo-extras.js   长江/黄河/珠江/淮河/京杭大运河/长城 示意线
│   │   ├── places.js       地标聚合（同坐标合并 + 确定性取名）
│   │   └── select.js       筛选纯函数与各类派生索引
│   ├── engine/
│   │   ├── mapEngine.js    Leaflet 命令式层（pane 次序、省区渐变、marker、避让、订阅同步）
│   │   ├── terrain.js      山体生成器（脊线 → 远山 / 主山 / 背光坡 / 皴 / 亮脊 + 山名锚点，全程序绘制）
│   │   ├── atmosphere.js   Three.js 云气层（雾霭·流云·落英·墨点·光尘·墨晕）
│   │   ├── motion.js       GSAP 动效层（开场序列·地标入场·诗词卡展开·篇目浮现·涟漪）
│   │   ├── anchor.js       定位：诗词卡居中于可视区、多地浮层贴地标
│   │   ├── refs.js         命令式定位要读的 DOM 登记表
│   │   ├── thumbs.js       篇目行的缩略图（本地 Canvas 生成）
│   │   ├── mapimage.js     可选：用「地理配准准确」的底图整图替换
│   │   └── eave.js         金黄屋檐 SVG 生成器（当前设计未启用，见第十节）
│   ├── components/         12 个组件（Brand/Tools/Sidebar/BottomBar/Card/
│   │                       PoemList/Detail/Panel/Toast/Chrome/Paint/icons）
│   ├── hooks/              useFiltered（memo 化筛选）· useCountUp（首屏数字滚动）
│   ├── lib/                dom.js（转义/窄屏）· geo.js（抽稀/平滑）
│   └── styles/style.css    全部样式
├── public/assets/          设计素材（本地图片，全部离线，原样拷入 dist/）
├── tools/                  构建与调试工具（站运行时不依赖）
│   ├── build.js            生产构建（`node tools/build.js`；长命令行在本机 shell 里偶发被截断）
│   ├── port-to-esm.js      一次性迁移脚本（旧全局脚本 → src/ 下的 ESM，逐字段校验）
│   ├── cdp.js              无头 Chrome 验证器（取数 / 截图 / 模拟移动端与减弱动效）
│   ├── steps/              可组合的「准备步骤」（async，等 React 提交两帧再继续）
│   │   ├── _pre.js         公共工具（__raf/__wait/__click/__press/__marker/__pick/__state）
│   │   ├── view.js         把地图移到指定视野（`CDP_STEP_ARG="lat|lng|zoom"`，截图前用）
│   │   └── place / pick / detail / notes / cardclick / detailclick / side / sideclick
│   ├── probes/             单条量测表达式（几何 / 性能 / 交互延迟 / 关闭路径）
│   │   ├── card-center.js    卡片是否居中、是否竖排右起
│   │   ├── detail-geo.js     抽屉磨砂参数、宽度自适应、诗栏横向滚动
│   │   ├── perf.js           帧率 + 长任务 + 云气画布规模
│   │   ├── interact.js       筛选切换延迟
│   │   ├── dismiss-flash.js  逐帧采样：点地图收面板时卡片会不会「闪一下」
│   │   └── dismiss-paths.js  回归：各条「收起来」的路径分别该关到什么程度
│   ├── qa-motion.js        动效与交互自检脚本（配合 cdp.js 使用）
│   ├── qa-perf.js 等       性能探针：空转 / 拖动 / 事件 / 关云气对照
│   ├── build-geo.js        由原始行政区划 JSON 生成 src/data/china.geo.js
│   ├── china-raw.json      原始行政区划数据（构建输入）
│   ├── prepare-assets.js   整理素材：改英文名、自动裁掉地图画稿里的游离山石
│   ├── calibrate-map.js    解算画稿的地理 bounds（陆/海取样 + 粗到细网格搜索）
│   ├── check-landmarks.js  校验诗词地标是否落在画中陆地
│   ├── check-ranges.js     校验山系：脊线落在哪个省、长度与宽度是否合真实量级
│   ├── palette-from-painting.js  从画稿取「区域色」与「山峦色阶」
│   └── pixdump.js          截图取色工具
└── data/ js/ vendor/       旧版全局脚本实现，**已废弃**（保留作对照，见第十节）
```

依赖全部走 npm（`leaflet` / `three` / `gsap` / `react` / `react-dom`），不再需要 `vendor/`。

---

## 四、如何新增一首诗词

**第一步**：作者登记在 `src/data/authors.js`。

**第二步**：在 `src/data/poems.tang.js` / `poems.song.js` 数组末尾追加：

```js
{
  id: "liangzhou-ci-wangzhihuan",   // 全局唯一
  title: "凉州词",
  dynasty: "唐",                     // 唐 | 宋
  author: "王之涣",                   // 必须在 authors.js 中存在
  form: "诗",                        // 诗 | 词
  place: {
    name: "凉州",                    // 地标名，显示在地图上
    region: "甘肃 · 武威",            // 今属地区
    lat: 37.93, lng: 102.64,        // 纬度 / 经度（WGS-84）
    origin: "盛唐边塞诗代表作……"      // 写作背景（可留空）
  },
  lines: ["黄河远上白云间，", "一片孤城万仞山。", "羌笛何须怨杨柳，", "春风不度玉门关。"],
  prologue: "",                      // 词的小序（可省略）
  tr: "黄河好像从远方的白云间奔流而来……",   // 白话译文（卡片「诗意简析」用）
  notes: [["羌笛", "古代西部羌族吹奏的管乐器。"]],
  appr: "以壮阔苍凉的边塞图景写戍人哀怨……"
}
```

**第三步**（可选）：在 `src/data/tags.js` 里给这首诗加主题标签：

```js
"liangzhou-ci-wangzhihuan": ["边塞", "思乡"],
```

保存即热更新，页面上立刻出现——**不需要重新构建**。

### 地标自动合并规则
两首诗坐标相差小于 0.15°（纬度）与 0.2°（经度）时视为同一地标，地图上只出现一枚小筑，
右上角显示数量徽章；点击弹出浮卡列出该处全部诗词。想让两首诗分开显示，把坐标写准即可（阈值约 15 公里）。

---

## 五、界面与设计对应

| 设计稿元素 | 实现位置 |
| --- | --- |
| 左上朱印「诗」+ 标题 + 竖排小联 | `#brand`、`.seal-big`、`.couplet` |
| 右上搜索框（末端山形标记） | `#tools .search`、`.search-mark` |
| 筛选条（全部/唐诗/宋词 ｜ 全部/诗/词）+ 更多菜单 | `.chipbar`、`#chipsDynasty`、`#chipsForm`、`#menuBtn` |
| 左侧篇目栏（**默认收起**，由左下 dock 唤出） | `#sidebar`、`#tabs`、`#list` |
| 篇目行：篇名 / 唐·李白 / 📍地名 / 箭头 | `#list .item` |
| 左下统计 dock：篇目开关 + 唐宋计数 + N 首/N 地 + 换一批 | `#bottomBar`、`#sideToggle`、`#shuffleBtn` |
| 多诗地标：高透玻璃感磨砂浮层列表 | `#poemList`、`.pl-head`、`.pl-item` |
| 中央诗词卡（**居中**、**一律竖排右起**，宽随句数伸缩、高不超屏） | `#card`、`#cardPoem`、`#cardOthers` |
| 右侧**磨砂玻璃**详情抽屉（宽随诗长，上下同宽；竖排诗 + 注释 / 赏析 / 写作背景 / 作者） | `#detail`、`.d-col`、`#dPoem`、`#dMore` |
| 诗人 / 主题索引面板 | `#panel` |
| 右缘竖排「诗在山河间／山河亦成诗」 | `#sideVerse` |
| 罗盘 · 缩放 | `#compass`、`#zoomer` |
| 更多菜单（诗人 / 主题 / 动效 / 回到全国 / 关于） | `#menuPop` |

### 组件对应（React）

| 组件 | 文件 | 管什么 |
| --- | --- | --- |
| `Brand` | `components/Brand.jsx` | 朱印 + 标题 + 竖排小联 |
| `Tools` / `MenuPop` | `components/Tools.jsx` | 搜索、朝代/体裁筛选、动效开关、更多菜单 |
| `Sidebar` | `components/Sidebar.jsx` | 篇目栏（默认收起，`memo` 化的 `Item` 逐行渲染） |
| `BottomBar` | `components/BottomBar.jsx` | 统计 dock：篇目开关、唐宋计数、N 首/N 地、换一批 |
| `Card` | `components/Card.jsx` | 中央诗词卡（竖排右起；开合时调 `placeCard()` 重新居中） |
| `PoemList` | `components/PoemList.jsx` | 多地浮层（贴地标） |
| `Detail` | `components/Detail.jsx` | 磨砂玻璃详情抽屉 |
| `Panel` | `components/Panel.jsx` | 诗人 / 主题索引面板 |
| `Chrome` | `components/Chrome.jsx` | 右缘竖排诗句、罗盘、缩放 |
| `Paint` | `components/Paint.jsx` | 地图容器 + 四边点景覆盖层 |
| `Toast` | `components/Toast.jsx` | 吐司提示 |

### 交互要点
- **地标**：一枚朱红圆点（`.dot`），一处题咏多首时右上角带数量徽章（`.dot-count`）。选中后放大、泛起光晕与涟漪，下方浮出地名签。
- **一处多诗**：点击带徽章的地标先弹出**磨砂浮层**，列出该处全部诗词；点其中一首才展开诗词卡；卡片底部「此处另有 N 首 ›」可再回到浮层（浮层最多 14 首，超出时内部滚动、表头吸顶）。
- **一律竖排**：诗词卡与详情抽屉的诗文**全部竖排（右起，与古籍一致）**，不再按句数转横排——句数越多，容器就越宽。
- **诗词卡居中**：卡片不再贴着地标，而是摆在**地图可视区正中**（左让开篇目栏、上让开工具条、下让开底栏）；展开/收起篇目栏时会重新居中。
- **诗词卡高度受控、宽度伸缩**：`max-height: min(92vh, 960px)`（高不超屏）；卡片「收缩到内容宽」，真正撑宽度的是竖排诗——`max-width` 上限 1320px，够 22 句的《念奴娇》整首放下；句数 ≥18 的长词把列收紧一档（字号 18px）。极长的诗（如《琵琶行》88 句）在卡内**只横向滚动，不纵向溢出**。
- **打开详情即收起诗词卡**：点卡片「查看完整注释」进入右侧抽屉时，中央诗词卡自动关闭，画面只留一张抽屉。
- **详情抽屉：磨砂玻璃、宽度自适应、上下与诗同宽、无竖滚动**：`backdrop-filter: blur(18px) saturate(1.35)` 半透玻璃；抽屉宽度＝**中间竖排诗的宽度**（短诗约 630px、念奴娇 22 句约 1000px、长诗封顶 1240px），标题、地名、标签、注解区一律对齐这一宽度并沿中轴居中；正文块限宽 560px 保证可读；竖排诗超宽时只在诗栏内**横向**滚动，抽屉本身不出现竖向滚动条。
- **诗栏不蹦滚动条**：诗栏（`.c-poem` / `.d-poem`）竖向一律 `overflow-y: hidden`，内边距把入场动效的位移（下 16px）与 ±2° 倾斜都收进去——否则变换出的那一两像素会凭空长出一条竖向滚动条，短诗也会、出现后还把诗栏顶宽 10px。句数放得下时不出现任何滚动条；放不下时横向滚动条从第一帧就在，不会「先冒出来再缩回去」。
- **点地图空白**：卡片、多地浮层、右侧抽屉**一并收起**。
  这条必须是**一次原子状态变更**（`store.dismissOverlays()`），不能拆成 `closeCard() + closePoemList() + closeDetail()`
  分三次 setState——原因见第七·五节「卡片为什么会闪一下」。
- **篇目栏默认收起**：开场只出现左下的「篇目」dock 按钮，点它才滑出篇目栏（面板由 CSS 滑入，篇目行再依次浮现）。
- **地图标语**：地名签按题咏数量优先排布，压盖时先退为单行地名，再退为不显示；默认视野约 12 个，放大后增多。
- **查看完整注解**：抽屉标题下的「查看完整注释」药丸按钮，展开字词注释、赏析、写作背景（作者一节常驻显示）。
- 顶栏 chip 与侧栏 tab 共用同一筛选状态，双向同步。

---

## 六、地图是怎么画的

不加载任何瓦片或图片，全部由矢量程序绘制。图层次序即画法：

```
省区底色(400) → 山体(410) → 水系(418) → 长城(425) → 国境(430) → 地名(470)
```

- **省区底色**：按东北/华北/华东/华中/华南/西南/西北分区设色，颜色**取自设计画稿**
  （`tools/palette-from-painting.js` 逐省取样）。每省再注入一枚**不规则径向渐变**
  （亮心 + 偏暗边缘，中心按 adcode 抖动），省界只留一线淡痕（`opacity: .5`）——
  于是色块之间是**晕染过渡**，不再是呆板的平涂。
  轮廓另按 0.05° 容差做 **Douglas–Peucker 抽稀**（24950 点 → 6069 点）：
  省区只是色块，不需要原始精度，而缩放时每个点都要重投影一遍。
- **山体**（`src/engine/terrain.js`）：22 条山系写成「名称 + 脊线 + 宽度」。脊线先用
  **Catmull-Rom 插值**揉圆（手写的四五个控制点直接连起来，山脚会是一条可见的折线），
  再沿脊线**密采样**生成**山脊剪影**——顶边用正弦起伏的峰谷勾出山脊，下压一条山脚闭合为山体。
  立体感由四层叠出来，全部是**几何**而非滤镜：

  | 层 | 做法 | 作用 |
  | --- | --- | --- |
  | 远山 | 同一条脊线整体北抬 0.20 个山宽、起伏略大，用另一组种子错开峰谷，色阶更亮更偏青灰 | 纵深（空气透视） |
  | 主山 | 整条一个面，纵向渐变山巅→山腰→山阴，末端 `stop-opacity: .10` 收进地面 | 体量 + 山脚羽化 |
  | 背光坡 | 每座峰「峰顶→谷」的那半个坡单独成面，覆一层 `#44614f / opacity .12` | 每座峰有面向 |
  | 脊线 | 墨线 + 峰受光侧一条近白细线 + 背光侧顺坡向下的短皴线 | 山脊立起来 |

  青绿设色：山阴 `#7ea691` / 山腰 `#a3c3a8` / 山巅 `#cfe2cd`；远山另有一档更淡更偏青灰的色阶。
  体量也沿脊线起伏（等宽的话整条是纺锤形，像片叶子）。
  两个坑记在这里：

  - **背光坡必须用纯色**——上百个面各自引用 `url(#渐变)`，每次都要按自己的包围盒重算，
    实测把帧耗时从 8.9 拉到 20.8ms；改纯色后 path 体积也小得多。
  - **主山不能按峰切分**——切分后每段各自羽化，段与段的「透明终点」强度不同，山脚会露出生硬接缝。
    改成「整条一个面 + 半坡覆层」，接缝自然消失。
- **山名**：与地形同源（每条山系的 `name`），锚点默认取脊线中点沿法线抬到山脊之上，
  个别拥挤处可用 `label: [lat, lng]` 覆盖。避让用**独立的占位池**（只与别的山名、以及地标的圆点互斥）——
  若连地标文字一起避让，全国视野下 13 条主要山脉会被挤得只剩六七个；独立池能标出 20 条左右，
  小字压在大字上仍分得清。乘数小于 4.1 时不显示山名。
- **山系的「位置 / 大小」怎么核对**：`node tools/check-ranges.js`——把每条脊线按同样的
  Catmull-Rom 插值采样，逐点做「点在多边形内」求出落在哪些省，并沿脊线累加长度、
  把 `w` 换算成公里，与该山脉的真实量级（脚本里的 `EXPECT` 表）比对。长条形的山要
  **长而窄**（阴山、贺兰山、六盘山、中央山脉早先都被画成了「短而胖」的一团），
  国境线上的越界（长白山伸进朝鲜一侧、阿尔泰山伸进哈萨克一侧）属正常。

> **为什么不用 `filter: blur()` 做羽化**：整屏 SVG 挂实时滤镜，每次缩放都要重新光栅化
> 三十多条省界与四十多座山，是拖动/缩放卡顿的主因。羽化改由「渐变 + 同色柔边」
> 在几何层面表达，观感几乎一致，开销归零。
- **水系**：长江/黄河/珠江/淮河与运河先经 **Catmull-Rom 重采样**平滑，再以「柔晕 + 细实线」双层描出，
  转弯处不再有折角；运河作虚线。
- **长城**：暖色双层——外层 `#d98b5f` 阔笔柔晕 + 内层 `#b8472e` 砖红虚线，比国境更醒目。
- **地名**：32 个省名（放大后浮现）+ 河流名 + 22 条山名 + 诗词地标地名签。

### 素材里的那张「青绿中国地图」怎么处理？
它**不作为底图**。用 `tools/calibrate-map.js` 做过配准：以一批已知陆/海坐标做粗到细搜索，
`tools/check-landmarks.js` 再检验 67 处诗词地标的落点。结论是——画稿的经纬比例与真实中国不一致
（东海岸外凸、西南与北端被简化），整图替换会让地标对不上位置。所以改为**只参考它的设色**
（区域色 + 山峦色阶），既得画稿气韵，又保住地理准确与任意缩放清晰。

```js
// 若日后拿到地理配准准确的底图，src/engine/mapimage.js 里填上即可整图替换
window.MAP_OVERLAY = { url: "assets/xxx.png", bounds: [[南纬, 西经], [北纬, 东经]] };
```

---

## 七、动效与三维

在「青绿山水」之上又叠了两层，互不依赖，任何一层加载失败都不影响阅读：

```
Leaflet 矢量地图 → ①Three.js 云气层(#atmosphere, z300) → 纸纹晕染(z460) → 界面
                                                                        ②GSAP 动效层
```

### ① Three.js 云气层（`src/engine/atmosphere.js`）
- 一整幅透明的 WebGL 画布浮在地图上，用**真三维透视相机**摆放精灵：
  远山雾霭（z≈-300）→ 流云（z≈-100）→ 墨点 → 落英（z≈0~150）→ 光尘（加色混合）。
- **视差**：鼠标移动会让相机轻微偏移，远近层自然错开；地图平移时云气也会「跟不上」，
  形成景深——这是用 Three.js 而非平面动画的主要理由。
- **纹理全部由 Canvas 现场生成**（`feTurbulence` 式噪声团、贝塞尔花瓣、环形墨晕），
  因此不引入任何图片文件，离线约束不变。
- 选中地标时，在该位置（经投影换算到世界坐标）散开一圈**墨晕**，1.1 秒扩散淡出。
- 性能：桌面约 56 枚精灵、移动端自动降到 0.55 倍；像素比上限 1.25；**限帧 30fps**
  （云气是慢动作，120/144Hz 屏上按刷新率重绘＝每秒白重绘整屏上百次）；页面切到后台自动暂停；
  WebGL 不可用时静默跳过（地图与交互照常）。`ATMOSPHERE.setDensity(0.45)` 可按比例抽稀精灵。

### ② GSAP 动效层（`src/engine/motion.js`）
- **开场**：卷首墨色化开 → 朱印落定（带一圈扩散的光晕）→ 题名逐字从模糊中浮出 →
  竖排小联、工具条、图例、罗盘、左下统计 dock 依次到位 → 67 处地标自西向东次第点出 →
  统计数字滚动到 153 / 67。（篇目栏默认收起，不参与开场序列。）
- **诗卡**：卡片以 `perspective(1400px)` 三维展开，诗句逐列落下（左右交错），
  随后地名、标签、诗意简析、按钮依次浮现；入场结束后才挂上「门帘轻摆」的持续微动。
- **交互**：选中地标荡开涟漪、切换筛选时地标与篇目重新依次入场、地标浮卡缩放浮现。
- **从篇目或「随机一首」进入时，地图会缓缓飞向该地标**（`flyTo`），点地图上的地标则不飞。

### ③ 动效开关
右上筛选条最右侧的圆形按钮即**动效开关**（太阳形图标），状态记入 `localStorage`。
首次访问时：若系统开启了「减弱动效」（`prefers-reduced-motion: reduce`），默认关闭。
关闭后云气层隐藏、所有动画停止，页面回到纯静态呈现。

### 安全约定
开场隐藏态写在 CSS（`html.motion-prep`），JS 只负责「动到明处」。任何异常、关闭动效、
或 3.2 秒兜底超时都会立刻移除该 class——**内容不可能卡在不可见状态**（自检脚本已覆盖此路径）。

---

## 七·五、性能：几条硬规矩

一张「活的长卷」很容易把自己拖垮。踩过的坑与对应写法：

| 坑 | 症状 | 现在的写法 |
| --- | --- | --- |
| 整屏 SVG 挂实时滤镜（`filter: blur()` 在 `prov`／`terrain` 图层） | 每次缩放都要重光栅化 30 多条省界 + 40 多座山 | 羽化改由**渐变 + 同色柔边**在几何层面表达；图层不带滤镜 |
| 云气层按刷新率重绘 | 高刷屏上每秒重绘整屏 120–144 次，长期挂机发烫、拖动掉帧 | rAF 里加**时长闸门，限 30fps**；像素比上限 1.25 |
| 常驻 `backdrop-filter`（底色已 95% 不透明的面板） | 拖动地图时逐帧重算背景模糊，白白吃掉一帧预算 | 底板够实就**别挂模糊**（篇目栏、左下 dock 已去掉）；只有详情抽屉与多地浮层保留 |
| 无限 CSS 动画 | 合成器永不休息，每分钟白提交 3600 帧 | 仙鹤只翩然 3 轮便落定 |
| 省界原始精度（24950 点） | 每次 zoom 都要把每个点重投影一遍 | 按 0.05° 容差 **Douglas–Peucker 抽稀** → 6069 点（24%） |
| 弱机硬扛 | 用户只感到「卡」 | `perfGuard()` 开场采样帧间隔：>27ms 先把云气抽稀到 45%，仍 >30ms 则整层关掉并提示（结论写在 `window.__perf`） |

React 化之后新增的几条（避免「一改状态就整片重渲染」）：

| 坑 | 症状 | 现在的写法 |
| --- | --- | --- |
| 153 行篇目全量重渲染 | 选中一首诗就重建 153 个节点，滚动位置发抖 | `Sidebar` 的 `Item` 用 `memo`，小景缩略图另有全局缓存 → 选中变化只动 2 行 |
| React 与 Leaflet 各存一份状态 | 筛选改了地图没动，或地图动了侧栏没跟上 | 单一数据源 `store`：组件用 `useSyncExternalStore` 订阅，引擎用 `subscribe` 订阅 |
| 地图订阅回调每帧都跑 | 每次 `setState` 都全量重铺地标 | 订阅里先比对「筛选键」与 `activePlaceId`，**没变就直接返回** |
| 每帧 `querySelector` 找地名签 | 平移时每帧几十次 DOM 查询 | 元素引用缓存在 marker 对象上（`n.__nameEl`） |
| 地名签每帧铺一遍 | 平移时布局抖动 | `move zoom` 里每两帧铺一次（`frameTick % 2`） |
| 打包把 three 也塞进首屏 | 首屏要多下 600 KB 才见到地图 | `manualChunks` 拆出 `leaflet` / `three`，地图先到，云气后到 |

### 卡片为什么会「闪一下」——中间态比性能更值得防

一个真踩过的 bug：开卡 → 进详情 → 点地图空白，抽屉收起了，但**卡片闪了一下**。

根因不在渲染性能，而在**两条关闭路径跑在两个不同的事件阶段**：

| 时序 | 事件 | 当时的调用 | 状态 | 画面 |
| --- | --- | --- | --- | --- |
| t0 | `pointerdown`（App 的 DOM 兜底） | 只 `closeDetail()` | `detailPoemId` 空了，`openPoemId` **还在** | 卡片条件 `!!openPoemId && !poemListPlaceId && !detailPoemId` 变真 → **卡片冒出来** |
| t1 | `click`（Leaflet `map.on("click")`） | `closeCard()` | `openPoemId` 空了 | 卡片又消失 |

t0 与 t1 之间浏览器已经画了一帧，于是闪现；又因为卡片 `on` 变了会触发 `MOTION.cardIn()`，闪现还自带一次入场动画。实测闪现持续 **4 帧（≈67ms）**。

**修法**：把「收起」收敛成 store 里的**一次** `dismissOverlays()`，两个入口共用；谁先跑谁清干净，后跑的因状态无变化被 `setState` 的 changed 判断直接挡掉。实测闪现 4 帧 → **0 帧**。

> 顺带一个教训：这个 bug 之前**躲过了所有自动化验证**。`tools/steps/_pre.js` 的 `__press()` 把
> `pointerdown / mouseup / click` 在同一个任务里同步发完，React 批处理成一次提交，中间没有绘制帧。
> 真实用户按下与抬起隔着几十毫秒，浏览器会画一帧——所以 `tools/probes/dismiss-flash.js`
> 特意把两段拆到不同帧，并逐帧采样 `#card` 的 `.on`。
> **测交互时序问题时，「两个事件之间的那一帧」才是被测对象。**

实测（无头 Chrome，2 秒空转窗口，`CDP_TRACE=1`）：

| 指标 | 改前 | 改后 |
| --- | --- | --- |
| 提交帧数 | 304（≈152fps） | 127（≈60fps） |
| 光栅 raster | 103.1 ms | 47.3 ms |
| 绘制 paint | 40.5 ms | 20.1 ms |
| 合成 composite | 722.4 ms | 279.1 ms |
| 脚本 script | 101.3 ms | 37.7 ms |

（关掉云气层作对照：提交帧 64、布局 1.4ms——即「唯一还在动的只有云气」时的地板值。）

**生产构建实测**（`npm run build` + `npm run preview`，`tools/probes/perf.js` / `interact.js`）：

| 指标 | 值 |
| --- | --- |
| 帧率 | 143.5 fps（帧间隔中位 7 ms · P95 7.3 ms · 最大 13.7 ms） |
| 长任务（>50 ms） | **0 个** |
| `__perf` 自适应降载结论 | `{ msPerFrame: 8.88, level: "full" }`（未触发降载） |
| 筛选切换延迟（唐+宋 → 宋词） | 5.4 ms，153 → 86 首、67 → 33 地标，期间 0 长任务 |
| DOM 节点 | 5025 |
| 产物体积 | JS 1662 KB（gzip 399 KB，含 Leaflet 149 / three 600）+ CSS 41 KB（gzip 9.5 KB）+ 35 张画稿 |

---

## 八、当前数据规模

| 项目 | 数量 |
| --- | --- |
| 诗词 | 153 首（唐 67 · 宋 86） |
| 体裁 | 诗 89 · 词 64 |
| 作者 | 54 位（含生卒年与简介） |
| 苏轼 | 37 首（词 34 · 诗 3） |
| 地标 | 67 处（一处多诗已合并，最多黄州 14 首） |
| 标签 | 153 首全部标注（2–3 个主题词） |

---

## 九、素材怎么用（为什么有些只当点缀）

素材分两类，用法完全不同：

| 素材 | 去处 | 理由 |
| --- | --- | --- |
| 亭 · 塔 · 牌楼 | 备用 | 地标已改为**程序绘制的朱红圆点**（`.dot`，多首带数量徽章）：缩小后辨识度与比例都更稳 |
| 定位大头针 | 备用 | 选中态改用「放大 + 光晕 + 涟漪」表达，不再换图 |
| 罗盘 · 金色祥云 | 罗盘控件 · 诗卡两角 | 位置固定、尺寸可控，不会与地图信息打架 |
| 青绿中国地图 | **只取色，不做底图** | 经纬比例与真实中国不一致（见第六节） |
| 雾带（边缘柔软） | 备用 | 地图不再铺雾带；透气感改由**省区径向晕染 + 山体羽化**承担 |
| 山水 · 松林 · 仙鹤 · 海涛 | **长卷点景覆盖层**（`#paint`） | 作界面边框的点景（远山·流云·仙鹤·松石·江涛），浮在地图之上、不参与地理坐标 |
| 对话框 · 圆形印章 | 备用，暂不上地图 | 在地图尺度下会成为**贴纸**：具象轮廓 + 固定像素尺寸，与矢量地貌的比例尺永远对不齐 |

已经落地的「气韵」用法：长卷四边的远山/流云/仙鹤/松石/江涛点景（`#paint`）、诗卡底部的一抹淡山水、卡角金色祥云。
其余素材保留在 `public/assets/`，需要时再取——例如：
- 打开某首诗时，用「仙鹤」从地标处飞入（配合 `MOTION` 时间线即可）；
- 首页首次进入时以「卷轴」展开代替现在的墨色开场；
- 把「对话框-金色描边」用 `border-image` 做成地标浮卡的外框。

> 判断标准很简单：**素材的语义要对应界面上的一个对象**（地标、罗盘、卡片），
> 而不是散落在地图上当花纹。散落的装饰越多，地图越像贴纸册，越不像山水长卷。

---

## 十、说明与后续

- **`src/engine/eave.js` 未启用**：早前版本用过「中央红墙 + 金黄屋檐 + 诗词门帘」的详情呈现，
  现按设计稿改为右侧纸卡，该文件保留备用，未被任何模块 import。
- **`data/` `js/` `vendor/` 已废弃**：React 化之前的全局脚本实现（`js/app.js` 那套），
  逻辑与数据都已迁进 `src/`，`index.html` 不再引用。保留只为对照与回滚。
- **可扩展**：拼音注音（在 `lines` 旁加 `pinyin` 数组）、Web Speech 朗读、更多朝代
  （`dynasty` 为自由字段，需同步增加筛选按钮）。
- **换更精细的省界**：替换 `tools/china-raw.json` 后运行 `node tools/build-geo.js`，
  产物写进 `src/data/china.geo.js`。
- **再补诗词**：追加到 `src/data/poems.song.js` 末尾（注意上一条 `}` 后要有逗号），
  再到 `src/data/tags.js` 补标签即可。

### 验证方式（无需外部浏览器）

```bash
npm run dev                                      # 起服务（或 npm run build && npm run preview 验生产版）
node tools/check-ranges.js                       # 校验山系的位置与尺度（离线，不开浏览器）
node tools/cdp.js http://127.0.0.1:5179/ a.png 7000        # 截图
node tools/cdp.js http://127.0.0.1:5179/ --eval "@tools/qa-motion.js" 8000   # 动效与交互自检
CDP_REDUCED=1 node tools/cdp.js ...              # 模拟「减弱动效」
CDP_MOBILE=1  node tools/cdp.js ...              # 模拟移动端
CDP_VERBOSE=1 node tools/cdp.js ...              # 打印网络请求，核对零外链 + PAGE ERRORS
CDP_SCROLLBARS=1 node tools/cdp.js ...           # 不隐藏滚动条（量「滚动条占位」引起的跳动）
CDP_INJECT=xx.js node tools/cdp.js ...           # 导航前注入脚本（从第 0 帧起采样布局时序）
```

**多步操作**（点地标 → 浮层选诗 → 开详情…）用可组合的 `tools/steps/`。
React 的渲染是异步的，这些步骤写完会**等两帧**再交还控制权，所以不会踩到「刚点完就去找元素」的坑。
`CDP_SETUP` 按顺序执行、逗号分隔；`CDP_STEP_ARG` 按同样的顺序给参（文件名以 `_` 开头的公共工具不占位）：

```bash
# 量卡片是否居中 + 是否竖排右起
CDP_SETUP=tools/steps/_pre.js,tools/steps/place.js,tools/steps/pick.js \
  CDP_STEP_ARG='长安,|last' \
  node tools/cdp.js http://127.0.0.1:5179/ --eval @tools/probes/card-center.js 2400

# 验「点地图空白 → 浮层/卡片/抽屉一并收起」
CDP_SETUP=tools/steps/_pre.js,tools/steps/place.js,tools/steps/pick.js,tools/steps/cardclick.js \
  CDP_STEP_ARG='长安,|last,' \
  node tools/cdp.js http://127.0.0.1:5179/ --eval "JSON.stringify(__state())" 2400

# 验深链直开长诗（顺带量抽屉宽度上限与诗栏横向滚动）
node tools/cdp.js http://127.0.0.1:5179/#/p/pipa-xing --eval @tools/probes/detail-geo.js 3000

# 截某一带的放大图：先把视野移过去再截（参数用竖线分隔，逗号是步骤分隔符）
CDP_SETUP=tools/steps/_pre.js,tools/steps/view.js CDP_STEP_ARG='33.5|88|6.1' \
  node tools/cdp.js http://127.0.0.1:5179/ shots/qingzang.png 5200

# 验「点地图收面板」的中间帧：卡片不许闪回来（逐帧采样）
CDP_SETUP=tools/steps/_pre.js,tools/steps/place.js,tools/steps/pick.js,tools/steps/detail.js \
  CDP_STEP_ARG='长安,|last,' \
  node tools/cdp.js http://127.0.0.1:5179/ --eval @tools/probes/dismiss-flash.js 2600

# 回归：关抽屉按钮要回到卡片 / Esc 逐层收 / 点地图三者全关
CDP_SETUP=tools/steps/_pre.js,tools/steps/place.js,tools/steps/pick.js,tools/steps/detail.js \
  CDP_STEP_ARG='长安,|last,' \
  node tools/cdp.js http://127.0.0.1:5179/ --eval @tools/probes/dismiss-paths.js 2600
```

`tools/probes/` 是单条量测表达式，也可以直接写 `--eval "..."`。

量性能（`CDP_TRACE=1` 会给 `--eval` 的那段脚本套一层性能跟踪，回报
光栅 / 绘制 / 合成 / 布局 / 脚本各自的毫秒数）：

```bash
node tools/cdp.js http://127.0.0.1:5179/ --eval @tools/probes/perf.js 3000      # 帧率 + 长任务 + 云气画布
node tools/cdp.js http://127.0.0.1:5179/ --eval @tools/probes/interact.js 3200  # 筛选切换延迟
node tools/cdp.js http://127.0.0.1:5179/ --eval @tools/qa-perf.js 6500          # 帧时间 + 几何规模 + 避让耗时
CDP_TRACE=1 node tools/cdp.js http://127.0.0.1:5179/ --eval @tools/qa-idle.js 5500    # 常驻开销
CDP_TRACE=1 node tools/cdp.js http://127.0.0.1:5179/ --eval @tools/qa-drag.js 6000    # 拖动负载
node tools/cdp.js http://127.0.0.1:5179/ --eval "window.__perf" 5000            # 自适应降载结论
```

> `window.__perf` 与 `window.L / MOTION / ATMOSPHERE / __store / __poems…` 这些诊断钩子
> 由 `src/devtools.js` 在**开发期**挂出，生产构建里整段被 tree-shake——线上不会有全局泄漏。
> 所以 `tools/probes/` 一律只读 DOM 与 `window.__perf`，好让同一套探针在 dev 与 preview 上都能跑。

