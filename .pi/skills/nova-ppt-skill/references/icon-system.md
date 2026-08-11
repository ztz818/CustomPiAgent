# 图标与矢量资产

Nova 自带一套本地 SVG 矢量资产，用于构建页面图标、流程符号、类别锚点和品牌类标识。

## 图标选择

优先级：

1. 语义准确
2. 视觉重量合适
3. 与整套演示风格一致
4. 小尺寸仍然清晰

## 通用图标家族

- `chunk-filled`：适合技术、系统、硬朗结构
- `tabler-filled`：适合医疗、服务、亲和界面
- `tabler-outline`：适合轻量说明和高密度页面
- `phosphor-duotone`：适合带层次感的重点图标
- `simple-icons`：只用于真实品牌或产品标志

## 使用决策

按页面任务选图标，而不是按“看起来好看”选图标：

- 类别/服务：选能直接表达对象的名词图标，例如筛查用 `clipboard`，康复在实心家族中用 `device-heart-monitor`，在线性家族中用 `activity`/`walk`，安护用 `shield`/`bell`。
- 流程/动作：选动作或状态图标，例如 `check`、`phone-call`、`calendar`、`alert-triangle`，并沿主轴排列。
- 风险/边界：选 `shield`、`alert`、`lock` 等图标，配合风险色或边界说明，不要用来装饰普通段落。
- 医疗/照护：优先使用 `tabler-filled` 或 `phosphor-duotone`，保持亲和与可识别；只有需要技术骨架时才用 `chunk-filled`。
- 高密度流程和表格：优先使用 `tabler-outline`，减少视觉重量，避免图标抢过数据。

## 组合方法

在 deck-spec 中，图标要和它服务的结构对象一起规划：

```json
{
  "type": "icon",
  "icon": "tabler-filled/shield-check",
  "color": "EE6F0B",
  "props": {
    "name": "care-node-icon",
    "x": "68pt",
    "y": "170pt",
    "width": "32pt",
    "height": "32pt",
    "alt": "居家安全守护"
  }
}
```

常见组合：

- `圆底 shape → icon → 标题 → 短说明`：三项服务、分类、能力模块。
- `主轴 connector → 节点 shape → icon → 阶段文字`：流程、时间线、用户旅程。
- `大数字/图表 → 小图标 → 一句解释`：数据页和指标页。
- `主视觉 shape/picture → 标题 → 证据标签`：封面和主张页。

不要把图标直接塞进长文本框，也不要让图标替代必要的标题、数据和关系线。图标的作用是让受众更快定位和区分信息。


## 本地资产位置

Nova 的图标库位于：

```text
.pi/skills/nova-ppt-skill/assets/icons/
```

每个图标仍按原库目录和文件名组织，便于检索与替换。

## 处理方式

构建器会把 SVG 图标复制或生成到输出目录，再作为矢量对象嵌入到 PPTX 中。这样既保留编辑性，也能保持风格一致。

## 自定义矢量

如果需要自定义 SVG：

- 保留 `viewBox`
- 删除脚本和外部引用
- 尽量使用单色或少色
- 能用 `currentColor` 的地方优先使用 `currentColor`
