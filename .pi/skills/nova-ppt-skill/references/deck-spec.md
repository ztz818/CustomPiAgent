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

`design` 负责全篇设计决定；如果没有参考稿，省略 `reference_*` 字段，但仍然必须明确风格、网格、图标家族和构图规则。

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

- `role`：页面在叙事中的职责，如 `cover`、`thesis`、`framework`、`process`、`timeline`、`decision`。
- `message`：完整页面结论，不是“服务介绍”这种主题词。
- `layout_id`：从布局目录选择的几何起点。
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

构建器会把 SVG 复制、换色并嵌入 PPTX。它保持矢量清晰度和独立替换能力，但通常作为 SVG 图片对象存在；如果要求像参考稿一样达到路径级编辑，应使用原生形状或 raw XML 自定义几何补充。

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
