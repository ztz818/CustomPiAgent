---
name: audit-findings
description: "审计发现管理工具。用于问题登记、状态跟踪、整改跟踪。当审计过程中发现问题时使用，支持问题全生命周期管理。"
---

# 审计发现管理

## 使用场景

### 直接调用
- 发现审计问题时立即登记
- 查看问题清单
- 更新问题状态
- 跟踪整改进度

### 被其他 Skill 调用
- `project-audit`：发现问题时自动登记

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
- ✅ All findings MUST be stored in project directories (e.g., `./审计发现/`, `./findings/`)
- ❌ NEVER write to `/root`, `/tmp`, `~/.cache`, or any system directory
- ❌ NEVER use `pip` - always use `uv`

---

## 核心功能

### 1. 问题登记
### 2. 状态跟踪
### 3. 整改管理
### 4. 问题清单生成

---

## 问题数据结构

```json
{
  "finding_id": "F001",
  "title": "资本金未到位",
  "description": "合同约定资本金应于放款前到位，但未查询到资本金到位证明",
  "risk_level": "high",
  "risk_score": 20,
  "status": "confirmed",
  "category": "资金风险",
  "evidence": {
    "document": {
      "file": "贷款合同.pdf",
      "page": 5,
      "line": "45-52",
      "content": "资本金应于放款前到位",
      "link": "./documents/贷款合同.md#L45-L52"
    },
    "web_verification": {
      "query": "某某项目 资本金到位",
      "timestamp": "2026-04-29T14:30:00+08:00",
      "result": "未查询到相关公告",
      "sources": []
    },
    "reasoning": "合同明确要求资本金先行到位，但通过互联网查询未找到资本金到位证明，且项目方未提供银行流水，存在资本金不实风险"
  },
  "impact": "可能导致项目资金链断裂，影响项目正常建设",
  "recommendation": "要求项目方提供资本金到位证明及银行流水，核实资本金真实性",
  "responsible_party": "项目方",
  "deadline": "2026-05-15",
  "created_at": "2026-04-29T14:30:00+08:00",
  "updated_at": "2026-04-29T14:30:00+08:00",
  "created_by": "审计员",
  "rectification": {
    "status": "pending",
    "measures": [],
    "completion_date": null,
    "verification_result": null
  }
}
```

---

## 问题状态流转

```
待核实 (pending) 
    ↓
已确认 (confirmed) 
    ↓
待整改 (rectification_required)
    ↓
整改中 (rectifying)
    ↓
待验证 (verification_pending)
    ↓
已关闭 (closed) / 无需整改 (no_action_required)
```

---

## 风险等级定义

### 风险评分矩阵

**风险评分 = 发生概率 × 影响程度**

**发生概率**：
- 5分：确定发生（已发生或必然发生）
- 4分：很可能发生（概率 > 70%）
- 3分：可能发生（概率 30-70%）
- 2分：不太可能（概率 10-30%）
- 1分：极不可能（概率 < 10%）

**影响程度**：
- 5分：重大损失（> 1000万或严重违法违规）
- 4分：较大损失（500-1000万或重要违规）
- 3分：一般损失（100-500万或一般违规）
- 2分：较小损失（10-100万或轻微违规）
- 1分：轻微影响（< 10万或提示事项）

**风险等级**：
- 🔴 **高风险**（high）：总分 ≥ 15
- 🟡 **中风险**（medium）：总分 8-14
- 🟢 **低风险**（low）：总分 ≤ 7

---

## 使用方法

### 登记新问题

```python
from pathlib import Path
import json
from datetime import datetime

def create_finding(
    findings_dir: str,
    title: str,
    description: str,
    risk_level: str,
    risk_score: int,
    evidence: dict,
    **kwargs
) -> str:
    """登记新的审计发现
    
    Args:
        findings_dir: 问题存储目录（项目路径下，如 ./审计发现/ 或 ./findings/）
        title: 问题标题
        description: 问题描述
        risk_level: 风险等级 (high/medium/low)
        risk_score: 风险评分
        evidence: 证据字典
        **kwargs: 其他字段
    
    Returns:
        问题ID
    """
    findings_path = Path(findings_dir)
    findings_path.mkdir(parents=True, exist_ok=True)
    
    # 生成问题ID
    existing = list(findings_path.glob("F*.json"))
    finding_id = f"F{len(existing) + 1:03d}"
    
    finding = {
        "finding_id": finding_id,
        "title": title,
        "description": description,
        "risk_level": risk_level,
        "risk_score": risk_score,
        "status": "pending",
        "evidence": evidence,
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
        "rectification": {
            "status": "pending",
            "measures": [],
            "completion_date": None
        },
        **kwargs
    }
    
    file_path = findings_path / f"{finding_id}.json"
    file_path.write_text(json.dumps(finding, ensure_ascii=False, indent=2), encoding="utf-8")
    
    return finding_id
```

