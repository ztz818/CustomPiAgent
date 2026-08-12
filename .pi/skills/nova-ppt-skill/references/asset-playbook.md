# 资产操作手册

本手册说明 agent 如何发现、选择和调用 Nova 内置资产。资产目录不是让 agent 浏览后凭感觉猜测的素材堆；每种资产都有查询入口、选择条件和规格映射。

## 1. 开始任务时先盘点资产

在设计页面前执行：

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

这些命令分别回答：现有视觉系统有哪些、现有几何起点有哪些、有哪些对象级视觉组件、图标家族和规模是什么、风格目录中的字体在本机是否真实可用。不要用 `find` 随机挑文件，也不要猜不存在的 ID。

## 2. 风格资产

文件：`templates/style-catalog.json`

每个风格包含：

- `colors`：背景、正文、弱化、强调、浅强调、表面和边框的角色色。
- `fonts`：标题、正文和数据字体。
- `shape_language`：圆角、线宽和阴影规则。
- `icon_family`：与该风格匹配的图标起点。
- `use_for`：推荐任务，不是用途白名单。

### 选择流程

1. 根据受众和场景选视觉语气，例如可信、理性、技术、编辑或温和。
2. 检查参考稿或品牌是否要求特定字体和颜色。
3. 从目录选择最接近的起点，或使用 `custom:<name>`。
4. 在设计计划中记录保留、替换和新增的角色，不要只记录 `style_id`。
5. 将角色值逐项写入页面对象，不能假设构建器会自动套用风格。

示例决策，不是固定模板：

```text
style_id: clinical-trust
保留：低饱和背景、绿色强调、无阴影
替换：标题字体改为用户品牌字体
新增：风险状态使用红/黄/绿，但只用于状态语义
```

将风格角色写成 token 可以避免手工复制颜色和字体：

```json
{
  "background": "$background",
  "props": {
    "fill": "$surface",
    "line": "$border",
    "color": "$text",
    "font": "$font.body"
  }
}
```

支持 `$background`、`$text`、`$muted`、`$accent`、`$accent_soft`、`$surface`、`$border`，以及 `$font.title`、`$font.body`、`$font.data`。构建器根据 `design.style_id` 解析；使用 `custom:<name>` 时应写明确值。

### 字体检查

风格目录中的字体是设计起点，不保证所有运行环境都已安装。选择字体后先检查：

```bash
fc-match "MiSans"
fc-match "LXGW Bright"
```

如果返回的是其他字体，说明发生了系统回退。此时应选择实际可用且气质接近的字体，或明确说明交付环境需要安装字体。构建后再用：

```bash
officecli view <presentation.pptx> stats
```

确认标题、正文和数据对象确实使用了预期字体。字体选择要同时考虑中文覆盖、数字清晰度、标题字重和现场投屏可读性，不能因为参考稿使用某字体就假设当前环境可用。

### 何时自定义

用户有品牌规范、参考稿风格明显、目录色彩与主题冲突，或任务需要完全不同的视觉语气时使用 `custom:<name>`。自定义必须补齐颜色角色、字体角色、形状语言和图标/图片处理方式，不能只写两个颜色值。

## 3. 布局资产

文件：`templates/layout-catalog.json`

布局只提供安全区和区域关系，不包含业务内容，也不决定页面顺序。通过 `catalog layouts` 查看每个布局的角色、密度和区域名。

### 使用流程

1. 先定义本页结论和视觉关系。
2. 找到区域关系接近的布局，例如主视觉+证据、指标+图表、表格+注释。
3. 读取该布局的 `regions` 坐标作为起点。
4. 根据文字长度、主视觉比例和参考稿语法修改区域。
5. 内容不适配时使用 `custom:<name>`，不要硬塞。

布局 ID 必须表达几何来源：

```text
layout_id: data-focus              # 基于目录，允许调整
layout_id: custom:radial-ecosystem # 完全自定义
```

不要将 `title-three-cards` 解释成“任何三个概念都必须画三张卡”。它只表示三个同级区域的一个候选几何。

## 3.5 视觉组件

文件：`templates/component-catalog.json`

组件是对象组的构成规则，不是整页模板。通过命令查看：

```bash
UV_CACHE_DIR=./uv_cache uv run python \
  .pi/skills/nova-ppt-skill/scripts/nova_ppt_cli.py catalog components
```

选择顺序：先判断页面关系，再选择 1 个主组件和最多 2 个支撑组件。例如主组件可以是 `process-axis`，支撑组件可以是 `metric-focus` 和 `decision-band`。组件的 `layers` 要落实为独立对象，`quality_rules` 用于检查层级、对齐和语义。

不要为了丰富度把所有组件放进一页。组件目录解决的是对象层级和组合质量，不决定页序、内容或视觉风格。

## 4. 图标资产

目录：`assets/icons/<family>/*.svg`

先查看家族，再按英文语义关键词检索：

