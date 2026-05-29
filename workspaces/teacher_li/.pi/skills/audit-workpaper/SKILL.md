---
name: audit-workpaper
description: "审计工作底稿管理工具。自动记录审计轨迹、生成结构化工作底稿、支持审计复核和质量控制。当执行审计工作时自动调用，记录每次查询、验证的时间戳和操作记录。"
---

# 审计工作底稿管理

## 使用场景

### 自动调用
- `project-audit` skill 执行时自动调用
- 每次互联网验证时自动记录
- 每次文档读取时自动记录

### 直接调用
- 用户要求查看审计轨迹时
- 生成工作底稿汇总时
- 审计复核时

---

## 环境要求

**Python Dependencies**:
```bash
# CRITICAL: Always use uv with project-local cache
UV_CACHE_DIR=./uv_cache uv pip install python-dateutil

# Or add to pyproject.toml dependencies and run:
UV_CACHE_DIR=./uv_cache uv pip sync
```

**CRITICAL: Cache and Output Rules**:
- ✅ All caches MUST use `./uv_cache/` (project-local)
- ✅ All workpapers MUST be stored in project directories (e.g., `./审计工作底稿/`, `./workpapers/`)
- ❌ NEVER write to `/root`, `/tmp`, `~/.cache`, or any system directory
- ❌ NEVER use `pip` - always use `uv`

---

## 工作底稿结构

```
审计工作底稿/
├── 00_审计日志.json              # 完整操作日志
├── 01_项目基本情况/
│   ├── 文档清单.md
│   ├── 信息提取记录.json
│   └── 证据文件/
├── 02_真实性验证/
│   ├── 招投标查询记录.json
│   ├── 立项查询记录.json
│   └── 验证结果截图/
├── 03_证件核查/
├── 04_重复融资核查/
├── 05_资本金核查/
├── 06_贷款流向核查/
├── 07_还款来源核查/
├── 08_回款能力分析/
├── 09_信用风险评估/
└── 10_风险识别/
```

---

## 核心功能

### 1. 审计日志记录

**自动记录内容**：
```json
{
  "timestamp": "2026-04-29T14:30:00+08:00",
  "step": "02_真实性验证",
  "action": "web_search",
  "query": "某某项目 招标公告 site:ggzy.gov.cn",
  "result_count": 5,
  "sources": ["url1", "url2"],
  "operator": "Claude",
  "duration_ms": 1234
}
```

### 2. 验证记录管理

**互联网验证记录**：
```json
{
  "verification_id": "V001",
  "timestamp": "2026-04-29T14:30:00+08:00",
  "verification_type": "招投标信息",
  "search_query": "某某项目 招标公告",
  "search_results": [
    {
      "title": "某某项目招标公告",
      "url": "https://...",
      "source": "全国公共资源交易平台",
      "date": "2025-03-15",
      "key_info": {
        "project_name": "某某项目",
        "investment": "5000万元",
        "location": "某市某区"
      }
    }
  ],
  "verification_result": "一致",
  "notes": "项目名称、投资规模与融资材料一致"
}
```

### 3. 文档读取记录

**文档访问记录**：
```json
{
  "timestamp": "2026-04-29T14:25:00+08:00",
  "file_path": "./documents/可研报告.pdf",
  "file_hash": "sha256:abc123...",
  "file_size": 1234567,
  "pages_read": [1, 2, 5, 10],
  "extracted_info": {
    "project_name": "某某项目",
    "total_investment": "5000万元"
  }
}
```

### 4. 证据链管理

**证据链记录**：
```json
{
  "finding_id": "F001",
  "issue": "资本金未到位",
  "evidence_chain": {
    "document_evidence": {
      "file": "贷款合同.pdf",
      "page": 5,
      "content": "资本金应于放款前到位",
      "hash": "sha256:..."
    },
    "web_verification": {
      "verification_id": "V005",
      "query": "某某项目 资本金",
      "result": "未查询到资本金到位公告"
    },
    "logical_reasoning": "合同要求资本金先行到位，但未查询到相关证明，存在资本金不实风险"
  }
}
```

---

## 使用方法

### 初始化工作底稿

