# 0.3.3 卡片动效技术验证

验证日期：2026-11-21。范围为 `src/pages.js`、`src/motion.css` 与 `test/motion.test.mjs`；这是候选版本的动效分项记录，最终构建与宿主联测由主验证文档汇总。

## 动效与状态

| 动作 | 时长 | 可观察阶段 | 运动 |
| --- | --- | --- | --- |
| 首次打开、划词提问、打开子卡 | 210 ms | `data-btw-motion="enter"` | 从捕获的选区或来源位置轻微展开，二维总位移不超过 24 px，起始 scale 为 .985 |
| 前进、返回 | 180 ms | `forward`、`back` | 纵向轻移，保持父卡真实 DOM、编辑器和滚动位置 |
| 同级切换 | 180 ms | `switch-next`、`switch-prev` | 按节点顺序左右轻移 18 px，重复点击当前卡不重播 |
| 退出页面 | 150 ms | `exit`、`data-btw-leaving` | 真实退出节点短暂保留并淡出，始终 inert 与 aria-hidden |

前景动作由 WAAPI 的独立 `translate`、`scale`、`opacity` 驱动；不动画化布局尺寸，也不覆盖被遮挡祖先的基础 transform。逻辑目标立即更新；动画完成、取消或超时只能收束对应 revision，不能覆盖后续操作。最终关闭在退场结束后释放主界面 inert，并还原来源焦点与滚动位置。最长兜底等待为 290 ms。

缺少 WAAPI 或检测到 `prefers-reduced-motion: reduce` 时，同步更新目标与卸载退出层，不创建动画或延迟计时器。偏好在动画期间变化为 reduce 时，也会立即收束并取消旧动画。覆盖层卸载会取消动画、移除媒体监听器并清理计时器。

## 自动化证据

`test/motion.test.mjs` 的 16 项动效回归覆盖：

1. 清除选区后仍使用打开时捕获的来源几何；远处来源总位移保持在 24 px 内。
2. 同级切换实际调用 WAAPI 并采用相反水平位移；当前页重复点击不重播。
3. 退出前保留真实页面和主界面 inert；完成后还原来源焦点与滚动位置。
4. 连续切换时，迟到的旧动画完成不会覆盖最终目标。
5. 同一 React 批次连点只挂载最终原生目标，不为从未呈现的中间目标创建退出会话；父级原生编辑器实例和草稿保留。
6. 最终关闭被重新打开打断后，旧回调不会移除新页面或抢回旧焦点。
7. Esc 尊重宿主菜单，正常情况下每次只退回一层。
8. 子卡进入被返回打断时，父卡 DOM、草稿、阅读位置和返回焦点保持；退出页返回文案不会闪变。
9. reduce 环境同步开关，无动画或遗留退出层。
10. 无 WAAPI 环境同步开关，无动画或遗留退出层。
11. 动画期间切换 reduce 偏好立即完成退出并释放焦点锁。
12. 覆盖层卸载取消未完成动画并释放主界面 inert。
13. 原生草稿在初始 GET 尚未完成时关闭，真实退出 DOM 保留；GET 迟到后不会再调用 `open-native` 创建持久会话。
14. 退场期间重新打开时，先解除覆盖层 inert 再聚焦顶层；以 inert-aware focus 边界替身检查浏览器的拒绝聚焦规则。
15. 子卡原生草稿等待延迟绑定时，当前环保留在来源父卡；POST 已返回但卡片详情仍未更新时继续保留父环，目标进入导航后才移动到新子卡。
16. 无父卡的根草稿等待延迟绑定时不显示当前环，避免冒充返回入口；绑定真实 ID 且目标进入导航后才显示新根卡当前环。

测试中的 React、页面组件、导航、DOM、草稿和焦点行为均运行真实实现；JSDOM 缺少的 WAAPI 渲染边界使用可控替身，以检查播放参数、完成、拒绝和中断。原生会话渲染边界使用最小组件检查挂载次数与编辑器节点身份，这不能替代真实 DSH 的 retain/release 联测。

