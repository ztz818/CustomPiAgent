# cutom_pi_web 前端架构与 UI/UX 审查

日期：260526
范围：`cutom_pi_web`
偏好：Google / Material 风格，偏清晰、明亮、克制、可扫描。

## 1. 项目架构理解

`cutom_pi_web` 是一个 Next.js 16 + React 19 的 Pi Coding Agent Web UI，不是营销站，而是开发者工作台。

核心结构：

- `app/page.tsx`：入口，仅渲染 `AppShell`。
- `components/AppShell.tsx`：主应用外壳，负责三栏布局、会话选择、顶部状态栏、模型/Skill 配置弹窗、文件标签页。
- `components/SessionSidebar.tsx`：左侧会话、项目目录、文件浏览入口。
- `components/ChatWindow.tsx`：聊天主区域，连接 `useAgentSession`，展示消息、拖拽上传、空态输入页、运行状态。
- `components/ChatInput.tsx`：输入框、模型选择、工具预设、推理强度、图片附件、运行中 steer/follow-up。
- `components/MessageView.tsx`：用户/助手消息、Markdown、代码高亮、工具调用、复制/分叉/编辑动作。
- `components/FileViewer.tsx` + `TabBar.tsx`：右侧文件查看与标签页。
- `hooks/useAgentSession.ts`：前端状态编排核心，负责会话读取、SSE、发送、分叉、压缩、模型/工具配置。
- `app/api/**`：本地 Next API 层，包装 Pi agent 会话、文件读取、模型配置、Skill 搜索/安装、认证。

整体信息架构：

```text
左侧：项目 / 会话 / 文件树
中间：会话聊天流 / 输入区 / 运行状态
右侧：文件查看器
顶部：全局导航、主题、分支、系统提示、token/cost/context 状态
```

## 2. 设计现状判断

优点：

- 信息架构贴近开发者工作流，三栏结构合理。
- 状态能力完整：会话、分支、系统提示、模型、工具、上下文、费用都已有入口。
- 色彩变量集中在 `globals.css`，具备主题化基础。
- 交互细节不少：拖拽上传、主题切换动画、hover 操作、运行中 steer/follow-up。

主要问题：

- UI 风格更像“自制 IDE + Chat 控制台”，还没有形成稳定的 Google / Material 设计语言。
- 组件大量使用内联 style，按钮、菜单、输入框、面板样式重复，导致一致性和后续改版成本偏高。
- 可访问性不足：大量 icon button 只有 `title`，缺少 `aria-label`；hover-only 操作对键盘和触屏不友好；focus 样式不系统。
- 移动端和窄屏场景压力较大：底部输入工具栏、顶部状态栏、右侧文件面板容易拥挤。
- 动效没有统一遵守 `prefers-reduced-motion`，部分动画偏装饰，和 Google 风格的“功能性动效”不完全一致。

## 3. Google 风格方向

建议目标不是照搬 google.com，而是采用 Google Workspace / Material 3 的产品工具气质：

- 背景：浅色优先，`#FFFFFF` 主画布，`#F8FAFD`/`#F1F3F4` 作为侧栏与次级面。
- 主色：Google Blue `#1A73E8` 或 Material Blue `#0B57D0`，只用于主动作、选中态、链接和焦点。
- 状态色：Success `#188038`，Warning `#F9AB00`，Error `#D93025`。
- 圆角：工具类控件 8px，输入框 16px 左右，避免过多 12-14px 混用。
- 字体：系统 sans 为主，代码和路径才使用 mono。当前标题和品牌过多 mono，会降低 Google 风格的亲和与清晰度。
- 阴影：少用重阴影，更多使用 1px border + surface tint；浮层使用 `0 1px 2px rgba(60,64,67,.3), 0 2px 6px rgba(60,64,67,.15)`。

## 4. 优化清单

### P0：建立设计令牌与组件基元

当前 `globals.css` 已有 CSS 变量，但仍是较粗的 `--bg`、`--text`、`--accent`。建议扩展成 Material/Google 语义令牌：

- `--surface`
- `--surface-container`
- `--surface-container-high`
- `--outline`
- `--outline-variant`
- `--primary`
- `--primary-hover`
- `--on-primary`
- `--error`
- `--warning`
- `--success`

同时抽出基础组件：

- `IconButton`
- `ToolbarButton`
- `Menu`
- `MenuItem`
- `Panel`
- `Dialog`
- `TextField`
- `SegmentedControl`

收益：后续把 AppShell、ChatInput、MessageView、Sidebar 统一成 Google 风格时，不需要逐个改内联 style。

### P0：补齐可访问性

重点问题：

