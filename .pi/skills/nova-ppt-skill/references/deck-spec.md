# 页面规格

`deck-spec.json` 是单个演示稿的完整构建依据。

## 顶层结构

```json
{
  "meta": {
    "title": "演示稿标题",
    "audience": "决策者",
    "core_message": "方案已具备小规模验证条件",
    "language": "zh-CN"
  },
  "canvas": {"width": "960pt", "height": "540pt"},
  "slides": []
}
```

当前构建器使用 16:9 画布，坐标建议统一使用 `pt`。

## 页面

```json
{
  "name": "service-overview",
  "role": "thesis",
  "message": "三项服务覆盖用户旅程的三个阶段",
  "background": "FDFAF5",
  "notes": "说明三项服务之间的衔接关系。",
  "elements": []
}
```

`role` 和 `message` 用于创作和检查，默认不显示在页面上。

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

形状文字内边距必须使用 `margin`，不要使用 `padding`。

## 图标元素

`icon` 从本地矢量素材库解析：

```json
{
  "type": "icon",
  "icon": "tabler-filled/clipboard-check",
  "color": "EE6F0B",
  "props": {
    "name": "assessment-icon",
    "x": "104pt",
    "y": "158pt",
    "width": "32pt",
    "height": "32pt",
    "alt": "评估清单"
  }
}
```

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