### 更新问题状态

```python
def update_finding_status(findings_dir: str, finding_id: str, status: str, notes: str = ""):
    """更新问题状态"""
    findings_path = Path(findings_dir)
    file_path = findings_path / f"{finding_id}.json"
    
    if not file_path.exists():
        raise FileNotFoundError(f"Finding {finding_id} not found")
    
    finding = json.loads(file_path.read_text(encoding="utf-8"))
    
    finding["status"] = status
    finding["updated_at"] = datetime.now().isoformat()
    
    if notes:
        if "status_history" not in finding:
            finding["status_history"] = []
        finding["status_history"].append({
            "status": status,
            "timestamp": datetime.now().isoformat(),
            "notes": notes
        })
    
    file_path.write_text(json.dumps(finding, ensure_ascii=False, indent=2), encoding="utf-8")
```

### 记录整改措施

```python
def add_rectification_measure(findings_dir: str, finding_id: str, measure: str):
    """添加整改措施"""
    findings_path = Path(findings_dir)
    file_path = findings_path / f"{finding_id}.json"
    
    if not file_path.exists():
        raise FileNotFoundError(f"Finding {finding_id} not found")
    
    finding = json.loads(file_path.read_text(encoding="utf-8"))
    
    finding["rectification"]["measures"].append({
        "measure": measure,
        "timestamp": datetime.now().isoformat()
    })
    finding["rectification"]["status"] = "rectifying"
    finding["updated_at"] = datetime.now().isoformat()
    
    file_path.write_text(json.dumps(finding, ensure_ascii=False, indent=2), encoding="utf-8")
```

### 生成问题清单

```python
def generate_findings_list(findings_dir: str, output_path: str = None) -> str:
    """生成问题清单（Markdown格式）
    
    Args:
        findings_dir: 问题存储目录
        output_path: 输出文件路径（可选，默认为 findings_dir/问题清单.md）
    
    Returns:
        Markdown 内容
    """
    findings_path = Path(findings_dir)
    
    findings = []
    for file in sorted(findings_path.glob("F*.json")):
        finding = json.loads(file.read_text(encoding="utf-8"))
        findings.append(finding)
    
    # 按风险等级分组
    high_risk = [f for f in findings if f["risk_level"] == "high"]
    medium_risk = [f for f in findings if f["risk_level"] == "medium"]
    low_risk = [f for f in findings if f["risk_level"] == "low"]
    
    md = "# 审计发现清单\n\n"
    md += f"**统计时间**：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
    md += f"**问题总数**：{len(findings)}\n"
    md += f"- 🔴 高风险：{len(high_risk)}\n"
    md += f"- 🟡 中风险：{len(medium_risk)}\n"
    md += f"- 🟢 低风险：{len(low_risk)}\n\n"
    
    # 状态统计
    status_map = {
        "pending": "待核实",
        "confirmed": "已确认",
        "rectification_required": "待整改",
        "rectifying": "整改中",
        "verification_pending": "待验证",
        "closed": "已关闭",
        "no_action_required": "无需整改"
    }
    
    status_counts = {}
    for f in findings:
        status = status_map.get(f["status"], f["status"])
        status_counts[status] = status_counts.get(status, 0) + 1
    
    md += "**状态分布**：\n"
    for status, count in status_counts.items():
        md += f"- {status}：{count}\n"
    
    md += "\n---\n\n"
    
    # 详细清单
    def format_findings(findings_list, title):
        if not findings_list:
            return ""
        
        result = f"## {title}\n\n"
        result += "| ID | 问题 | 状态 | 责任方 | 期限 | 评分 |\n"
        result += "|----|------|------|--------|------|------|\n"
        
        for f in findings_list:
            status = status_map.get(f["status"], f["status"])
            responsible = f.get("responsible_party", "-")
            deadline = f.get("deadline", "-")
            result += f"| {f['finding_id']} | {f['title']} | {status} | {responsible} | {deadline} | {f['risk_score']} |\n"
        
        result += "\n"
        return result
    
    md += format_findings(high_risk, "🔴 高风险问题")
    md += format_findings(medium_risk, "🟡 中风险问题")
    md += format_findings(low_risk, "🟢 低风险问题")
    
    # 保存到文件
    if output_path is None:
        output_path = findings_path / "问题清单.md"
    else:
        output_path = Path(output_path)
    
    output_path.write_text(md, encoding="utf-8")
    
    return md
```

### 生成问题详细报告