- icon-only button 应补 `aria-label`，不能只依赖 `title`。
- hover-only 的 Copy / Edit / New session 操作需要 `:focus-within` 或常驻更多菜单。
- 自定义 dropdown 需要基本键盘支持：Escape 关闭、上下键移动、Enter 选择，或至少用语义化 `button` + `aria-expanded` + `aria-controls`。
- 图片附件 `alt=""` 如果是用户内容预览，可接受装饰性处理，但移除按钮需要 `aria-label="Remove image"`。
- 全局补 `:focus-visible` 设计，使用 Google 蓝描边。

### P1：重塑主工作台视觉层级

建议改成 Google Workspace 风格：

- 顶部栏高度从 36 提升到 48，增加呼吸感和点击目标。
- 左侧栏使用 `#F8FAFD`，主聊天画布保持白色。
- 右侧文件面板使用 `surface-container`，和左栏形成对称。
- 当前顶部状态 token/cost/context 过于压缩，建议改成右上角 compact chips，点击后展开详情。
- `Models` / `Skills` 底部按钮建议变成左侧栏底部的 `Navigation rail actions`，统一 icon + label 尺寸。

### P1：输入区改成 Material prompt box

当前输入框功能完整，但底部工具栏在窄屏容易拥挤。建议：

- 主输入框保持居中 max-width，但使用 Material `outlined` 或 `filled tonal` 风格。
- Send 按钮改为圆形/方形 icon button，文字 Send 可在桌面保留，移动端隐藏。
- 模型、工具、推理强度收进一排 chips：`Model`, `Tools`, `Thinking`。
- 运行中 `Steer` / `Follow-up` 建议用 segmented control 或 split action，减少两个彩色按钮的视觉噪音。
- 空态页删除打字机随机文案，改成 Google 风格的简洁欢迎和 3-4 个建议 prompt chip。

### P1：统一图标体系

当前项目大量手写 SVG，尺寸、stroke、语义不完全统一。建议引入 `lucide-react` 或 Material Symbols：

- 如果追求 Google 风格，优先 Material Symbols。
- 如果更工程化轻量，使用 `lucide-react`，但颜色和尺寸按 Google 风格约束。

统一规则：

- toolbar icon：20px
- compact row icon：16px
- status icon：14px
- stroke width 2 或 Material Symbols rounded

### P1：响应式布局优化

当前移动端只处理了左侧 overlay 和右侧 100% 宽，但顶部和输入区仍可能拥挤。建议：

- <= 640px：顶部只保留 sidebar、theme、file panel、更多菜单。
- token/cost/context 移入更多菜单或底部 sheet。
- 右侧文件面板打开时应像 route/sheet，而不是和聊天区横向挤压。
- 输入区底部工具栏改为可横向滚动 chips，保证 375px 无横向溢出。

### P2：减少装饰性动效，补 reduced motion

需要保留的动效：

- 主题切换
- sidebar / file panel open-close
- dropdown/floating panel transition
- drag-drop feedback

建议降低或可关闭：

- 标题 scramble
- 空态 typewriter
- 大面积 drop ripple

同时在 CSS 增加：

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
}
```

### P2：代码结构优化

建议优先拆分这些区域：

- `AppShell`：拆成 `TopBar`、`SidebarFooterActions`、`RightFilePanel`、`SystemPromptPanel`。
- `ChatInput`：拆成 `AttachmentPreviewList`、`PromptTextarea`, `ModelMenu`, `ToolPresetMenu`, `ThinkingMenu`, `StreamingActions`。
- `MessageView`：拆成 `MessageActions`、`UserBubble`、`AssistantContent`、`ToolCallBlock`。

这不是为了“架构完整”，而是因为现有组件已超过易维护阈值，且样式重复阻碍设计统一。

## 5. 建议实施顺序

1. 先建 `components/ui/` 基础组件和 `globals.css` Google/Material 令牌。
2. 改 `ChatInput`，因为这是用户最高频交互区，收益最大。
3. 改 `TopBar` 和左右面板 surface，让整体第一眼变成 Google 工具风格。
4. 改 `MessageView`，统一消息气泡、动作按钮、hover/focus。
5. 做移动端专项：375px、768px、1024px、1440px 四档检查。
6. 最后处理动画、空态、图标库替换。

## 6. 校验结果

执行：

```bash
npm_config_cache=./npm_cache npm run lint
```

结果：

- 0 errors
- 1 warning：`components/MessageView.tsx:616:41` 中 `isRunning` 未使用。

## 7. 风险

- 项目 API 层会读写 Pi agent 目录和认证配置，本次只做前端架构/UI 审查，未改后端路径策略。
- 如果直接一次性替换所有内联 style，风险较高；建议先引入组件基元，再逐块迁移。
- Google 风格更偏浅色与产品化，若目标用户长期在暗色 IDE 中使用，需要保留高质量暗色主题，但不要让暗色成为唯一设计基准。
