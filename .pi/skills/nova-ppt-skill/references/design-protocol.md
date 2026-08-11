# 设计协议

Nova 在写具体坐标前，必须先完成设计层。设计层不是额外汇报材料，而是防止 agent 直接退回“文字 + 圆角矩形”的工作底稿。

## 1. 全篇设计决定

在 `deck-spec.json.design` 中记录：

- `style_id`：从 `templates/style-catalog.json` 选择的全篇视觉系统。
- `grid`：默认 `8pt`，所有主要坐标和间距尽量落在网格上。
- `icon_family`：全篇唯一的通用图标家族。
- `reference_deck`：用户提供的参考 PPTX 路径。
- `reference_slides`：真正作为构图样本的页码，不是随便写前三页。
- `reference_grammar`：从参考稿提取的标题位置、图标处理、分区、色彩比例和对象层级。
- `composition_rules`：本次演示必须持续执行的版式规则。

参考稿存在时，先执行结构查看：

```bash
officecli view <reference.pptx> stats
officecli view <reference.pptx> annotated --start 1 --end 6 --max-lines 300
```

不能只读取参考稿文字。至少比较封面、结构页、高密度页的对象数量和图形类型。

## 2. 单页设计决定

每页在 `elements` 之前先写：

- `role`：页面在叙事中的职责，只能使用 Schema 定义的角色。
- `message`：完整结论，不是页面主题。
- `evidence`：支撑结论的事实、数字或机制。
- `layout_id`：使用的布局骨架。
- `density`：低、中、高密度。
- `visual_job`：这页需要让受众看懂什么关系。
- `visual_anchor`：第一眼焦点是什么。
- `asset_plan`：要使用的原生图形、图标、图片和重复视觉母题。
- `text_budget`：标题长度、正文行数和文本块数量上限。

没有这些设计决定时，不要直接写坐标。

## 3. 三页老板汇报的默认节奏

除非用户明确要求逐项产品介绍，三页汇报优先采用：

1. `cover` 或 `thesis`：建立主题和核心判断，低密度，一个强主视觉。
2. `framework` 或 `comparison`：展示整体模型、共同底座和关键差异，中密度。
3. `decision` 或 `timeline`：展示验证节奏、决策点和下一步，中低密度。

不要默认把三页拆成三个产品，也不要在每页重复背景、流程、计划和边界。

## 4. 图标选择必须基于真实文件

先用 CLI 检索，再写 `asset_plan.icons`：

```bash
UV_CACHE_DIR=./uv_cache uv run python \
  .pi/skills/nova-ppt-skill/scripts/nova_ppt_cli.py icons \
  --family tabler-filled --query shield
```

只使用检索结果中的完整图标 ID。每个计划中的图标都必须在 `elements` 中出现对应的 `type: icon`，不能用圆形、编号或文字代替。

## 5. 从设计层落到对象层

推荐顺序：

1. 页面背景和分区。
2. 主视觉、主轴、关系线或数据图形。
3. 图标及其底形。
4. 标题和一级结论。
5. 支撑文字、标签和脚注。

不要先写大段文字，再用卡片包裹。重复模块中，图标、标题、正文和数字应是独立对象，以便分别控制层级和对齐。

## 6. 自检问题

写完规格后先回答：

- 删除所有正文，页面是否仍能看出结构和阅读方向？
- 第一眼焦点是否只有一个？
- `asset_plan.icons` 是否真的变成了 `type: icon`？
- 三页的构图是否有变化，但视觉系统仍然一致？
- 是否有页面同时承担两个以上主要任务？

任何一个答案不理想，先改设计层，再改对象坐标。