```python
from pathlib import Path
import json
from datetime import datetime

def init_workpaper(audit_name: str, base_dir: str = "./审计工作底稿"):
    """初始化审计工作底稿目录
    
    Args:
        audit_name: 审计项目名称
        base_dir: 工作底稿基础目录（项目路径下）
    
    Returns:
        工作底稿根目录路径
    """
    base = Path(base_dir) / audit_name
    
    # 创建目录结构
    steps = [
        "01_项目基本情况",
        "02_真实性验证",
        "03_证件核查",
        "04_重复融资核查",
        "05_资本金核查",
        "06_贷款流向核查",
        "07_还款来源核查",
        "08_回款能力分析",
        "09_信用风险评估",
        "10_风险识别"
    ]
    
    for step in steps:
        (base / step).mkdir(parents=True, exist_ok=True)
    
    # 初始化审计日志
    log_file = base / "00_审计日志.json"
    log_file.write_text(json.dumps({
        "audit_name": audit_name,
        "start_time": datetime.now().isoformat(),
        "logs": []
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    
    return base
```

### 记录操作日志

```python
def log_action(workpaper_dir: str, step: str, action: str, **kwargs):
    """记录审计操作
    
    Args:
        workpaper_dir: 工作底稿目录
        step: 审计步骤（如 "02_真实性验证"）
        action: 操作类型（如 "web_search", "read_document"）
        **kwargs: 其他操作详情
    """
    workpaper_path = Path(workpaper_dir)
    log_file = workpaper_path / "00_审计日志.json"
    
    if not log_file.exists():
        raise FileNotFoundError(f"Audit log not found: {log_file}")
    
    data = json.loads(log_file.read_text(encoding="utf-8"))
    
    data["logs"].append({
        "timestamp": datetime.now().isoformat(),
        "step": step,
        "action": action,
        **kwargs
    })
    
    log_file.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
```

### 记录验证结果

```python
def log_verification(workpaper_dir: str, step: str, verification_data: dict):
    """记录互联网验证结果
    
    Args:
        workpaper_dir: 工作底稿目录
        step: 审计步骤
        verification_data: 验证数据字典
    """
    workpaper_path = Path(workpaper_dir)
    step_dir = workpaper_path / step
    
    if not step_dir.exists():
        step_dir.mkdir(parents=True, exist_ok=True)
    
    verification_file = step_dir / f"验证记录_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    
    verification_file.write_text(
        json.dumps(verification_data, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )
    
    # 同时记录到审计日志
    log_action(workpaper_dir, step, "verification", 
               verification_id=verification_data.get("verification_id"))
```

### 记录文档读取

```python
import hashlib

def log_document_read(workpaper_dir: str, file_path: str, extracted_info: dict = None):
    """记录文档读取操作
    
    Args:
        workpaper_dir: 工作底稿目录
        file_path: 文档路径
        extracted_info: 提取的信息（可选）
    """
    file_path_obj = Path(file_path)
    
    if not file_path_obj.exists():
        raise FileNotFoundError(f"Document not found: {file_path}")
    
    # 计算文件哈希
    file_hash = hashlib.sha256(file_path_obj.read_bytes()).hexdigest()
    
    log_action(
        workpaper_dir,
        "01_项目基本情况",
        "read_document",
        file_path=str(file_path),
        file_hash=f"sha256:{file_hash}",
        file_size=file_path_obj.stat().st_size,
        extracted_info=extracted_info or {}
    )
```

### 生成工作底稿汇总

```python
def generate_workpaper_summary(workpaper_dir: str, output_path: str = None) -> str:
    """生成工作底稿汇总报告
    
    Args:
        workpaper_dir: 工作底稿目录
        output_path: 输出文件路径（可选）
    
    Returns:
        Markdown 汇总内容
    """
    workpaper_path = Path(workpaper_dir)
    log_file = workpaper_path / "00_审计日志.json"
    
    if not log_file.exists():
        raise FileNotFoundError(f"Audit log not found: {log_file}")
    
    data = json.loads(log_file.read_text(encoding="utf-8"))
    
    summary = f"""# 审计工作底稿汇总

**审计项目**：{data['audit_name']}  
**开始时间**：{data['start_time']}  
**操作记录数**：{len(data['logs'])}

## 操作统计

"""
    
    # 统计各步骤操作次数
    step_counts = {}
    action_counts = {}
    
    for log in data["logs"]:
        step = log["step"]
        action = log["action"]
        step_counts[step] = step_counts.get(step, 0) + 1
        action_counts[action] = action_counts.get(action, 0) + 1
    
    summary += "### 按步骤统计\n\n"
    for step, count in sorted(step_counts.items()):
        summary += f"- {step}: {count} 次操作\n"
    
    summary += "\n### 按操作类型统计\n\n"
    for action, count in sorted(action_counts.items()):
        summary += f"- {action}: {count} 次\n"
    
    summary += "\n## 最近操作记录\n\n"
    summary += "| 时间 | 步骤 | 操作 |\n"
    summary += "|------|------|------|\n"
    
    # 显示最近10条记录
    for log in data["logs"][-10:]:
        timestamp = log["timestamp"][:19]  # 只显示到秒
        summary += f"| {timestamp} | {log['step']} | {log['action']} |\n"
    
    # 保存到文件
    if output_path is None:
        output_path = workpaper_path / "工作底稿汇总.md"
    else:
        output_path = Path(output_path)
    
    output_path.write_text(summary, encoding="utf-8")
    
    return summary
```

