# poemMap · 项目长期约定

中华诗词地图（青绿山水长卷）。**React 19 + Vite 8**，纯静态、全离线：Leaflet 1.9.4 + Three.js 云气层 + GSAP 动效，无瓦片 / CDN / 字体外链 / 外网请求（生产版仅 12 个请求，全部本机）。

## 架构（别推翻）
**React 只管界面外壳，地图/三维保持命令式单例。**
`src/store.js`（`getState/subscribe/useStore`，单一真相）← React 用 `useSyncExternalStore` 订阅；引擎用 `subscribe()` 订阅。
React 重渲染不碰地图；地图平移也不上抛状态。共享的只有「筛选条件 / 选中项」。
- `src/data/`（诗词/作者/标签/省界/`places.js` 地标聚合/`select.js` 筛选纯函数）· `src/engine/`（mapEngine/anchor/terrain/atmosphere/motion/thumbs/refs）· `src/components/`（12 个）· `src/actions.js`（跨层动作）· `src/lib/`（dom/geo）
- `main.jsx` **不用 StrictMode**（避免 Leaflet/WebGL 双初始化）；`devtools.js` 用 `import.meta.env.DEV` 判定，生产被 tree-shake → 探针只能读 DOM 与 `window.__perf`
- mapEngine 订阅里先比对「筛选键 + activePlaceId」，没变直接 return
- 旧 `data/ js/ vendor/` 已废弃，保留作对照，`index.html` 不引用

## 运行与验证（每次改完必做）
- `npm run dev`（5179，HMR）· `npm run build`（→ `dist/`）· `npm run preview` · `npm run serve`（零依赖服务 `dist/`）
- ⚠️ `npm run build` / `node vite build` 偶发在「57 modules transformed」处静默 SIGTERM（无报错）→ **改用 `node tools/build.js`**（spawnSync + stdio:inherit）
- 取数：`node tools/cdp.js <url> --eval @tools/probes/<x>.js [waitMs]`（**长表达式一律写文件**，别在命令行拼引号）
  现有 `card-center`（居中+竖排几何）· `detail-geo`（抽屉磨砂/宽度/滚动）· `perf`（帧率+长任务）· `interact`（筛选切换延迟）
- 多步准备：`CDP_SETUP=tools/steps/_pre.js,<step>...`，`CDP_STEP_ARG` 按槽传参；**文件名以 `_` 开头的不占槽位**（`_pre.js` 是公共工具）
  `place.js`（点地标，按地名签模糊匹配）· `pick.js`（浮层选诗，参数格式是**单槽** `"名字|last"`）· `detail.js` · `notes.js` · `cardclick.js` · `detailclick.js` · `side.js` · `sideclick.js` · `view.js`（设视角，参数**单槽** `"lat|lng|zoom"`——逗号是 step 分隔符所以用竖线）
  这些步骤是 async，会**等 React 提交两帧**再交还——别再用旧的同步 `tools/setup-*.js`
- 模拟：`CDP_MOBILE=1` · `CDP_REDUCED=1` · 零外链与报错核对：`CDP_VERBOSE=1`
- 性能：`CDP_TRACE=1` 回报光栅/绘制/合成/布局/脚本毫秒；配 `qa-idle.js` / `qa-drag.js` / `qa-perf.js`
- **交付前：起服务 → 探针量几何/状态自检 → 确认无 PAGE ERRORS**；一条 Bash 里连跑 ≥4 次 `cdp.js` 会被 SIGTERM → 拆开跑
- 坑：**Vite 8 走 rolldown，`manualChunks` 只认函数形式**，写对象直接构建失败
- 坑：本机 bash 环境不完整（无 `/usr/bin`，`grep`/`tail`/`which` 都没有；`export PATH=` 前缀会 SIGTERM；`rm` 被坏的 safe-bin 挡下）→ 一律用 `node -e`、Read/Write/Grep 专用工具，别拼管道

