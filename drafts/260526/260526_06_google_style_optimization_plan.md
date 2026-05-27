# CustomPiAgent Google 风格设计改良规格

日期：260526
范围：`cutom_pi_web`
状态：设计规格，先审阅再动手

## 0. 一句话目标

在不破坏现有工作流和细节交互的前提下，参考 Google Workspace / Material 3 的专业设计方法，用更清晰的颜色层级、surface、控件状态、间距和可访问性，把当前 UI 从“功能完整但简陋”提升到“专业、清爽、克制的开发者工作台”。

## 1. 设计判断

当前版本不是方向错，而是质感不够：

- 三栏工作台方向是对的。
- 顶部状态、分支、系统提示、文件查看、模型/工具/推理控制这些细节值得保留。
- ChatInput 的能力完整，交互密度适合 agent 工具。
- 问题主要在视觉系统不稳定：颜色、边框、圆角、按钮、菜单、hover/focus、空态和响应式没有形成统一语言。

因此本轮不是“重设计”，而是“设计系统化 + 质感升级”。

## 2. 使用 UI/UX Skill 的方式

`ui-ux-pro-max` 只作为专业参考和检查表，不直接照搬它的推荐模板。

采用：

- 设计系统思路：颜色令牌、字体、surface、控件状态、响应式、可访问性。
- UX 检查项：focus、keyboard、hover、reduced motion、移动端无横向滚动。
- 前端栈建议：React / Next.js 下的组件拆分、复用和性能边界。

不采用：

- 默认暗色终端风。
- 营销页结构。
- 大面积 glow、强装饰、夸张动画。
- 与当前产品工作流无关的视觉模板。

## 3. 必须保留的现有细节

这些是当前版本的价值点，优化时不能随手删：

- 三栏布局：左会话/文件，中间聊天，右文件查看。
- 顶部栏中的主题、分支、系统提示、token/cost/context 状态。
- ChatInput 的图片附件、模型选择、工具预设、推理强度、Compact、声音、Stop、Steer、Follow-up。
- 文件树的 `mention` 能力。
- 消息上的 Copy、Edit from here、New session。
- 主题切换的动效可以保留，但需要尊重 `prefers-reduced-motion`。
- 开发者工具的紧凑感，不能改成松散的 SaaS 首页。

## 4. 风格方向

### 4.1 目标气质

参考 Google Workspace / Material 3 的工具型产品：

- 浅色优先，暗色为高质量辅助。
- 画布干净，区域层级明确。
- 控件统一，状态清楚。
- 字体亲和但理性。
- 动效少而准。
- 高密度信息仍然可扫描。

### 4.2 视觉令牌草案

```text
Primary:              #1A73E8
Primary hover:        #1558B0
On primary:           #FFFFFF

Background:           #FFFFFF
Surface:              #FFFFFF
Surface container:    #F8FAFD
Surface high:         #F1F3F4
Surface selected:     #E8F0FE

Outline:              #DADCE0
Outline variant:      #E8EAED

Text primary:         #202124
Text secondary:       #5F6368
Text disabled:        #9AA0A6

Success:              #188038
Warning:              #F9AB00
Error:                #D93025
```

暗色主题不走纯黑终端风，改为 Material dark surface：

```text
Dark background:        #131314
Dark surface:           #1E1F20
Dark surface container: #282A2C
Dark outline:           #3C4043
Dark text primary:      #E8EAED
Dark text secondary:    #BDC1C6
Dark primary:           #A8C7FA
```

### 4.3 圆角和密度

```text
Top bar height:      44-48px
Icon button:         32-36px hit area, 8px visual radius
Toolbar button:      32px height, 8px radius
Chip:                28-32px height, 8px radius
Input box:           14-16px radius
Menu / popover:      10-12px radius
Message bubble:      12px radius
Panel radius:        0，工作台区域不要变成卡片堆叠
```

### 4.4 字体

- UI 主体继续使用系统 sans。
- 代码、路径、token 数字使用 mono。
- 标题和品牌不要大面积使用 mono，避免过重的终端感。

## 5. 信息架构

保留当前结构，只重新整理层级：

```text
AppShell
├── TopBar
│   ├── sidebar toggle
│   ├── theme toggle
│   ├── branch / system prompt controls
│   ├── session status chips
│   └── file panel toggle
├── Sidebar
│   ├── app identity / cwd switcher
│   ├── session list
│   ├── file explorer
│   └── models / skills actions
├── Conversation
│   ├── empty state
│   ├── message list
│   └── chat input
└── FileInspector
    ├── tabs
    └── file viewer
```

## 6. 分阶段计划

### Phase 1：基础质感层

目标：不动业务逻辑，先让后续优化有统一基础。

文件范围：

- `cutom_pi_web/app/globals.css`
- `cutom_pi_web/components/ui/*`
- 少量引用点，优先 TopBar 按钮

内容：

- 增加 Google/Material 语义 CSS 变量。
- 保留当前 `--bg`、`--text`、`--accent` 等变量作为兼容层。
- 增加 `:focus-visible`。
- 增加 `prefers-reduced-motion`。
- 新增轻量 UI 基元：
  - `IconButton`
  - `Chip`
  - `Surface`
  - `MenuItem` 或 `ToolbarButton`

