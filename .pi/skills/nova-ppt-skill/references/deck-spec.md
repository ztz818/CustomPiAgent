# 页面规格

`deck-spec.json` 是单个演示稿的完整构建依据。它不是单纯的坐标清单，而是“设计意图 + 原生对象”的双层规格。

## 顶层结构

```json
{
  "meta": {
    "title": "演示稿标题",
    "audience": "决策者",
    "purpose": "推动试点决策",
    "core_message": "方案已具备小规模验证条件",
    "language": "zh-CN"
  },
  "plan": {
    "task_contract": {
      "delivery_mode": "现场讲解",
      "desired_outcome": "推动试点决策",
      "content_scope": "仅使用已确认的方案事实",
      "constraints": ["16:9", "原生可编辑"],
      "assumptions": []
    },
    "narrative_rationale": "先建立判断，再给证据和行动；不按源文档章节机械切页",
    "reference_decisions": {
      "borrow": ["标题锚点", "色彩角色", "对象层级"],
      "avoid": ["照抄参考稿内容结构"]
    },
    "asset_decisions": [
      "从风格目录选择视觉起点，并逐项落实颜色和字体角色",
      "布局目录只提供区域起点，页面关系按内容调整",
      "图标只绑定语义节点，关系和数据使用原生对象"
    ]
  },
  "design": {
    "style_id": "warm-executive",
    "grid": "8pt",
    "icon_family": "tabler-filled",
    "reference_deck": "参考稿.pptx",
    "reference_slides": [1, 2, 3],
    "reference_grammar": ["暖白背景", "橙色主张块", "独立图标路径", "标题与正文分层"],
    "composition_rules": ["每页一个第一眼焦点", "不连续使用卡片墙"]
  },
  "canvas": {"width": "960pt", "height": "540pt"},
  "slides": []
}
```

当前构建器使用 16:9 画布，坐标建议统一使用 `pt`。

`plan` 记录进入坐标实现前已经完成的任务、叙事、参考稿和资产决策。它的作用是约束执行路径，不规定固定页序。`asset_decisions` 必须写明风格、布局、图标/图片和原生对象如何使用，不能只列资产 ID。详细流程见 [生成循环](generation-loop.md) 和 [资产操作手册](asset-playbook.md)。

`design` 负责全篇设计决定；如果没有参考稿，省略 `reference_*` 字段。没有使用通用图标时可以省略 `icon_family`。`style_id` 和页面 `layout_id` 都可以使用 `custom:<name>`，目录中的风格和布局只是起点。

使用内置风格时，可以在颜色、字体和页面背景属性中引用设计 token：

- 颜色：`$background`、`$text`、`$muted`、`$accent`、`$accent_soft`、`$surface`、`$border`
- 字体：`$font.title`、`$font.body`、`$font.data`

构建器根据 `design.style_id` 解析 token。这样风格目录会真正落实到对象，而不是只保留一个没有执行效果的 ID。自定义风格使用明确值。

## 页面设计层

每页先写设计层，再写 `elements`：

```json
{
  "name": "service-overview",
  "role": "framework",
  "message": "三项服务覆盖用户旅程的三个阶段",
  "layout_id": "title-three-cards",
  "density": "medium",
  "visual_job": "用共同底座和三条路径表达服务之间的衔接关系",
  "visual_anchor": "中央服务闭环路径",
  "asset_plan": {
    "native": ["shared-base", "three-service-paths", "connectors"],
    "icons": ["tabler-filled/clipboard-check", "tabler-filled/device-heart-monitor", "tabler-filled/shield-check"],
    "pictures": [],
    "motifs": ["orange-number-badge"]
  },
  "text_budget": {"title_max_chars": 24, "body_max_lines": 4, "max_text_blocks": 14},
  "background": "FDFAF5",
  "notes": "说明三项服务之间的衔接关系。",
  "elements": []
}
```

字段含义：

- `role`：页面在叙事中的职责，可以使用常见角色，也可以定义项目特有角色。
- `message`：完整页面结论，不是“服务介绍”这种主题词。
- `layout_id`：几何起点，可以来自布局目录，也可以使用 `custom:<name>`。
- `density`：低、中、高密度，用于安排跨页节奏。
- `visual_job`：视觉需要解释的关系，例如路径、闭环、对比、分层、规模或时间推进。
- `visual_anchor`：第一眼焦点，以及它为什么承载页面结论。
- `asset_plan`：本页要使用的原生图形、图标、图片和重复母题。
- `text_budget`：限制文本量，防止把报告段落直接塞进页面。

## 通用元素

可直接传递的元素类型：

- `shape`
- `textbox`
- `picture`
- `table`
- `chart`
- `connector`
- `group`
- `notes`
- `icon`

每个元素通过 `props` 定义原生演示属性：

```json
{
  "type": "shape",
  "props": {
    "name": "slide-title",
    "text": "三项服务覆盖完整照护旅程",
    "x": "40pt",
    "y": "52pt",
    "width": "860pt",
    "height": "34pt",
    "fill": "none",
    "line": "none",
    "font": "MiSans",
    "size": "22pt",
    "bold": "true",
    "color": "262626",
    "margin": "0pt"
  }
}
```

形状文字内边距必须使用 `margin`，不要使用 `padding`。标题、模块标题、正文、数据和脚注应拆成独立对象，不要把不同层级全部写进同一个长文本框。

## 图标元素

`icon` 从本地矢量素材库解析。先通过 CLI 检索真实文件：

```bash
UV_CACHE_DIR=./uv_cache uv run python \
  .pi/skills/nova-ppt-skill/scripts/nova_ppt_cli.py icons \
  --family tabler-filled --query shield
```

规格示例：

```json
{
  "type": "icon",
  "icon": "tabler-filled/shield-check",
  "color": "EE6F0B",
  "props": {
    "name": "care-node-icon",
    "x": "104pt",
    "y": "158pt",
    "width": "32pt",
    "height": "32pt",
    "alt": "居家安全守护"
  }
}
```

`asset_plan.icons` 中的每个图标都应该在 `elements` 中有对应对象。图标必须与圆底、编号、节点、标题或连接线形成版式关系，不能在页面最后随机添加。

构建器会把 SVG 复制、换色并嵌入 PPTX，同时为 SVG 生成真实 PNG 兼容预览。PowerPoint 保留矢量 SVG，结构预览和不支持 SVG 的软件使用 PNG fallback。图标保持独立替换能力，但通常仍是 SVG 图片对象；如果要求路径级编辑，需要另行使用原生自定义几何。

## 备注

使用 `slide.notes`，或增加一个 `notes` 元素。单页只有一组备注时优先使用 `slide.notes`。

## 命名

同一页对象名必须唯一且能表达语义：

- 推荐：`risk-card-high`、`process-step-assess`、`hero-metric`
- 禁止：`shape1`、`box2`、`new-shape`

稳定命名是后续修改、查询和动画的基础。

## 构建过程

构建器会：

1. 检查页面规格
2. 创建空白演示稿
3. 用原子批处理增加所有页面和原生对象
4. 解析并换色本地 SVG 图标
5. 校验最终 PPTX
6. 输出问题报告和对象统计
7. 在 PPTX 旁保存生成图标和实际执行的命令批次
