---
name: audit-workspace-organizer
description: "文档整理和索引工具。当用户提到'整理文档'、'整理资料'、'文档太乱'、'建立索引'时使用。适用于审计资料、项目文档等需要系统化整理的文档集合。"
---

# 文档整理工具

## 使用场景

### 直接调用
- 用户明确要求整理文档、建立索引时
- 面对大量混乱的文档需要系统化整理时

### 何时不使用
- ❌ 只有单个文件 → 直接用对应的文件处理 skill
- ❌ 文档已经很整齐 → 不需要整理

---

## 环境要求

**Python Dependencies**:
```bash
# CRITICAL: Always use uv with project-local cache
UV_CACHE_DIR=./uv_cache uv pip install pypdf pdfplumber requests

# Or add to pyproject.toml dependencies and run:
UV_CACHE_DIR=./uv_cache uv pip sync
```

**CRITICAL: Cache and Output Rules**:
- ✅ All caches MUST use `./uv_cache/` (project-local)
- ✅ All outputs MUST be in project directories (原地生成 .md 文件)
- ❌ NEVER write to `/root`, `/tmp`, `~/.cache`, or any system directory
- ❌ NEVER use `pip` - always use `uv`

**Required Skills**:
- `pdf` - PDF 文本提取
- `deepseek-ocr` - OCR 识别（扫描件）
- `docx` - Word 文档处理
- `xlsx` - Excel 表格处理
- `pptx` - PowerPoint 处理

---

## 输出格式

**整理结果**：
- 每个文档旁边生成同名 `.md` 文件
- 根目录生成 `00_索引.md`
- 保留所有原始文件（不修改、不移动、不删除）

**索引文件格式**：
```markdown
# 文档整理索引

**整理时间**：2026-05-29  
**成功转换**：121 个  
**转换失败**：2 个

## 文件清单

### 子目录A/
- ✓ [文档1.pdf](子目录A/文档1.md)
- ✓ [文档2.xlsx](子目录A/文档2.md)

### 子目录B/
- ✓ [报告.docx](子目录B/报告.md)
- ✗ 损坏文件.pdf - 转换失败：文件损坏
```

---

## 核心原则

1. **原地生成 md**：每个文档旁边生成同名 `.md` 文件
2. **保留原件**：不修改、移动或删除原始文件
3. **生成索引**：根目录生成 `00_索引.md`

---

## 文件处理策略

### PDF 文档
1. 先用 `pdfplumber` 提取文本
2. 如果提取失败（文本为空或乱码），用 `deepseek-ocr` skill

**判断是否需要 OCR**：
```python
import re
import pdfplumber

def needs_ocr(pdf_path: str) -> bool:
    """判断 PDF 是否需要 OCR"""
    try:
        with pdfplumber.open(pdf_path) as pdf:
            # 检查前3页
            text = ""
            for page in pdf.pages[:3]:
                text += page.extract_text() or ""
            
            if not text or len(text.strip()) < 50:
                return True
            
            # 统计连续词汇
            chinese_words = re.findall(r'[\u4e00-\u9fff]{3,}', text)
            english_words = re.findall(r'[a-zA-Z]{4,}', text)
            valid_words = chinese_words + english_words
            
            if len(valid_words) < 10:
                return True
            
            # 有效文本密度
            valid_len = sum(len(w) for w in valid_words)
            if valid_len / len(text.strip()) < 0.2:
                return True
            
            return False
    except Exception:
        return True  # 出错时使用 OCR
```

### Word/Excel/PPT
调用对应 skill（`docx`、`xlsx`、`pptx`）

### 图片文件
直接用 `deepseek-ocr` skill

### 压缩包
先解压，再处理内部文件

---

## 使用方法

### 整理单个目录

