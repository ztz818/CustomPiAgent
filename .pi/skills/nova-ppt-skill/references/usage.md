# 运行说明

Nova 只依赖一条执行路径：`deck-spec.json` → 构建器 → 原生 PPTX。

## 目录结构

```text
.pi/skills/nova-ppt-skill/
├── SKILL.md
├── references/
├── schemas/
├── scripts/
├── templates/
├── assets/
└── examples/
```

## 执行步骤

1. 用内容理解模块得到受众、目标、证据和约束。
2. 选择页面角色和布局模式，并先写每页的视觉任务与视觉锚点。
3. 为每页画出视觉骨架：主视觉、关系线、节点/图标、数据表达和文字层级。
4. 锁定一套视觉系统。
5. 写出 `deck-spec.json`，按视觉骨架逐个放置原生对象。
6. 运行 `lint`。
7. 运行 `build`。
8. 检查输出 PPTX、统计信息和版面报告。

## 资产选择速查

处理新任务时按这个顺序使用技能内资产：

1. 先从 `templates/style-catalog.json` 选全篇风格，确定色板、字体、形状语言和图标家族。
2. 再从 `templates/layout-catalog.json` 选页面几何起点，不把它当成固定模板。
3. 根据页面任务阅读 `references/layout-patterns.md`，把几何起点改成主张、模型、流程、时间线、数据或决策结构。
4. 从 `assets/icons/<icon-family>/` 按语义挑图标；同一 deck 不混用通用家族。
5. 用 `references/icon-system.md` 决定图标尺寸、底形、颜色和连接方式。
6. 需要真实场景或产品证据时，才引入 `pictures`；需要可修改的关系和数字时，使用 `native` 对象。
7. 最后用 `references/visual-system.md` 和 `references/quality-gates.md` 做一致性与交付检查。

## 规格与构建

- `lint` 检查内容完整性、命名、密度和常见版面错误。
- `build` 先执行规格检查，再调用 `officecli` 生成 PPTX。
- 构建完成后输出命令记录，便于回放和追查。

## 交付物

每次构建后至少保留：

- `presentation.pptx`
- `deck-spec.json`
- 生成素材目录
- 命令记录

## 失败处理

如果出现以下情况，先修复再继续：

- 规格不完整
- 使用了缺失素材
- 对象越出画布
- 文字裁切或重叠
- 构建失败
- 版面检查存在阻断项