验收：

- 页面视觉不大变形。
- 新组件状态完整：default、hover、active、disabled、focus-visible。
- `npm_config_cache=./npm_cache npm run lint` 无 error。

### Phase 2：TopBar 和整体 surface

目标：第一眼从“简陋控制台”变成“专业工作台”。

文件范围：

- `components/AppShell.tsx`
- 可选新增 `components/TopBar.tsx`
- 可选新增 `components/RightFilePanel.tsx`

内容：

- 顶部栏提高到 44-48px。
- sidebar/theme/file panel 按钮迁移到 `IconButton`。
- token/cost/context 改成 compact status chips。
- 左侧栏使用 `surface-container`。
- 中间聊天区使用干净 `surface`。
- 右侧文件区使用 inspector surface。

保留：

- 现有分支、系统提示、统计逻辑。
- 文件面板开关能力。

验收：

- 1024px 以上三栏层级清楚。
- 顶部栏按钮尺寸统一。
- 没有横向滚动。

### Phase 3：ChatInput 质感升级

目标：保留功能密度，减少视觉噪音。

文件范围：

- `components/ChatInput.tsx`
- 可选拆分 `components/chat-input/*`

内容：

- 输入框改成 Material prompt box。
- 模型、工具、推理强度改成 chip 风格，但仍保留当前 dropdown 行为。
- Send 保持文字 + icon 桌面形态，移动端可收敛为 icon。
- Steer / Follow-up 改成更克制的 segmented action。
- 附件预览移除按钮补 `aria-label`。

保留：

- 图片粘贴/拖拽/附件能力。
- 模型、工具、推理强度全部能力。
- Compact、声音、Stop、Steer、Follow-up。

验收：

- 375px 下底部工具区不破版。
- 空闲态和运行态容易区分。
- 键盘 focus 可见。

### Phase 4：消息阅读体验

目标：提高聊天内容的专业可读性。

文件范围：

- `components/MessageView.tsx`
- `app/globals.css` 的 markdown/code 样式

内容：

- 用户消息使用浅蓝 tonal surface。
- 助手消息保持正文优先，少边框少背景。
- 工具调用使用低强调 container。
- Copy / Edit / New session 支持 hover + focus-within，不只依赖鼠标。
- 代码块、表格、引用、工具输出加强层级。

保留：

- 现有消息动作。
- Markdown 和代码高亮能力。
- 工具结果 inline 展示逻辑。

验收：

- 长消息扫描更轻松。
- 操作按钮不会突兀常驻。
- 键盘用户能触达消息操作。

### Phase 5：Sidebar / FileExplorer

目标：让左侧像 Google Workspace 的导航/资源面板。

文件范围：

- `components/SessionSidebar.tsx`
- `components/FileExplorer.tsx`
- `components/FileIcons.tsx`

内容：

- cwd/project selector 视觉更明确。
- 会话列表 selected/hover/focus 统一。
- 文件树行高、缩进、图标尺寸统一。
- `mention` 保留，但从文字按钮收敛成轻量 action。
- Models / Skills 底部动作统一为工具区。

验收：

- 当前 cwd、当前 session、文件 hover 状态不混淆。
- 左侧仍保持高密度。

### Phase 6：响应式和暗色主题收尾

目标：保证改完不是只在桌面好看。

内容：

- 375px、768px、1024px、1440px 检查。
- <= 640px 顶部栏收敛次级信息。
- 文件面板移动端表现为 full-screen sheet。
- 输入区 chips 可横向滚动。
- 暗色主题对比和 surface 层级重新校准。

验收：

- 无明显重叠。
- 无横向滚动。
- 暗色不刺眼，浅色不廉价。

## 7. 明确不做

- 不重写 agent/session 业务逻辑。
- 不引入大型 UI 组件库。
- 不把产品改成营销首页。
- 不删除现有高价值细节。
- 不一次性把所有内联 style 全部重构。
- 不为了“Material 标准”牺牲现有开发者工作流。

## 8. 第一轮实施建议

第一轮只做 Phase 1 + TopBar 少量接入：

1. 更新 `globals.css`：设计令牌、focus、reduced-motion。
2. 新增 `components/ui/IconButton.tsx`。
3. 新增 `components/ui/Chip.tsx`。
4. 新增 `components/ui/Surface.tsx`。
5. 只迁移 TopBar 的 sidebar、theme、file panel 三个按钮。

这样能先建立风格基础，同时风险低、回滚容易。

## 9. 验证清单

每轮实现后检查：

- `npm_config_cache=./npm_cache npm run lint`
- 375px：无横向滚动，输入区不破版。
- 768px：右侧文件区打开时聊天仍可用。
- 1024px：三栏清晰。
- 1440px：内容不显得散。
- 浅色：文字对比清楚。
- 暗色：surface 层级清楚。
- 键盘 Tab：焦点可见，主要按钮可达。

## 10. 决策记录

- 采用 Google Workspace / Material 3 作为参考，不照搬组件库。
- 保留当前交互细节，主要做质感升级。
- 先设计文档，确认后再动代码。
- 第一轮从基础令牌和少量 TopBar 接入开始，不碰业务逻辑。
