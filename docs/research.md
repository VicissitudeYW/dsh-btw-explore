# Explore 和 BTW 旁路问答实现对照

研究日期：2026-11-21。对照 Explore 官网预置演示、未登录聊天入口及正常公开发布的浏览器资源，BTW 固定版本源码，以及安装的 DSH 0.2.2-rc.5。官网没有公开源码仓库，以下前端代码事实来自交付给浏览器的资源；没有访问私有服务端、登录账号或验证 Explore 的付费模型和云同步。

## 关键发现

| 机制 | Explore 公开客户端证据 | BTW 1.4.2 | 本插件首版 |
| --- | --- | --- | --- |
| 数据单位 | 独立卡片、消息、来源关系和项目 | 每次旁问一个临时 child job，显示短期气泡 | 独立卡片、多轮问答、固定起始上下文 |
| 来源关系 | `parentId`、`parallelSourceId`、`branchingSourceId`、`summarySourceId` 分别建模 | 单次调用从主会话派生，没有树路径协议 | 根卡、子卡、指定轮次分支 |
| 历史继承 | 分支沿来源链回溯，在指定消息处截断；`START` 不取来源卡消息 | idle 与进行中主轮次采用不同 seed；无连续旁问卡链 | 分支截到指定轮；子卡仅带所选问答/摘录 |
| 引用预览 | 演示里点击概念先预览，再转成子卡 | 选中文字作为单次 reference | 引用问答默认预览，可保存成卡 |
| 本地保存 | IndexedDB 项目 repository、localStorage 迁移与旧库导入 | BubbleStore 和 SideJobs 的短期内存缓存 | 宿主 SQLite、按会话分区、轮次状态恢复 |
| 云同步 | 客户端存在版本更新、缓存、待同步和冲突处理；官网将同步列为会员能力 | 旁问树不提供此协议 | 首版仅本机保存 |

## Explore 的上下文并非只有一种

`1766-d6900b4171ab54a7.js` 中的模块 `12788` 有明确的分支继承函数：没有 `branchingSourceId` 返回空历史；有来源时先递归取其分支祖先，再查来源卡的 `branchingSourceMessageId`。等于 `START` 时取零条来源消息，否则截到指定消息（包括它）后返回。聊天生成器合并继承历史与当前卡片自己的消息。

普通子卡、同级卡和总结卡使用各自来源字段，并不是上述函数的相同路径。客户端还有读取项目历史的工具，能按卡片路径提供背景。但已找到的静态实现不足以证明普通子卡或同级卡默认自动复制全部来源历史。因此首版明确规定自己的子卡与分支规则，并把来源快照长期存下来。

公开界面资源还包含卡片收起、拖动排序、同源编组、关联、撤销、未读状态和整理模式。删除代码沿多种来源边收集后代，界面有不可恢复的确认文案。这些说明 Explore 的树同时承载浏览、来源和整理操作。首版仅实现必要的树浏览和分支删除。

## 右侧节点图和原生子卡

第一段演示约 00:37 处可以看到卡片叠开和右侧节点横向分叉。交付给浏览器的应用 shell 和页面分块显示，节点对应卡片，边表示来源关系，实心节点表示当前卡，点击节点会切换当前卡。第二段演示的后续画面受登录提示遮挡，观察范围限于能正常播放的部分。 [第一段演示](https://www.bilibili.com/video/BV11mNA6vEJX/) · [第二段演示](https://www.bilibili.com/video/BV1gsHC6aEWC/) · [Explore 页面分块](https://ai.explore.poker/_next/static/chunks/app/page-7c8710329ad12fae.js)

`0.3.0` 依照这些交互实现可点击的分支图。一条直链显示为竖线，有多个子卡时才横向分开。切换分支时保留共同祖先的页面。新卡使用 DSH 的会话控制器和嵌入式对话插槽，引用快照按子卡会话 ID 注入，原生输入和对话插件由宿主挂载。普通会话会进入宿主列表。安装版 DSH 的子代理会话会走专用视图，无法借用该类型来隐藏原生子卡。

## BTW 的工程价值与边界

固定研究版本是 [MichengAI/dsh-btw](https://github.com/MichengAI/dsh-btw/tree/a4f573d8c58bc569bdd14de4f6505b57fd2f2d9c)，版本 1.4.2，commit `a4f573d8c58bc569bdd14de4f6505b57fd2f2d9c`。

BTW 每次旁问创建 child activation，以 `delivery: caller` 避免自动 settlement 回传。父会话仍在执行时，它可以构造进行中轮次的 fork seed，未返回的工具结果保留未知语义。工具默认由执行期 guard 拦截；受控的 `send_message` 可以发给直接 parent，普通工具可通过白名单开放。提示要求用户明确授权回传，但运行时 guard 本身不验证用户意图。

答案默认不成为主聊天正文。宿主仍会记录 child catalog 等生命周期事件，因此不能把这种隔离描述为主会话绝不增加事件。BubbleStore 和 SideJobs 以内存 Map 保存气泡和 job，完成结果有时间与数量边界，查询需要已知请求 ID，没有插件重启后列举与重建完整卡片树的路径。

本插件选用 `ctx.llm.stream()`，不创建 child agent，不写主聊天事件，并用独立数据库作为树的真实数据。BTW 的任务取消、并发限制和断线恢复仍是有价值的工程参照。

## 证据索引

- [Explore 官网](https://ai.explore.poker/) 和 [聊天入口](https://ai.explore.poker/chat)：有限的预置演示操作和未登录观察。
- [Explore 1766 分块](https://ai.explore.poker/_next/static/chunks/1766-d6900b4171ab54a7.js)，SHA-256 `800cdd67707394c7a9afc2f7db93438342631bd89329c3816882281cdef61ef8`。
- [Explore 4931 分块](https://ai.explore.poker/_next/static/chunks/4931-1b18530072c5c851.js)，SHA-256 `7c21f951fa77a0ac8e9752c8501087ac4bd1cf95c6a12e031548e4fc8189a7a9`。
- [Explore 应用 shell](https://ai.explore.poker/_next/static/chunks/5568.ba1574b7e08e8677.js)，SHA-256 `31cd06e9a8a1878d9eb4a6be92cb7d175de3f05d0ec81ffa6da1e9e85bd4f9b1`。
- [DSH Connection 文档](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/connection/README.md)：插件使用认证后的 exact Fetch 注册和 owner 限制。Context7 结果与安装版实现交叉核对；公开 master 会继续变化。
- [DSH LLM 类型](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/llm/llm/src/types.ts)：独立生成使用规范的消息 ID、role、source 与 content；历史助手消息不携带原请求 replayState。实际安装版适配器路径已用本地模型验证。

上面的资源索引记录了用于核对的公开前端文件及其 SHA-256。插件根据观察到的行为独立实现。

## 尚不能证明的内容

本次没有验证 Explore 真实账号的模型流、跨设备恢复、项目云同步或私有服务端逻辑；普通子卡和同级卡按需读取历史的实际覆盖量也未知。官网再次交互时出现过 Browser Use 超时，不能将静态资源中的每条路径视为线上实测成功。

关于当前插件的验收结果，见仓库中的 `docs/verification.md`。所有宿主模型测试均使用隔离的本地替身，不代表真实提供商回答质量或计费行为已测试。