```python
def generate_finding_report(findings_dir: str, finding_id: str, output_path: str = None) -> str:
    """生成单个问题的详细报告"""
    findings_path = Path(findings_dir)
    file_path = findings_path / f"{finding_id}.json"
    
    if not file_path.exists():
        raise FileNotFoundError(f"Finding {finding_id} not found")
    
    finding = json.loads(file_path.read_text(encoding="utf-8"))
    
    risk_icon = {"high": "🔴", "medium": "🟡", "low": "🟢"}[finding["risk_level"]]
    
    md = f"# {finding['finding_id']}: {finding['title']}\n\n"
    md += f"**风险等级**：{risk_icon} {finding['risk_level'].upper()} (评分: {finding['risk_score']})\n"
    md += f"**状态**：{finding['status']}\n"
    md += f"**创建时间**：{finding['created_at']}\n\n"
    
    md += "## 问题描述\n\n"
    md += f"{finding['description']}\n\n"
    
    md += "## 证据链\n\n"
    
    # 文档证据
    if "document" in finding["evidence"]:
        doc = finding["evidence"]["document"]
        md += "### 原始材料\n\n"
        md += f"- **文件**：{doc['file']}\n"
        md += f"- **位置**：第 {doc['page']} 页\n"
        if "link" in doc:
            md += f"- **查看原文**：[点击查看]({doc['link']})\n"
        md += f"- **内容**：{doc['content']}\n\n"
    
    # 互联网验证
    if "web_verification" in finding["evidence"]:
        web = finding["evidence"]["web_verification"]
        md += "### 互联网验证\n\n"
        md += f"- **搜索关键词**：{web['query']}\n"
        md += f"- **查询时间**：{web['timestamp']}\n"
        md += f"- **验证结果**：{web['result']}\n"
        if web.get("sources"):
            md += "- **信息来源**：\n"
            for src in web["sources"]:
                md += f"  - {src}\n"
        md += "\n"
    
    # 逻辑推理
    if "reasoning" in finding["evidence"]:
        md += "### 逻辑推理\n\n"
        md += f"{finding['evidence']['reasoning']}\n\n"
    
    md += "## 风险分析\n\n"
    md += f"{finding.get('impact', '待补充')}\n\n"
    
    md += "## 审计建议\n\n"
    md += f"{finding.get('recommendation', '待补充')}\n\n"
    
    # 整改情况
    if finding["rectification"]["measures"]:
        md += "## 整改情况\n\n"
        for i, measure in enumerate(finding["rectification"]["measures"], 1):
            md += f"{i}. {measure['measure']} ({measure['timestamp']})\n"
        md += "\n"
    
    # 保存到文件
    if output_path is None:
        output_path = findings_path / f"{finding_id}_详细报告.md"
    else:
        output_path = Path(output_path)
    
    output_path.write_text(md, encoding="utf-8")
    
    return md
```

---

## 与 project-audit 集成

在审计过程中发现问题时自动登记：

```python
# 发现问题时
finding_id = create_finding(
    findings_dir="./审计发现",  # 项目路径下
    title="资本金未到位",
    description="合同约定资本金应于放款前到位，但未查询到证明",
    risk_level="high",
    risk_score=20,
    evidence={
        "document": {
            "file": "贷款合同.pdf",
            "page": 5,
            "line": "45-52",
            "link": "./documents/贷款合同.md#L45-L52"
        },
        "web_verification": {
            "query": "某某项目 资本金到位",
            "result": "未查询到相关公告"
        }
    },
    responsible_party="项目方",
    deadline="2026-05-15"
)
```

---

## 输出格式

### 问题清单（Markdown）
- 按风险等级分组
- 表格形式展示
- 包含状态统计
- 输出路径：`{findings_dir}/问题清单.md`

### 问题详细报告（Markdown）
- 完整的证据链
- 风险分析和建议
- 整改跟踪记录
- 输出路径：`{findings_dir}/{finding_id}_详细报告.md`

### 问题数据（JSON）
- 结构化存储
- 支持程序化处理
- 便于数据分析
- 存储路径：`{findings_dir}/{finding_id}.json`

---

## 最佳实践

1. **使用项目路径** - 所有问题数据存储在项目目录下（如 `./审计发现/`）
2. **完整证据链** - 每个问题必须包含文档证据、互联网验证、逻辑推理
3. **及时更新状态** - 问题状态变化时及时记录
4. **定期生成清单** - 定期生成问题清单，便于跟踪
5. **使用 uv 管理依赖** - `UV_CACHE_DIR=./uv_cache uv ...`
6. **禁止系统目录** - 不要将问题数据写入 /root, /tmp 等系统目录