```python
from pathlib import Path
import json
from datetime import datetime

def organize_directory(dir_path: str, recursive: bool = True) -> dict:
    """整理目录下的所有文档
    
    Args:
        dir_path: 目录路径
        recursive: 是否递归处理子目录
    
    Returns:
        整理结果统计
    """
    directory = Path(dir_path)
    
    if not directory.exists():
        raise FileNotFoundError(f"Directory not found: {dir_path}")
    
    results = {
        "success": [],
        "failed": [],
        "skipped": []
    }
    
    # 支持的文件类型
    supported_extensions = {
        '.pdf', '.docx', '.xlsx', '.pptx',
        '.jpg', '.jpeg', '.png', '.gif'
    }
    
    # 遍历文件
    if recursive:
        files = directory.rglob("*")
    else:
        files = directory.glob("*")
    
    for file_path in files:
        if not file_path.is_file():
            continue
        
        # 跳过已生成的 .md 文件和索引文件
        if file_path.suffix == '.md' or file_path.name == '00_索引.md':
            continue
        
        # 跳过不支持的文件类型
        if file_path.suffix.lower() not in supported_extensions:
            results["skipped"].append({
                "file": str(file_path),
                "reason": "不支持的文件类型"
            })
            continue
        
        # 检查是否已经处理过
        md_path = file_path.with_suffix('.md')
        if md_path.exists():
            results["skipped"].append({
                "file": str(file_path),
                "reason": "已存在 .md 文件"
            })
            continue
        
        # 处理文件
        try:
            process_file(file_path)
            results["success"].append(str(file_path))
        except Exception as e:
            results["failed"].append({
                "file": str(file_path),
                "error": str(e)
            })
    
    # 生成索引
    generate_index(directory, results)
    
    return results


def process_file(file_path: Path):
    """处理单个文件，生成 .md 文件"""
    ext = file_path.suffix.lower()
    
    if ext == '.pdf':
        # PDF 处理
        if needs_ocr(str(file_path)):
            # 使用 OCR
            from skills.deepseek_ocr import ocr_file
            ocr_file(str(file_path))
        else:
            # 直接提取文本
            from skills.pdf import extract_pdf_with_anchors
            extract_pdf_with_anchors(str(file_path))
    
    elif ext == '.docx':
        # Word 处理
        from skills.docx import extract_docx_with_anchors
        extract_docx_with_anchors(str(file_path))
    
    elif ext == '.xlsx':
        # Excel 处理
        from skills.xlsx import extract_xlsx_with_anchors
        extract_xlsx_with_anchors(str(file_path))
    
    elif ext == '.pptx':
        # PowerPoint 处理
        from skills.pptx import extract_pptx_with_anchors
        extract_pptx_with_anchors(str(file_path))
    
    elif ext in {'.jpg', '.jpeg', '.png', '.gif'}:
        # 图片处理
        from skills.deepseek_ocr import ocr_file
        ocr_file(str(file_path))


def generate_index(directory: Path, results: dict):
    """生成索引文件"""
    index_content = f"""# 文档整理索引

**整理时间**：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}  
**成功转换**：{len(results['success'])} 个  
**转换失败**：{len(results['failed'])} 个  
**跳过文件**：{len(results['skipped'])} 个

## 文件清单

"""
    
    # 按目录分组
    files_by_dir = {}
    
    for file_path_str in results['success']:
        file_path = Path(file_path_str)
        rel_path = file_path.relative_to(directory)
        parent = str(rel_path.parent) if rel_path.parent != Path('.') else "根目录"
        
        if parent not in files_by_dir:
            files_by_dir[parent] = []
        
        md_path = file_path.with_suffix('.md')
        rel_md_path = md_path.relative_to(directory)
        
        files_by_dir[parent].append({
            "name": file_path.name,
            "md_link": str(rel_md_path)
        })
    
    # 生成索引内容
    for dir_name in sorted(files_by_dir.keys()):
        index_content += f"### {dir_name}/\n\n"
        for file_info in sorted(files_by_dir[dir_name], key=lambda x: x['name']):
            index_content += f"- ✓ [{file_info['name']}]({file_info['md_link']})\n"
        index_content += "\n"
    
    # 失败的文件
    if results['failed']:
        index_content += "## 转换失败\n\n"
        for failed in results['failed']:
            file_path = Path(failed['file'])
            rel_path = file_path.relative_to(directory)
            index_content += f"- ✗ {rel_path} - {failed['error']}\n"
        index_content += "\n"
    
    # 保存索引
    index_file = directory / "00_索引.md"
    index_file.write_text(index_content, encoding='utf-8')
```

---

## 输出结构

```
原始目录/
├── 00_索引.md              # 总索引
├── 子目录A/
│   ├── 文档1.pdf
│   ├── 文档1.md           # 新增
│   ├── 文档2.xlsx
│   └── 文档2.md           # 新增
└── 子目录B/
    ├── 报告.docx
    └── 报告.md            # 新增
```

---

## Skill 调用清单

| 文件类型 | 优先 Skill | 备用 Skill |
|---------|-----------|-----------|
| `.pdf` | `pdf` | `deepseek-ocr` |
| `.docx` | `docx` | - |
| `.xlsx` | `xlsx` | - |
| `.pptx` | `pptx` | - |
| `.jpg/.png` | `deepseek-ocr` | - |

---

## 使用示例

```python
# 整理当前目录
results = organize_directory("./documents")

print(f"成功: {len(results['success'])}")
print(f"失败: {len(results['failed'])}")
print(f"跳过: {len(results['skipped'])}")

# 查看索引
with open("./documents/00_索引.md", "r", encoding="utf-8") as f:
    print(f.read())
```

---

## 最佳实践

1. **原地生成** - 所有 .md 文件生成在原文件旁边
2. **保留原件** - 不修改、移动或删除原始文件
3. **检查 OCR 需求** - PDF 先尝试文本提取，失败再用 OCR
4. **生成索引** - 方便快速查找和导航
5. **使用 uv 管理依赖** - `UV_CACHE_DIR=./uv_cache uv ...`
6. **禁止系统目录** - 所有输出都在项目目录下
7. **批量处理优化** - 对于大量文件，考虑分批处理
8. **错误处理** - 单个文件失败不影响其他文件处理

---

## 注意事项

1. **OCR 服务依赖** - 使用 OCR 前确保服务运行在 `http://10.125.28.206:18000`
2. **大文件处理** - 大文件可能需要较长时间，建议设置合理的超时
3. **磁盘空间** - 确保有足够的磁盘空间存储 .md 文件
4. **文件权限** - 确保有读取原文件和写入 .md 文件的权限
5. **重复处理** - 已存在 .md 文件会被跳过，避免重复处理