```bash
UV_CACHE_DIR=./uv_cache uv run python \
  .pi/skills/nova-ppt-skill/scripts/nova_ppt_cli.py icons \
  --family tabler-outline --query calendar --limit 20
```

检索不到时按顺序处理：

1. 缩短关键词，如 `walking` 改为 `walk`。
2. 使用同义词，如 `alert`、`alarm`、`bell`。
3. 使用 `--family all` 查找其他家族。
4. 判断是否应该用原生形状或图片表达，而不是强行找图标。

家族职责：

- `chunk-filled`：硬朗实心，适合技术、系统、深色高对比。
- `tabler-filled`：友好实心，适合服务、医疗和管理汇报。
- `tabler-outline`：轻量线性，适合流程、说明和高密度页面。
- `phosphor-duotone`：柔和双色，适合照护、临床和温和可信主题。
- `simple-icons`：只用于真实品牌标志。

### 写入规格

设计计划中先写职责：

```text
图标：tabler-outline/calendar
职责：时间线起点的语义标签
绑定对象：milestone-start
视觉重量：secondary
```

再写成元素：

```json
{
  "type": "icon",
  "icon": "tabler-outline/calendar",
  "color": "2563EB",
  "props": {
    "name": "milestone-start-icon",
    "x": "72pt",
    "y": "188pt",
    "width": "24pt",
    "height": "24pt",
    "alt": "项目启动"
  }
}
```

构建器会把 SVG 换色后复制到输出素材目录，并以独立矢量图片对象嵌入 PPTX。构建后会使用 FFmpeg 为 SVG 写入真实 PNG 兼容预览：PowerPoint 保留矢量 SVG，结构预览和不支持 SVG 的软件使用 PNG fallback。它不会自动添加底形、对齐、标签或连接线，这些必须作为独立原生对象写入规格。

不需要图标时写空数组。图标不能代替图表、流程关系、真实产品图或页面主视觉。

## 5. 原生对象

原生对象由 `deck-spec` 的 `elements` 创建：

- `textbox`：标题、结论、标签、正文和脚注。
- `shape`：区域、节点、状态、底形和简单信息图。
- `connector`：方向、依赖、流转和对应关系。
- `table`：结构化行列数据。
- `chart`：需要继续编辑的数据表达。
- `group`：需要整体移动的视觉组件。

使用原则：

- 关系可编辑时优先原生对象。
- 文字、数字、图标、底形和连接线分别建对象，避免一个形状承载多个层级。
- 预设圆角矩形只适合分组或重复模块，不应成为所有视觉关系的默认答案。
- 复杂主视觉可以由多个简单对象组成，不要求单一形状完成。

## 6. 图片与外部资产

Nova 没有内置通用照片库。用户提供图片、产品截图、品牌素材或生成图片时，在 `picture.props.src` 中使用相对规格文件或绝对路径，并提供 `alt`。

使用图片前确认：

- 图片提供真实证据、场景、人物、产品或品牌价值。
- 有足够分辨率和明确裁切。
- 不把带文字的整页截图当作主要编辑结构。
- 图片周围的标题、说明、数据和标注仍用原生对象。

## 7. 脚本资产

脚本：`scripts/nova_ppt_cli.py`

命令职责：

```text
catalog styles   查看风格候选及字体/强调色/图标起点
catalog layouts  查看布局候选及区域构成
catalog components 查看对象级视觉组件及层级构成
catalog icons    查看图标家族和数量
catalog fonts    检查风格目录字体在本机的实际匹配结果
icons            按真实文件名检索图标
lint             检查规格、素材路径、对象命名和基础几何
build            物化图标、生成命令、构建 PPTX 并执行技术校验
```

标准顺序：

```bash
# 1. 盘点可用资产
nova_ppt_cli.py catalog styles
nova_ppt_cli.py catalog layouts
nova_ppt_cli.py catalog components
nova_ppt_cli.py catalog icons
nova_ppt_cli.py catalog fonts

# 2. 根据设计计划检索需要的图标
nova_ppt_cli.py icons --family <family> --query <term>

# 3. 完成 deck-spec 后检查
nova_ppt_cli.py lint --spec <deck-spec.json>

# 4. 生成文件
nova_ppt_cli.py build --spec <deck-spec.json> --output <deck.pptx>
```

实际执行时在命令前加 `UV_CACHE_DIR=./uv_cache uv run python` 和脚本完整路径。

## 8. 资产组合检查

每页在写对象前回答：

- 本页的主视觉由原生关系图、数据图、图片还是字体构图承担？
- 图标是否真的需要；若需要，它绑定哪个语义对象？
- 选择的布局是否适合内容，还是只因为名字相似？
- 风格角色是否逐项落到颜色、字体、线条和形状，而不是只写了 `style_id`？
- 用户后续最可能修改什么，是否用了正确的可编辑对象？

任何资产没有明确职责时，不要加入。任何页面缺少主视觉时，也不要靠随机加入资产来掩盖。
