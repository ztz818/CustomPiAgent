# 运行说明

Nova 的执行路径是：任务契约 → 内容与叙事计划 → 参考稿转译 → 视觉草图 → 资产选择 → `deck-spec.json` → PPTX → 四层验收。

`deck-spec.json` 是实现规格，不是设计思考的起点。中间设计记录放在本次任务的 `drafts/YYMMDD/` 目录，不写入 skill，也不作为后续任务模板。

## 目录职责

```text
.pi/skills/nova-ppt-skill/
├── SKILL.md                         # 总入口和强制执行顺序
├── references/
│   ├── generation-loop.md          # 从任务到返工的完整生成循环
│   ├── asset-playbook.md           # 风格、布局、图标、原生对象和脚本教程
│   ├── content-architecture.md     # 内容取舍与叙事
│   ├── visual-system.md            # 字体、颜色、形状和间距
│   ├── layout-patterns.md          # 关系到构图的转换方法
│   ├── design-protocol.md          # 全篇和单页设计字段
│   ├── deck-spec.md                # 对象规格写法
│   └── quality-gates.md            # 内容、结构、视觉和技术验收
├── templates/
│   ├── style-catalog.json          # 可拆解的视觉系统起点
│   └── layout-catalog.json         # 可调整的几何区域起点
├── assets/icons/                   # 可检索的本地 SVG 图标库
├── schemas/deck-spec.schema.json   # 规格结构
└── scripts/nova_ppt_cli.py         # 资产查询、lint 和构建
```

## 强制执行顺序

### 1. 建立任务契约

读取用户要求和源材料，记录受众、场景、目标动作、核心结论、事实边界、页数和编辑要求。信息不足且会改变方案时询问用户；可以合理推断时记录假设。

停止条件：还不能说明“受众看完后应发生什么变化”时，不进入页面设计。

### 2. 形成内容与页序计划

按 [生成循环](generation-loop.md) 提炼每页结论、证据、视觉关系和排除内容。页序必须能解释为什么适合本次任务，不能按章节标题或业务项数量机械拆页。

停止条件：任一页面同时承担多个同权任务时，先重组内容。

### 3. 转译参考稿

如果有参考 PPTX，使用结构和逐页视图选择不同角色的参考页。记录借鉴与不借鉴项，包括几何、对象语言、字体层级、颜色角色、留白和跨页母题。

停止条件：只得到“高级、简洁、暖色、商务”等形容词时，分析不合格。

### 4. 盘点并选择资产

先执行：

```bash
UV_CACHE_DIR=./uv_cache uv run python \
  .pi/skills/nova-ppt-skill/scripts/nova_ppt_cli.py catalog styles
UV_CACHE_DIR=./uv_cache uv run python \
  .pi/skills/nova-ppt-skill/scripts/nova_ppt_cli.py catalog layouts
UV_CACHE_DIR=./uv_cache uv run python \
  .pi/skills/nova-ppt-skill/scripts/nova_ppt_cli.py catalog components
UV_CACHE_DIR=./uv_cache uv run python \
  .pi/skills/nova-ppt-skill/scripts/nova_ppt_cli.py catalog icons
UV_CACHE_DIR=./uv_cache uv run python \
  .pi/skills/nova-ppt-skill/scripts/nova_ppt_cli.py catalog fonts
```

再按 [资产操作手册](asset-playbook.md) 选择风格、布局起点、对象级视觉组件、图标家族和原生对象。每项选择必须记录用途；目录不适配时使用 `custom:<name>`，不要硬套。

停止条件：只写了风格或布局 ID，却没有说明如何落到颜色、字体、区域和对象时，不进入规格编写。

### 5. 画视觉草图

每页记录第一眼焦点、阅读路径、主视觉、支撑层、空白和文字策略。隐藏正文后仍应能识别关系和方向。

停止条件：草图本质仍是“标题 + 若干等权文字卡片”时，重新构图。

### 6. 编写 `deck-spec.json`

先写全篇 `design` 和单页设计字段，再按背景、主视觉、关系、图标/图片、标题、证据、脚注的顺序写对象。遵循 [页面规格说明](deck-spec.md)。

需要图标时必须先检索真实文件：

```bash
UV_CACHE_DIR=./uv_cache uv run python \
  .pi/skills/nova-ppt-skill/scripts/nova_ppt_cli.py icons \
  --family <family> --query <term>
```

### 7. 检查和构建

```bash
UV_CACHE_DIR=./uv_cache uv run python \
  .pi/skills/nova-ppt-skill/scripts/nova_ppt_cli.py lint \
  --spec <deck-spec.json>

UV_CACHE_DIR=./uv_cache uv run python \
  .pi/skills/nova-ppt-skill/scripts/nova_ppt_cli.py build \
  --spec <deck-spec.json> \
  --output <presentation.pptx>
```

`lint` 会同时检查：

- 必需的任务、叙事和页面设计字段
- 未知风格、缺失素材和图标 ID
- 字体在本机是否发生回退
- 文本块是否超过页面预算
- 字号层级是否过少
- 是否缺少结构性视觉对象
- 圆角矩形是否占比过高并疑似卡片墙
- 页面字符量是否与声明密度冲突
- 对象命名、画布边界和基础几何

这些诊断用于指出返工方向，不会替代人工视觉判断。`warning` 不要求清零：必须判断是否确有问题，并记录接受或返工理由。禁止仅通过替换形状类型或改写声明字段绕过检测。

`build` 会解析风格 token、物化 SVG、生成真实 PNG 兼容预览、写入命令记录、构建 PPTX，并执行结构和版面技术检查。两者都不判断最终审美。

### 8. 轻量验收

按 [质量门](quality-gates.md) 检查内容、叙事、设计规格和 PPTX 技术状态。`build` 已执行结构校验和版面问题检查，通常不需要重复运行相同命令；按需要补充 `officecli view <file> text` 或 `stats` 即可。

实际截图仅在环境已经有可用渲染器时执行。最多尝试一次；失败后标记“视觉验证受限”并交付。未经用户明确同意，不安装 Playwright、Chromium 或其他渲染依赖，不连续尝试多套截图工具。

## 交付物

每次任务至少保留：

- 最终 `.pptx`
- `deck-spec.json`
- 本次任务的设计计划或视觉草图记录
- 生成素材目录和 `nova_commands.json`
- 四层验收结果及限制

## 返工路由

- 内容不符合要求：回到步骤 1-2。
- 页序或信息结构不合理：回到步骤 2。
- 页面平、乱或像卡片墙：回到步骤 3-5。
- 字体、颜色或图形不合适：回到步骤 4-6。
- 可编辑性或文件错误：回到步骤 6-7。
- 可选渲染失败：停止渲染尝试，标记限制，不触发内容和构建返工。

禁止通过增加随机图标、装饰形状、阴影或缩小字体来掩盖上游问题。