审查修复后的相关验证命令为 `node --test test/motion.test.mjs test/view.test.mjs test/chrome.test.mjs test/entry.test.mjs test/navigation.test.mjs`，共 33 项通过，包含上述 16 项；`git diff --check` 通过。首轮 Impeccable 对 `pages.js` 与 `motion.css` 的机械检查返回空发现。最终构建、全项目测试总数与宿主复核由主代理统一执行并记录。

最终修复后，主代理运行 `npm test` 重新构建，全部 43 项测试通过，零跳过；再次运行 `git diff --check` 通过。

## 独立审查后的修复

- **关闭后的自动准备门禁：** 退场需要保留真实 ExploreView，但其原生草稿的初始 GET 可能晚到。页面显式传递 `isPageClosing`；自动准备条件和 `prepareNative()` 入口都在关闭状态下停止新建动作。仍在路径上、只是被子卡盖住的父卡继续保留读取和原有行为；已发出的请求按既有语义完成。
- **解除 inert 与焦点顺序：** React 子组件 layout effect 先于父组件执行，原先重入可能在覆盖层仍 inert 时请求聚焦。聚焦统一移至父组件，在解除覆盖层 inert 后执行，并按顶层 key 去重；导航焦点与来源恢复逻辑保留。此时序已由 inert-aware focus 测试复现并验证，真实浏览器复核结果以主验证为准。
- **未绑定草稿的当前环：** 之前把缺少 cardId 的草稿统一映射到 home，导致创建期间当前环先跳到返回入口。未绑定子草稿改用父卡 ID；无父根草稿使用 undefined 暂不显示当前环，最终关闭才使用 null。ID 绑定后还须确认 cards 已包含目标，避免详情刷新前丢失当前环。延迟绑定的两条回归同时覆盖 POST 和后续详情读取阶段。

## 宿主观察与验证限制

主代理在真实 DSH 打开卡片时读取到进入期间 opacity 约 .907、scale 约 .995、translate 约 -6.95 px，随后恢复稳定状态，确认正常模式实际播放了 WAAPI。此处记录主代理本轮联测观察，完整操作与截图索引以主验证文档为准；自动化未仅凭 CSS 动画名称判定动画存在。

最后一轮划词重采确认：创建初期父卡环保持在 y=126，随后直接向真实子卡移动至 y=306；采样中未再出现当前环消失或经 home 绕行。独立动效审查实际查看 `selection-before` 和 `selection-0…4` 后给出 `ship`，限于代码、截图序列和受控测试覆盖的范围。

当前浏览器通道只提供 viewport / visibility 等能力，缺少媒体偏好模拟，因此没有真实浏览器的 reduce 模式录帧或视频。reduce 路径的证据限于上述 matchMedia、同步卸载、取消与焦点锁单测及代码检查；不能将其表述为已完成真实浏览器 reduce 动效验证。全方向中间帧与实际设备的主观流畅度也须由主代理的宿主验证结果单独说明。

## 文档核对

已尝试通过 Context7 解析 MDN / Web Animations API，服务返回 `Monthly quota exceeded`，未能取得 Context7 文档；网页搜索也受连接和搜索响应限制，没有提供可用的补充结论。本轮以可访问的 MDN 官方网页和 MDN 官方源码交叉核对 API 契约：

- [Element.animate()](https://developer.mozilla.org/en-US/docs/Web/API/Element/animate)：创建并播放动画，支持关键帧与 timing options。
- [Animation.finished](https://developer.mozilla.org/en-US/docs/Web/API/Animation/finished)：动画完成时 resolve；重新进入播放状态会产生新的 finished Promise。
- [Animation.cancel() 官方源文档](https://github.com/mdn/content/blob/main/files/en-us/web/api/animation/cancel/index.md)：取消会清除效果，未处于 idle 的动画取消时，当前 finished Promise 以 AbortError 拒绝。

实现使用 `Promise.allSettled()` 消化取消拒绝，并通过清理标记与 revision 校验阻止过期完成回调影响新目标。MDN 官方网页与相关官方源码在本轮获取返回 HTTP 200；未据此声称 Context7 检索或浏览器媒体模拟成功。