---

## 与 project-audit 集成

在 `project-audit` skill 中自动调用：

```python
# 审计开始时
workpaper_dir = init_workpaper(project_name, base_dir="./审计工作底稿")

# 每次互联网验证时
verification_data = {
    "verification_id": "V001",
    "timestamp": datetime.now().isoformat(),
    "search_query": query,
    "search_results": results
}
log_verification(workpaper_dir, "02_真实性验证", verification_data)

# 每次读取文档时
log_document_read(workpaper_dir, file_path="./documents/可研报告.pdf",
                  extracted_info={"project_name": "某某项目"})

# 审计结束时
summary = generate_workpaper_summary(workpaper_dir)
```

---

## 输出格式

### 审计日志（JSON）
- 完整的操作时间线
- 可追溯每个操作
- 支持审计复核
- 存储路径：`{workpaper_dir}/00_审计日志.json`

### 验证记录（JSON）
- 结构化的验证结果
- 包含搜索关键词、结果来源
- 支持证据链构建
- 存储路径：`{workpaper_dir}/{step}/验证记录_*.json`

### 工作底稿汇总（Markdown）
- 人类可读的汇总报告
- 统计各步骤完成情况
- 快速定位关键信息
- 输出路径：`{workpaper_dir}/工作底稿汇总.md`

---

## 质量控制

### 完整性检查

```python
def check_completeness(workpaper_dir: str) -> dict:
    """检查工作底稿完整性
    
    Returns:
        检查结果字典
    """
    workpaper_path = Path(workpaper_dir)
    log_file = workpaper_path / "00_审计日志.json"
    
    if not log_file.exists():
        return {"complete": False, "error": "审计日志不存在"}
    
    data = json.loads(log_file.read_text(encoding="utf-8"))
    
    # 检查十步法是否全部执行
    required_steps = [
        "01_项目基本情况",
        "02_真实性验证",
        "03_证件核查",
        "04_重复融资核查",
        "05_资本金核查",
        "06_贷款流向核查",
        "07_还款来源核查",
        "08_回款能力分析",
        "09_信用风险评估",
        "10_风险识别"
    ]
    
    executed_steps = set(log["step"] for log in data["logs"])
    missing_steps = [step for step in required_steps if step not in executed_steps]
    
    return {
        "complete": len(missing_steps) == 0,
        "executed_steps": list(executed_steps),
        "missing_steps": missing_steps,
        "total_operations": len(data["logs"])
    }
```

### 时效性检查

```python
from datetime import datetime, timedelta

def check_timeliness(workpaper_dir: str, max_age_days: int = 7) -> dict:
    """检查工作底稿时效性
    
    Args:
        workpaper_dir: 工作底稿目录
        max_age_days: 最大允许天数
    
    Returns:
        时效性检查结果
    """
    workpaper_path = Path(workpaper_dir)
    log_file = workpaper_path / "00_审计日志.json"
    
    if not log_file.exists():
        return {"valid": False, "error": "审计日志不存在"}
    
    data = json.loads(log_file.read_text(encoding="utf-8"))
    
    start_time = datetime.fromisoformat(data["start_time"])
    now = datetime.now()
    age_days = (now - start_time).days
    
    return {
        "valid": age_days <= max_age_days,
        "start_time": data["start_time"],
        "age_days": age_days,
        "max_age_days": max_age_days
    }
```

---

## 最佳实践

1. **使用项目路径** - 所有工作底稿存储在项目目录下（如 `./审计工作底稿/`）
2. **自动记录操作** - 每次关键操作都自动记录到日志
3. **完整证据链** - 验证记录包含完整的搜索关键词和结果来源
4. **定期生成汇总** - 定期生成工作底稿汇总，便于复核
5. **质量控制检查** - 审计结束前进行完整性和时效性检查
6. **使用 uv 管理依赖** - `UV_CACHE_DIR=./uv_cache uv ...`
7. **禁止系统目录** - 不要将工作底稿写入 /root, /tmp 等系统目录