## 视觉 / 交互约定
- 地标＝程序绘制朱红圆点 `.dot`，多处题咏带 `.dot-count` 徽章；选中＝放大 + 光晕 + 涟漪 + 地名签
- 左侧篇目栏**默认收起**（`#sidebar` opacity:0 / translateX(-114%)），由左下 dock 的 `#sideToggle` 唤出，展开时 dock 右移
- 一处多诗 → `#poemList` 磨砂浮层先列诗，点某首再开 `#card`；卡片底部「此处另有 N 首 ›」可回流
- **诗词一律竖排右起**，都没有横排分支。注意**竖排落在哪一层**：卡片是 `#cardPoem`（`flex-direction:row-reverse`）里每个 `.col` 各自 `vertical-rl`；抽屉才是 `.d-poem` 直接竖排——量探针别量错容器
- `#card`：**居中**（`placeCard()` 摆在「地图可视区」正中＝左让开篇目栏、上 84、下 24，不贴地标；篇目栏开合后重算）、`max-height:min(90vh,860px)`、宽 250–880 伸缩；极长诗在卡内**只横向滚动**
- `#detail` 抽屉：**磨砂玻璃**（`rgba(252,248,238,.58)` + `backdrop-filter:blur(18px) saturate(1.35)`）；宽度随诗长（短诗 ~630 / 长词 ~1050 / **封顶 1100**）；正文限宽 560；隐藏竖向滚动条，诗超高时只在诗栏横向滚动
- **抽屉「上下与诗同宽」**：`.detail-body` 内有 `.d-col{width:100%}`，标题/地名/标签/注解区对齐内容宽并沿中轴居中。**切勿给 `.d-col` 写 `width:max-content`**——《琵琶行》会从 3938px 膨胀到 24363px
- **打开 `#detail` 自动收起 `#card`**；**点地图空白 → 卡片 + 浮层 + 抽屉一并收起**（引擎 `map.on("click")` + App `pointerdown` 双保险）
- 深链 `#/p/<id>`：`App.jsx` 的 `openFromHash(engine)` + `hashchange` 监听
- 地图 pane：prov 400 / terrain 410 / hydro 418 / wall 425 / border 430 / geoLabels 470
- 山＝`src/engine/terrain.js` 山脊剪影（`smoothSpine` Catmull-Rom + `densify` + `ridgeShape`）：**主山体是单个多边形**（不按峰切分，否则山脚有渐变接缝），叠 **4 层**＝远山 sils（`url(#rgf)`／空气透视，只画一排峰 `botAbs:0.20`）→ 主山 sils（`url(#rg)` 纵向渐变，山脚 `stop-opacity .10` 羽化）→ 半坡背光 `faces`（**纯色** `#44614f` op.12，勿用渐变：100+ 面按 bbox 重算会掉帧）→ `hazes`/`grains`(皴)/`ridges`(墨线)/`crests`(受光高光)。造峰用 **`sin` 不是 `|sin|`**（后者谷底留 V 形尖角）；沿脊宽度 0.78–1.18× 抖动，避免「纺锤」感。**不用三角峰 / 圆丘**
- 山脉名＝`RANGES` 里的 `name`/`rank`/可选 `label`，经 `terrain.labels()` 出锚点（脊线中点沿法线外推 `w*0.66`），`mapEngine` 建 `.mtn-label` marker。**标注用独立 `mtnPlaced` 池**：只与其他山名 + 地标**圆点**（±9px）互斥，可压地标文字——共用一个池会被挤到只剩 7/22。`rankCut`：zoom<4.1 只显示 rank 1
- 改代码后同步 README 一/二/三/四/五/六/七/七·五/九/十 节

## 交互正确性（踩过坑，别回退）
- **卡片显示条件 = `!!openPoemId && !poemListPlaceId && !detailPoemId`**，而 `openDetail()` 会**保留** `openPoemId`（设计意图：关抽屉要回到卡片，点 `#detailClose` 已验证）
- ⚠️ **「收起」必须是一次原子变更**：统一走 `store.dismissOverlays()`，**禁止**写成 `closeCard() + closePoemList() + closeDetail()` 三次 setState。
  否则「先关抽屉、后关卡片」之间会有一帧「`detailPoemId` 空、`openPoemId` 还在」→ 卡片闪一下（实测 4 帧 ≈67ms），还会误触发 `MOTION.cardIn()`
- 入口共用同一个动作：`mapEngine` 的 `map.on("click")` / `closeAll`、`App.jsx` 的 `pointerdown` 兜底、`actions.js` 的 `resetView()`
- Esc 是**逐层收**（菜单→篇目栏→浮层→抽屉→面板→卡片），与「点地图全收」不同，别混
- ⚠️ **测时序问题要把事件拆到不同帧**：`tools/steps/_pre.js` 的 `__press()` 在同一任务里同步发 pointerdown+mouseup+click，
  React 批处理成一次提交、中间没有绘制帧 → **测不出中间态**。用 `tools/probes/dismiss-flash.js`（分帧发 + 逐帧采样 DOM）
- 回归用 `tools/probes/dismiss-paths.js`（关抽屉回卡片 / Esc 逐层收 / 点地图全收）

## 性能铁律（别回退）
- **地图 pane 不挂实时滤镜** → 羽化用「渐变 + 同色柔边」几何表达
- **底色够实（≈95%）的面板不挂 `backdrop-filter`**；只有 `#detail` / `#poemList` 保留磨砂
- 云气层**限帧 30fps** + 像素比 ≤1.25；`setDensity(frac)` 可抽稀
- CSS 动画**别写 `infinite`**（仙鹤只跑 3 轮）
- 省区轮廓按 0.05° 抽稀（`simplifyRing`/`simplifyProvince`，24950→6069 点）；Leaflet `smoothFactor` 对渲染路径几乎无效
- `perfGuard()`：>27ms 抽稀云气到 45%，仍 >30ms 整层关闭并 toast；结论在 `window.__perf`
- React 侧：篇目 `Item` 用 `memo`（选中只动 2 行）· 地名签元素缓存在 `n.__nameEl` · `move zoom` 每两帧铺一次地名签 · `manualChunks` 拆 leaflet/three
- 实测基线（生产版）：fps 143.5 / 帧间隔中位 7ms / **长任务 0** / 筛选切换 5.4ms

## 数据
- 153 首（唐 67 · 宋 86）· 诗 89 · 词 64 · 作者 54 · 苏轼 37 · 地标 67
- 新增诗词：`src/data/poems.*.js` 追加 + `src/data/authors.js` 登记 + `src/data/tags.js` 补标签；同坐标（<0.15°lat / 0.2°lng）自动并为一处地标
