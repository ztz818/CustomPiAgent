下面是精简优化后的 **AI/Agent 友好版工作规范**，更偏“可执行约束”，方便直接放到 `AGENTS.md` / `CLAUDE.md` / `OPENCODE.md` 之类文件里。

---

# AI 工作规范（跨项目通用版）

## 0. 目标

约束项目内所有 **Agent、Skill、Script、数据产物、缓存、日志** 的行为。

核心闭环：

```text
理解目标 → 选择能力 → 执行任务 → 产物落盘 → 校验结果 → 回传结论
```

---

## 1. 核心原则

| 原则        | 要求                        | 禁止               |
| --------- | ------------------------- | ---------------- |
| 第一性原理     | 先判断真实目标，再决定实现方式           | 无原因地套模板、堆架构      |
| 奥卡姆剃刀     | 优先选择最简单、直接、可验证方案          | 为了“完整”增加无用实体     |
| AI-Native | 输出结构化、自包含、可复用、可编排         | 只写散文说明           |
| 环境隔离      | 所有产物、缓存、日志必须在项目内          | 写入系统路径           |
| 可追溯       | 决策、异常、实验、结论必须落盘           | 只留在对话里           |
| 确定性优先     | 能用 Script 解决的，不交给 Agent 猜 | 让 Agent 做不稳定重复劳动 |

---

## 2. 严格路径约束

### 2.1 禁止写入系统路径

任何任务都严禁写入以下路径及其子路径：

```text
/root
/tmp
/cache
~/.cache
~/.npm
~/.uv
~/.config
/usr
/var
/etc
```

除非用户明确授权，否则不得读写系统级配置、缓存或临时目录。

---

### 2.2 所有产出必须写入项目内

统一使用项目内路径：

| 类型           | 路径                               |
| ------------ | -------------------------------- |
| 正式代码         | 项目源码目录                           |
| 配置           | `conf/`                          |
| 日志           | `logs/`                          |
| 中间产物         | `drafts/YYMMDD/`                 |
| 临时调试文件       | `drafts/YYMMDD/`                 |
| Python/uv 缓存 | `./uv_cache/`                    |
| npm 缓存       | `./npm_cache/`                   |
| Skill        | `.xx[claude/codex/opencode/pi]/skills/{skill-name}/` |

示例：

```text
drafts/260514/260514_01_task_plan.md
drafts/260514/260514_02_error_summary.json
logs/260514_run.log
./uv_cache/
./npm_cache/
```

---

## 3. 缓存与环境变量

执行 Python / Node / npm / uv 前，必须显式使用项目内缓存。

### 3.1 uv 缓存

```bash
UV_CACHE_DIR=./uv_cache uv run python script.py
UV_CACHE_DIR=./uv_cache uv pip install <package>
UV_CACHE_DIR=./uv_cache uv pip sync
```

禁止：

```bash
uv run python script.py
uv pip install <package>
pip install <package>
python script.py
.venv/bin/python script.py
```

---

### 3.2 npm 缓存

```bash
npm_config_cache=./npm_cache npm install
npm_config_cache=./npm_cache npm run build
npm_config_cache=./npm_cache npx <command>
```

禁止默认写入：

```text
~/.npm
~/.cache
/tmp
```

---

## 4. 标准执行流程

每个任务必须按以下顺序执行：

```text
1. 理解用户真实目标
2. 判断是否需要 Skill
3. 判断是否需要 Script
4. 明确正式产物、中间产物、日志路径
5. 执行任务
6. 校验结果
7. 回传结论、路径、风险
8. 必要时更新文档、runbook 或 Skill
```

执行前检查：

```text
- 目标是否明确？
- 是否有确定性 Script 更适合？
- 是否需要领域 Skill？
- 输出路径是否在项目内？
- 缓存是否在 ./uv_cache 或 ./npm_cache？
- 中间产物是否在 drafts/YYMMDD/？
- 日志是否在 logs/？
- 是否避免了无必要复杂度？
```

---

## 5. Skill 规范

### 5.1 最小目录

```text
.opencode/skills/
└── skill-name/
    ├── SKILL.md
    └── scripts/
```

