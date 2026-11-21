# Explore 导航和动效补充调研

调研日期：2026-11-21。范围为当前公开的 [Explore 官网](https://ai.explore.poker/)及[未登录聊天入口](https://ai.explore.poker/chat)，用于 dsh-btw-explore 0.3.2 后续界面打磨。保留原生 DSH 对话区域；右侧导航按本项目要求始终无外框、无背景面板、无横向滚动条。

本次使用 Edge 临时标签页查看页面、截图和 DOM，并静态检查该页面实际加载的公开交付资源。没有登录、提交消息、调用外部模型、操作 DSH profile 或执行下载的 JavaScript。临时浏览器标签页已关闭。研究期间进入了未登录空工作区并点击其“新建项目”入口，未输入内容。

## 证据等级和可访问范围

| 步骤 | 实际操作及结果 | 覆盖情况 |
| --- | --- | --- |
| 1 | 官网可以加载，已查看 Dive Deeper 的公开演示和截图 | 可观察静态形态 |
| 2 | 演示概念词、创建子卡、Demo 按钮的点击没有带来可确认的预览、卡片或节点变化 | 动态交互受阻，原因未确定 |
| 3 | 直接打开页面所链接的 `/chat`，显示未登录空工作区 | 可观察空态、使用指南的公开文字 |
| 4 | 检查当前交付页面脚本和样式中的导航、预览、卡片过渡定义 | 静态证据，不代表每条路径已执行 |

不能把点击无变化归因为站点缺少功能，也不能把资源中的动画定义写成已实测的动画效果。此次没有录得成功建子卡、节点切换或悬停提示的动态过程。

## 页面和 DOM 的实际观察

- 官网演示初始为一张“黑洞”卡片，右侧只有一个白色实心发光圆点，未见导航滚动条。当前节点 DOM 为 `<circle cx="112.5" cy="429" r="16.8" class="transition-all duration-200 tree-node-current">`。
- 官网展示窗口本身带演示外框，右侧区域前有一条竖向分隔线；这属于官网演示布局，不能据此要求插件加导航面板或外框。
- 正文概念使用 `span.conceptual-term`，游标为 `pointer`，呈轻下划线。DOM 命中检查显示概念上方没有遮挡层，但点击后仍未出现可确认的预览。
- 卡片标题和操作按钮位于卡片内部顶部，内容区独立滚动；上、下缘有淡出遮罩。以上是 Explore 自己的卡片结构，DSH 插件仅借鉴外围控制，不复刻对话区。
- `/chat` 空态为大面积中性暗底，输入区固定在底部，左侧操作窄而独立。当前未登录空工作区没有可用的多节点树，不能从空态验证节点间切换。
- `/chat` 使用指南的公开文字分别说明“点击有下划线的文本，快速预览其解释”和“选取 AI 的回复文本可以进行引用（可引用多处）”。这两条描述不能合并成“任何划词都会直接建子卡”。本次没有实测任意文本选择至建卡的流程。

## 当前交付组件和 CSS 的静态证据

### 导航形态、状态和关系

当前首页页面分块含独立节点组件和树布局组件。以下是对下载资源的静态读取：

| 项目 | 交付资源中的定义 |
| --- | --- |
| 导航外层 | `h-full relative bg-transparent z-10 min-w-0 overflow-hidden` |
| 导航内层 | `overflow-auto cursor-grab active:cursor-grabbing no-scrollbar mask-tree-edge-fade`；内容可拖动，滚动条隐藏 |
| 普通节点 | 纵向半径 14px，根节点乘 1.2，为 16.8px；同层节点中心距 36.25px，纵向层距 80px |
| 当前节点 | `tree-node-current`：实心、2px 描边、5px 投影；优先级高于 hover、路径和根状态 |
| hover 节点 | `tree-node-active`：背景色填充、4px 描边、6px 投影；这是静态状态分支，未在本轮成功悬停验证 |
| 祖先路径节点 | `tree-path`：空心、3px 描边、5px 投影；祖先集合沿 `parentId` 回溯 |
| 普通/根节点 | 普通空心 2px 描边；根节点另有 3px、较弱描边与投影 |
| 状态过渡 | 节点 `transition-all duration-200`，未读小点为 300ms `ease-out` 的 opacity/scale |
| 未读提示 | 节点内部另有半径为外圆 0.3 倍的品牌色小点；与当前节点实心状态分开建模 |
| 标题提示 | 文本为“卡片标题 · N 条消息”；纵向提示放左侧，横向提示放上方 |
| 选中行为 | 节点点击调用选卡回调；选中后滚动至当前节点附近，使用 `scrollTo({behavior:"smooth"})` |
| 手动浏览 | 拖动位移超过 5px 视为拖动并阻止意外点击；手动滚动/hover 后约 3 秒再居中当前节点 |
| 子卡连线 | SVG 三次贝塞尔，从圆周边缘起止；父、子同时在当前祖先路径中时，线条使用路径态 |
| 同级关系 | `parallelSourceId` 和 `branchingSourceId` 另画同层关系线，相邻直连，隔项采用弧线 |

静态布局把子卡层放在其父层上方；因此 Explore 的纵向树并非普通目录自上而下的树。插件是否采用这一方向应依自己的卡片打开关系决定，不应只复制像素。

样式定义摘录：

```css
.tree-node-default { fill: rgb(var(--color-bg-bg)/1); stroke-width: 2; }
.tree-node-current { fill: rgb(var(--color-stroke-tree-node-current)/1); stroke-width: 2;
  filter: drop-shadow(0 0 5px rgb(var(--color-stroke-tree-node-current)/.9)); }
.tree-node-active { fill: rgb(var(--color-bg-bg)/1); stroke-width: 4;
  filter: drop-shadow(0 0 6px rgb(var(--color-brand))); }
.tree-path { stroke-width: 3;
  filter: drop-shadow(0 0 5px rgb(var(--color-stroke-tree-path)/.9)); }
circle.tree-path { fill: rgb(var(--color-bg-bg)/1); }
.tree-link { stroke: rgb(var(--color-stroke-tree-link)/.6); stroke-width: 1.5; }
```

### 概念预览和创建子卡

- 概念默认 `border-bottom: 1.5px dotted`，hover 改 `1.5px solid` 并增强文字色；边框过渡 200ms。样式表另含 `ct-armable/ct-armed/ct-firing` 状态及 500ms 闪烁淡出，但首页 DOM 初始概念未带这些状态，本轮未验证其实际触发条件。
- 首页演示点击标记概念的回调，从预置 `terms` 数据中取解释，打开浮动预览；这条路径与一般划词选择不同。
- 预览宽、高为当前卡片的一半，靠概念右侧 12px 放置；右侧放不下时改放左侧，再限制在演示容器内至少 8px 边距。外观为 16px 圆角浮层，右上有“从预览创建新卡片”和“关闭预览”两个动作。
- 预览转卡调用 `child` 建卡路径；首页数据和答案是预置的，因此静态代码不能作为真实模型调用时序的证据。

### 卡片打开和切换动画

首页演示资源里的卡片过渡统一为 **350ms `ease-in-out`**。静态定义覆盖 `left/top/transform/opacity/filter/z-index`，几何变形时额外加入 `width/height`。这不是本轮录得的实际帧时长。

| 操作语义 | 静态初态/末态 |
| --- | --- |
| 创建子卡 | 新卡从 `translate(-50%,-150%) scale(1.2)`、opacity 0 进入当前中心位置 |
| 返回父级 | 子卡朝右上轻移，至 `translate(-40%,-55%) scale(1.04) rotate(5deg)`、opacity 0 |
| 切换已有子卡 | 新卡以上述右上状态、opacity 0 进入，再归中 |
| 切换同级卡 | 左右对向移入/移出，对应来源关系方向 |
| 创建/切换分支 | 新建时从上方进入，已有分支从下方进入；旧内容向上退场 |
| 普通消散 | opacity 0，scale 0.95 |
| 背景祖先卡 | 每一层缩小约 4%、旋转约 -5°，增加 0.5px 模糊并降低亮度；hover 恢复清晰并放大 1.02 倍 |

上述大幅位移、旋转、模糊属于 Explore 的完整堆叠卡片视觉，不适合直接作用于宿主原生 DSH 对话视图。

## 给本插件的可执行参数建议（设计建议，并非 Explore 实测值）

| 元素/动作 | 建议参数与目的 |
| --- | --- |
| 点线导航 | 固定 28–32px 点击区，视觉点约 9–12px；只缩放内部点，保持鼠标命中区和标签锚点稳定 |
| 当前/祖先 | 当前实心，祖先空心较强描边，非路径低对比；线宽约 1px/路径 1.6px，使用宿主文字/强调色 token |
| hover/focus | 内点 scale 1→1.15，140–180ms `cubic-bezier(.2,.8,.2,1)`；focus-visible 具有同等信息，不依赖发光识别状态 |
| 标题提示 | 左侧出现，opacity 0→1、translateX 4→0，约 140ms；pointer 可延迟 160ms，键盘聚焦立即呈现 |
| 来源摘要展开 | 内容 opacity + translateY(-4px→0)，180ms；避免每个文本节点单独交错动画 |
| 新子卡打开 | 外围容器 translate(8px,-12px)→0、opacity 0→1、scale .992→1，约 240ms；来源区域只做短程强调 |
| 节点方向切换 | 外围容器按关系 ±12–16px 移动，opacity .65→1，200–220ms；保持共同祖先和原生对话实例稳定 |
| 关闭/返回 | 外围控制 translate(6px,-6px)、opacity 1→0，150–170ms；结束后释放临时层 |
| 减少动态效果 | `prefers-reduced-motion` 下取消位移、缩放和交错，必要时保留 ≤80ms 的单次透明度变化 |
| 连续切换 | 每次新动作取消或完成旧 WAAPI animation，卸载时取消；仅对 transform/opacity 动画，不能让旧完成回调覆盖新选中态 |

导航应独立浮在右侧，容器透明；提示浮层可以有自己的小背景。节点很多时优先在容器内纵向浏览和限制可视范围，不让整块导航出现横向滚动条或推动原生会话宽度。

## 资源索引与版本边界

本次实际页面加载的资源已与旧 `docs/research.md` 不同，不应沿用旧哈希宣称当前官网完全相同。

- [首页交付分块](https://ai.explore.poker/_next/static/chunks/app/page-ea063123c8085d12.js)，SHA-256 `f234cd17569a65fd90ed7a8150d5ccdefb51ab4bce232591e798fc4e24fe6b44`。
- [当前共享样式](https://ai.explore.poker/_next/static/css/520920968c96d0c6.css)，SHA-256 `04b6130f12e1e82e5c187ca620280ddcf8187791a6aea26a9ea6db4da007d318`。
- [当前基础样式](https://ai.explore.poker/_next/static/css/6d03e58b5bd469fe.css)，SHA-256 `dcd6a22287bde5926781af71014fd3277bfec640a51c10ec226f54f853b35f83`。
- REA 静态应用分析 Evidence：`ev_45fd1f150ea5a8c6b82421a324f8108a08e1f813bae38d9cc044d3cdef4774c8`；摘要视图 `ev_7739ee9fa3f5019b0371527a8e9e356e72f27bb791b785941e5c6d03f466a276`。两份 JavaScript 解析成功，应用图覆盖为 partial；没有执行脚本，不能据此证明运行行为。

尚未实测：成功概念预览、任意划词建卡、创建子卡动画、树节点 hover 和点击切换、触屏交互、真实账号下模型/云同步行为。以上限制不阻止用可确认的状态区分和短程方向动效改进插件，但验收应以本地集成结果为准。