必要时可增加：

```text
knowledge/
references/
templates/
assets/
```

---

### 5.2 SKILL.md Frontmatter

只保留触发必需字段：

```yaml
---
name: skill-name
description: "当用户需要 ... 时使用。"
---
```

要求：

| 字段            | 要求                 |
| ------------- | ------------------ |
| `name`        | 与目录名一致，小写字母、数字、连字符 |
| `description` | 明确触发场景、任务类型、边界     |

---

### 5.3 SKILL.md 正文

只保留核心执行信息：

```text
目标：解决什么问题
输入：需要哪些文件、路径、格式
输出：产物路径、格式
工作流：关键步骤
硬约束：必须遵守的规则
脚本：必要命令和参数
```

禁止写入：

```text
README 式介绍
创建过程记录
大段背景故事
废弃流程
与当前脚本不一致的示例
```

---

## 6. Script 规范

Script 用于：

```text
确定性计算
格式转换
数据校验
文件生成
批量处理
结果审计
```

要求：

```text
- 输入路径明确
- 输出路径明确
- 日志路径明确
- 不隐式修改环境
- 不覆盖用户未要求覆盖的文件
- 不写入系统路径
```

---

## 7. 中间产物规范

所有中间产物必须写入：

```text
drafts/YYMMDD/
```

命名规则：

```text
drafts/YYMMDD/YYMMDD_NN_描述.ext
```

包括但不限于：

```text
任务计划
分析笔记
实验记录
错误摘要
调试日志
临时结论
阶段性数据
脚本输出
模型中间结果
```

禁止：

```text
写入 /tmp
写入 /root
写入 ~/.cache
写入系统临时目录
只保存在对话中
```

---

## 8. 文件写入规范

### 8.1 长文本必须分块写入

| 文件类型           | 建议粒度          |
| -------------- | ------------- |
| Markdown       | 1-2 个章节       |
| Python         | 1-3 个函数或 1 个类 |
| YAML           | 1 个顶层对象       |
| JSON           | 1 个顶层字段或数组分段  |
| Prompt / Skill | 1 个主要模块       |

### 8.2 写入流程

```text
1. 创建文件骨架
2. 按章节或逻辑块写入
3. 每写完一大段检查文件尾部
4. 最后检查标题、代码块、括号、闭合符号
```

禁止：

```text
一次性写入超长文档
工具报错后反复提交大块文本
调试脚本混入正式源码目录
覆盖用户未要求覆盖的文件
```

---

## 9. Git / GitHub 规范

默认不主动提交代码。

只有涉及 **GitHub 访问、GitHub 操作、远端仓库交互** 时，才使用：

```bash
hai run git status
hai run git diff
hai run git add .
hai run git commit -m "message"
```

普通本地 Git 检查默认使用：

```bash
git status
git diff
```

禁止：

```text
未经用户要求主动 commit
未经用户要求 push
执行破坏性操作
强制覆盖用户修改
```

---

## 10. 回传规范

任务完成后必须回传：

```text
- 做了什么
- 产物路径
- 校验结果
- 发现的问题
- 风险或未完成项
```

不要只说“已完成”。

推荐格式：

```text
完成：
- ...

产物：
- ...

校验：
- ...

风险：
- ...
```

---

## 11. 最小执行清单

每次执行前检查：

```text
1. 是否理解真实目标？
2. 是否需要 Skill？
3. 是否需要 Script？
4. 是否明确输出路径？
5. 是否所有产物都在项目内？
6. 是否禁止写入 /root /tmp ~/.cache 等系统路径？
7. uv 缓存是否使用 ./uv_cache？
8. npm 缓存是否使用 ./npm_cache？
9. 中间产物是否写入 drafts/YYMMDD/？
10. 日志是否写入 logs/？
11. 是否避免不必要复杂度？
12. 是否需要更新文档或 runbook？
```

---

## 12. 核心口诀

```text
Skill 提供领域规则
Script 保证确定性
产物必须项目内落盘
缓存严禁写系统目录
中间过程必须可追溯
长文本分块写入防失败
GitHub 才加 hai run
```
