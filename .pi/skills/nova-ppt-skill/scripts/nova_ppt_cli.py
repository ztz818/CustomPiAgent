#!/usr/bin/env python3
"""Build native PPTX decks from Nova deck specifications."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

SKILL_ROOT = Path(__file__).resolve().parents[1]
ICON_ROOT = SKILL_ROOT / "assets" / "icons"
STYLE_CATALOG = SKILL_ROOT / "templates" / "style-catalog.json"
LAYOUT_CATALOG = SKILL_ROOT / "templates" / "layout-catalog.json"
COMPONENT_CATALOG = SKILL_ROOT / "templates" / "component-catalog.json"
CANVAS_WIDTH_PT = 960.0
CANVAS_HEIGHT_PT = 540.0
PASS_TYPES = {
    "shape",
    "textbox",
    "picture",
    "table",
    "chart",
    "connector",
    "group",
    "notes",
}


@dataclass
class Finding:
    severity: str
    location: str
    message: str

    def render(self) -> str:
        return f"[{self.severity.upper()}] {self.location}: {self.message}"


def load_spec(path: Path) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ValueError(f"规格文件不存在：{path}") from exc
    except json.JSONDecodeError as exc:
        raise ValueError(f"JSON 格式错误：{exc}") from exc
    if not isinstance(data, dict):
        raise ValueError("顶层必须是 JSON 对象")
    return data


def length_to_pt(value: Any) -> float | None:
    if isinstance(value, (int, float)):
        return float(value)
    if not isinstance(value, str):
        return None
    match = re.fullmatch(r"\s*(-?\d+(?:\.\d+)?)\s*(pt|in|cm|mm)?\s*", value)
    if not match:
        return None
    number = float(match.group(1))
    unit = match.group(2) or "pt"
    return number * {"pt": 1.0, "in": 72.0, "cm": 72.0 / 2.54, "mm": 72.0 / 25.4}[unit]


def normalize_hex(value: str) -> str:
    color = value.strip().lstrip("#")
    if not re.fullmatch(r"[0-9A-Fa-f]{6}", color):
        raise ValueError(f"图标颜色必须是六位 HEX：{value}")
    return color.upper()


def matched_font_family(font_name: str) -> str | None:
    if shutil.which("fc-match") is None:
        return None
    result = subprocess.run(
        ["fc-match", "-f", "%{family}", font_name],
        text=True,
        capture_output=True,
        check=False,
    )
    return result.stdout.strip() or None


def font_is_available(font_name: str) -> tuple[bool, str | None]:
    matched = matched_font_family(font_name)
    if matched is None:
        return True, None
    families = [item.strip().lower() for item in matched.split(",")]
    requested = font_name.strip().lower()
    return requested in families, matched


def style_token_map(spec: dict[str, Any]) -> dict[str, str]:
    style_id = str(spec.get("design", {}).get("style_id", ""))
    if not style_id or style_id.startswith("custom:"):
        return {}
    catalog = json.loads(STYLE_CATALOG.read_text(encoding="utf-8"))
    style = next((item for item in catalog.get("styles", []) if item.get("id") == style_id), None)
    if style is None:
        return {}
    tokens: dict[str, str] = {}
    for key, value in style.get("colors", {}).items():
        tokens[f"${key}"] = str(value)
        tokens[f"$color.{key}"] = str(value)
    for key, value in style.get("fonts", {}).items():
        tokens[f"$font.{key}"] = str(value)
    return tokens


def resolve_tokens(value: Any, tokens: dict[str, str]) -> Any:
    if isinstance(value, str):
        return tokens.get(value, value)
    if isinstance(value, list):
        return [resolve_tokens(item, tokens) for item in value]
    if isinstance(value, dict):
        return {key: resolve_tokens(item, tokens) for key, item in value.items()}
    return value


def resolve_asset(value: str, spec_dir: Path) -> str:
    if re.match(r"^(https?://|data:)", value):
        return value
    source = Path(value)
    if not source.is_absolute():
        source = spec_dir / source
    return str(source.resolve())


def icon_source(icon_id: str) -> Path:
    if not re.fullmatch(r"[A-Za-z0-9._-]+/[A-Za-z0-9._-]+", icon_id):
        raise ValueError(f"非法图标标识：{icon_id}")
    source = ICON_ROOT / f"{icon_id}.svg"
    if not source.is_file():
        raise ValueError(f"图标不存在：{icon_id}")
    return source


def materialize_icon(icon_id: str, color: str, asset_dir: Path) -> Path:
    source = icon_source(icon_id)
    color = normalize_hex(color)
    content = source.read_text(encoding="utf-8")
    content = content.replace("currentColor", f"#{color}")
    digest = hashlib.sha256(f"{icon_id}:{color}".encode("utf-8")).hexdigest()[:10]
    target = asset_dir / f"icon_{icon_id.replace('/', '_')}_{color}_{digest}.svg"
    target.write_text(content, encoding="utf-8")
    return target


def lint_spec(spec: dict[str, Any], spec_path: Path) -> list[Finding]:
    findings: list[Finding] = []
    slides = spec.get("slides")
    if not isinstance(slides, list) or not slides:
        return [Finding("error", "slides", "至少需要一页")]

    canvas = spec.get("canvas", {})
    width = length_to_pt(canvas.get("width", "960pt"))
    height = length_to_pt(canvas.get("height", "540pt"))
    if width is None or height is None:
        findings.append(Finding("error", "canvas", "画布宽高必须是有效长度"))
    elif abs(width / height - 16 / 9) > 0.01:
        findings.append(Finding("error", "canvas", "当前构建器要求 16:9 画布"))

    generic_icon_families: set[str] = set()
    requested_fonts: set[str] = set()
    slide_names: set[str] = set()

    plan = spec.get("plan")
    if not isinstance(plan, dict):
        findings.append(Finding("error", "plan", "缺少任务契约、页序理由和资产决策；不要从源材料直接跳到坐标"))
    else:
        task_contract = plan.get("task_contract")
        if not isinstance(task_contract, dict):
            findings.append(Finding("error", "plan.task_contract", "缺少任务契约"))
        else:
            for key in ("delivery_mode", "desired_outcome", "content_scope"):
                if not task_contract.get(key):
                    findings.append(Finding("error", f"plan.task_contract.{key}", "缺少任务决定"))
        if not plan.get("narrative_rationale"):
            findings.append(Finding("error", "plan.narrative_rationale", "缺少页序和叙事选择理由"))
        if not plan.get("asset_decisions"):
            findings.append(Finding("error", "plan.asset_decisions", "缺少风格、布局、图标/图片和原生对象的使用决定"))

    design = spec.get("design")
    if not isinstance(design, dict):
        findings.append(Finding("error", "design", "缺少全篇设计协议：style_id、grid 和项目级构图规则"))
    else:
        for key in ("style_id", "grid"):
            if not design.get(key):
                findings.append(Finding("error", f"design.{key}", "缺少全篇设计决定"))
        style_id = str(design.get("style_id", ""))
        if style_id and not style_id.startswith("custom:"):
            catalog = json.loads(STYLE_CATALOG.read_text(encoding="utf-8"))
            known_styles = {item.get("id") for item in catalog.get("styles", [])}
            if style_id not in known_styles:
                findings.append(Finding("error", "design.style_id", f"未知风格 ID：{style_id}；使用 catalog styles 查询或 custom:<name>"))
        if design.get("reference_deck"):
            reference_decisions = plan.get("reference_decisions") if isinstance(plan, dict) else None
            if not isinstance(reference_decisions, dict) or not reference_decisions.get("borrow") or not reference_decisions.get("avoid"):
                findings.append(Finding("error", "plan.reference_decisions", "使用参考稿时必须记录借鉴项和拒绝照抄项"))
            if not design.get("reference_slides") or not design.get("reference_grammar"):
                findings.append(Finding("error", "design.reference_grammar", "使用参考稿时必须指定样本页并提取可执行视觉语法"))

    tokens = style_token_map(spec)
    for slide_index, slide in enumerate(slides, start=1):
        location = f"slide[{slide_index}]"
        if not isinstance(slide, dict):
            findings.append(Finding("error", location, "页面必须是对象"))
            continue
        slide_name = slide.get("name")
        if not isinstance(slide_name, str) or not slide_name.strip():
            findings.append(Finding("error", location, "缺少语义页面名"))
        elif slide_name in slide_names:
            findings.append(Finding("error", location, f"重复页面名：{slide_name}"))
        else:
            slide_names.add(slide_name)
        if not slide.get("role"):
            findings.append(Finding("error", location, "缺少页面角色 role"))
        if not slide.get("message"):
            findings.append(Finding("error", location, "缺少单页结论 message"))
        for design_key in ("layout_id", "density", "visual_job", "visual_anchor", "asset_plan", "text_budget"):
            if not slide.get(design_key):
                findings.append(Finding("error", f"{location}.{design_key}", "缺少页面设计决定"))

        elements = slide.get("elements", [])
        if not isinstance(elements, list):
            findings.append(Finding("error", location, "elements 必须是数组"))
            continue
        if len(elements) > 36:
            findings.append(Finding("warning", location, f"对象较多：{len(elements)} 个，检查信息密度"))

        object_names: set[str] = set()
        has_title_signal = False
        actual_icons: set[str] = set()
        font_sizes: set[float] = set()
        text_blocks = 0
        total_characters = 0
        structural_visuals = 0
        relationship_visuals = 0
        repeated_text_containers: list[tuple[str, str]] = []
        for element_index, element in enumerate(elements, start=1):
            element_location = f"{location}.elements[{element_index}]"
            if not isinstance(element, dict):
                findings.append(Finding("error", element_location, "元素必须是对象"))
                continue
            element_type = element.get("type")
            if element_type not in PASS_TYPES | {"icon"}:
                findings.append(Finding("error", element_location, f"不支持的元素类型：{element_type}"))
                continue
            raw_props = element.get("props", {})
            if not isinstance(raw_props, dict):
                findings.append(Finding("error", element_location, "props 必须是对象"))
                continue
            props = resolve_tokens(raw_props, tokens)
            if "padding" in props:
                findings.append(Finding("error", element_location, "文字内边距使用 margin，不使用 padding"))
            name = props.get("name")
            if element_type not in {"notes"}:
                if not isinstance(name, str) or not name.strip():
                    findings.append(Finding("warning", element_location, "缺少语义对象名"))
                elif name in object_names:
                    findings.append(Finding("error", element_location, f"重复对象名：{name}"))
                else:
                    object_names.add(name)
                    lowered = name.lower()
                    if "title" in lowered or "headline" in lowered:
                        has_title_signal = True

            if element_type == "icon":
                icon_id = element.get("icon")
                if isinstance(icon_id, str):
                    actual_icons.add(icon_id)
                if not isinstance(icon_id, str):
                    findings.append(Finding("error", element_location, "图标元素缺少 icon"))
                else:
                    try:
                        icon_source(icon_id)
                    except ValueError as exc:
                        findings.append(Finding("error", element_location, str(exc)))
                    family = icon_id.split("/", 1)[0]
                    if family != "simple-icons":
                        generic_icon_families.add(family)
                if not props.get("alt"):
                    findings.append(Finding("warning", element_location, "图标缺少替代文本 alt"))
                try:
                    normalize_hex(str(resolve_tokens(element.get("color", "$text"), tokens)))
                except ValueError as exc:
                    findings.append(Finding("error", element_location, str(exc)))

            if element_type == "picture":
                src = props.get("src") or props.get("path")
                if not src:
                    findings.append(Finding("error", element_location, "图片缺少 src"))
                elif not re.match(r"^(https?://|data:)", str(src)):
                    resolved = Path(resolve_asset(str(src), spec_path.parent))
                    if not resolved.is_file():
                        findings.append(Finding("error", element_location, f"图片不存在：{src}"))
                if not props.get("alt"):
                    findings.append(Finding("warning", element_location, "图片缺少替代文本 alt"))

            font_name = props.get("font")
            if isinstance(font_name, str) and font_name.strip():
                requested_fonts.add(font_name.strip())

            text_value = props.get("text")
            if isinstance(text_value, str) and text_value.strip():
                text_blocks += 1
                total_characters += len(text_value.replace("\n", ""))
            if element_type in {"icon", "picture", "chart", "table", "connector"}:
                structural_visuals += 1
                relationship_visuals += 1
            if element_type == "shape":
                geometry = str(props.get("preset") or props.get("geometry") or "rect").lower()
                if geometry in {"rect", "roundrect"} and text_value:
                    repeated_text_containers.append((str(props.get("width", "")), str(props.get("height", ""))))
                if any(token in geometry for token in ("arrow", "chevron", "line")):
                    relationship_visuals += 1
                if not text_value:
                    structural_visuals += 1

            size = length_to_pt(props.get("size"))
            if size is not None:
                font_sizes.add(size)
            if size is not None and size < 8:
                findings.append(Finding("warning", element_location, f"字号较小：{size:g}pt"))

            x = length_to_pt(props.get("x"))
            y = length_to_pt(props.get("y"))
            element_width = length_to_pt(props.get("width"))
            element_height = length_to_pt(props.get("height"))
            if None not in (x, y, element_width, element_height):
                assert x is not None and y is not None
                assert element_width is not None and element_height is not None
                if x < -0.5 or y < -0.5 or x + element_width > CANVAS_WIDTH_PT + 0.5 or y + element_height > CANVAS_HEIGHT_PT + 0.5:
                    findings.append(Finding("error", element_location, "对象越出 960×540pt 画布"))

        text_budget = slide.get("text_budget")
        if isinstance(text_budget, dict):
            max_blocks = text_budget.get("max_text_blocks")
            if isinstance(max_blocks, int) and text_blocks > max_blocks:
                findings.append(Finding("warning", location, f"实际文本块 {text_blocks} 个，超过预算 {max_blocks} 个"))
        if text_blocks >= 6 and len(font_sizes) < 3:
            findings.append(Finding("warning", location, "文字较多但字号层级少于 3 级，检查标题、结论、证据和脚注的视觉层级"))
        if structural_visuals == 0 and slide.get("role") not in {"cover", "section", "closing"}:
            findings.append(Finding("warning", location, "没有结构性视觉对象；检查页面是否退化为纯文字"))
        repeated_container_count = max((repeated_text_containers.count(size) for size in set(repeated_text_containers)), default=0)
        if len(repeated_text_containers) >= 4 and repeated_container_count >= 3 and relationship_visuals == 0:
            findings.append(Finding("warning", location, "存在至少 3 个同尺寸矩形文字容器；检查它们是否真正表达并列关系，而不是卡片墙"))
        density = slide.get("density")
        density_limits = {"low": 220, "medium": 420, "high": 700}
        if density in density_limits and total_characters > density_limits[density]:
            findings.append(Finding("warning", location, f"页面约 {total_characters} 字，超过 {density} 密度建议上限 {density_limits[density]}"))

        asset_plan = slide.get("asset_plan")
        planned_icons = set(asset_plan.get("icons", [])) if isinstance(asset_plan, dict) and isinstance(asset_plan.get("icons", []), list) else set()
        missing_planned_icons = planned_icons - actual_icons
        if missing_planned_icons:
            findings.append(Finding("warning", location, f"素材计划中的图标未落到元素：{', '.join(sorted(missing_planned_icons))}"))

        if not has_title_signal and slide.get("role") not in {"cover", "section", "closing"}:
            findings.append(Finding("warning", location, "未发现名称中含 title/headline 的标题对象"))

    if len(generic_icon_families) > 1:
        findings.append(Finding("warning", "icons", f"混用了多个通用图标家族：{', '.join(sorted(generic_icon_families))}"))
    for font_name in sorted(requested_fonts):
        available, matched = font_is_available(font_name)
        if not available:
            findings.append(Finding("warning", "fonts", f"本机未找到字体 {font_name}，预览可能回退为 {matched}；确认目标环境或更换字体"))
    return findings


def compile_commands(spec: dict[str, Any], spec_path: Path, asset_dir: Path) -> list[dict[str, Any]]:
    commands: list[dict[str, Any]] = []
    tokens = style_token_map(spec)
    for slide_index, slide in enumerate(spec["slides"], start=1):
        slide_props: dict[str, Any] = {"name": slide["name"]}
        for key in ("background", "transition", "advanceTime", "advanceClick", "hidden"):
            if key in slide:
                slide_props[key] = resolve_tokens(slide[key], tokens)
        commands.append({"command": "add", "parent": "/", "type": "slide", "props": slide_props})

        for element in slide.get("elements", []):
            element_type = element["type"]
            props = resolve_tokens(dict(element.get("props", {})), tokens)
            if element_type == "icon":
                icon_color = resolve_tokens(str(element.get("color", "$text")), tokens)
                icon_file = materialize_icon(element["icon"], str(icon_color), asset_dir)
                props["src"] = str(icon_file.resolve())
                commands.append({"command": "add", "parent": f"/slide[{slide_index}]", "type": "picture", "props": props})
                continue
            if element_type == "picture":
                source_key = "src" if "src" in props else "path" if "path" in props else None
                if source_key and not re.match(r"^(https?://|data:)", str(props[source_key])):
                    props[source_key] = resolve_asset(str(props[source_key]), spec_path.parent)
            commands.append({"command": "add", "parent": f"/slide[{slide_index}]", "type": element_type, "props": props})

        if slide.get("notes"):
            commands.append({
                "command": "add",
                "parent": f"/slide[{slide_index}]",
                "type": "notes",
                "props": {"text": slide["notes"]},
            })
    return commands


def repair_svg_fallbacks(pptx_path: Path, asset_dir: Path) -> int:
    if shutil.which("ffmpeg") is None:
        return 0
    fallback_dir = asset_dir / "svg_fallbacks"
    fallback_dir.mkdir(parents=True, exist_ok=True)
    replacements: dict[str, bytes] = {}
    with zipfile.ZipFile(pptx_path, "r") as package:
        names = set(package.namelist())
        svg_names = sorted(name for name in names if name.startswith("ppt/media/") and name.endswith(".svg"))
        for index, svg_name in enumerate(svg_names, start=1):
            png_name = f"{svg_name[:-4]}.png"
            if png_name not in names:
                continue
            svg_file = fallback_dir / f"icon-{index:03d}.svg"
            png_file = fallback_dir / f"icon-{index:03d}.png"
            svg_file.write_bytes(package.read(svg_name))
            result = subprocess.run(
                [
                    "ffmpeg", "-y", "-loglevel", "error", "-i", str(svg_file),
                    "-frames:v", "1", "-vf", "scale=256:256:flags=lanczos", str(png_file),
                ],
                text=True,
                capture_output=True,
            )
            if result.returncode == 0 and png_file.is_file() and png_file.stat().st_size > 100:
                replacements[png_name] = png_file.read_bytes()

        if not replacements:
            return 0
        repacked = asset_dir / f"{pptx_path.stem}.repacked.pptx"
        with zipfile.ZipFile(repacked, "w") as target:
            for info in package.infolist():
                target.writestr(info, replacements.get(info.filename, package.read(info.filename)))
    repacked.replace(pptx_path)
    return len(replacements)


def run(command: list[str], *, capture: bool = False) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, check=True, text=True, capture_output=capture)


def print_findings(findings: list[Finding]) -> None:
    if not findings:
        print("规格检查通过：0 个问题")
        return
    for finding in findings:
        print(finding.render())
    errors = sum(item.severity == "error" for item in findings)
    warnings = sum(item.severity == "warning" for item in findings)
    print(f"规格检查：{errors} 个错误，{warnings} 个警告")


def ensure_runtime() -> None:
    if shutil.which("officecli") is None:
        raise RuntimeError("未找到 PPTX 构建运行时，请确认 officecli 可执行文件位于 PATH")


def command_catalog(args: argparse.Namespace) -> int:
    if args.kind == "components":
        data = json.loads(COMPONENT_CATALOG.read_text(encoding="utf-8"))
        for item in data.get("components", []):
            uses = "、".join(item.get("use_when", []))
            layers = " → ".join(item.get("layers", []))
            print(f"{item.get('id')} | 适用：{uses} | 对象层：{layers}")
        return 0

    if args.kind == "fonts":
        data = json.loads(STYLE_CATALOG.read_text(encoding="utf-8"))
        fonts = sorted({font for item in data.get("styles", []) for font in item.get("fonts", {}).values()})
        for font_name in fonts:
            available, matched = font_is_available(font_name)
            status = "available" if available else "fallback"
            print(f"{font_name} | {status} | 本机匹配：{matched or '无法检查'}")
        return 0

    if args.kind == "styles":
        data = json.loads(STYLE_CATALOG.read_text(encoding="utf-8"))
        for item in data.get("styles", []):
            uses = "、".join(item.get("use_for", []))
            colors = item.get("colors", {})
            fonts = item.get("fonts", {})
            print(
                f"{item.get('id')} | {item.get('name')} | 适用：{uses} | "
                f"强调色：#{colors.get('accent', '')} | "
                f"标题/正文：{fonts.get('title', '')}/{fonts.get('body', '')} | "
                f"图标：{item.get('icon_family', '')}"
            )
        return 0

    if args.kind == "layouts":
        data = json.loads(LAYOUT_CATALOG.read_text(encoding="utf-8"))
        for item in data.get("layouts", []):
            regions = "、".join(item.get("regions", {}).keys())
            print(
                f"{item.get('id')} | 角色：{item.get('role')} | "
                f"密度：{item.get('density')} | 区域：{regions}"
            )
        return 0

    for family_dir in sorted(path for path in ICON_ROOT.iterdir() if path.is_dir()):
        count = sum(1 for _ in family_dir.glob("*.svg"))
        print(f"{family_dir.name} | {count} 个 SVG")
    return 0


def command_icons(args: argparse.Namespace) -> int:
    families = sorted(path.name for path in ICON_ROOT.iterdir() if path.is_dir())
    selected = families if args.family == "all" else [args.family]
    missing = [family for family in selected if family not in families]
    if missing:
        print(f"[ERROR] 未知图标家族：{', '.join(missing)}", file=sys.stderr)
        print(f"可用家族：{', '.join(families)}", file=sys.stderr)
        return 1

    terms = [term.lower() for term in re.split(r"[\s,]+", args.query.strip()) if term]
    matches: list[str] = []
    for family in selected:
        for source in sorted((ICON_ROOT / family).glob("*.svg")):
            stem = source.stem.lower()
            if all(term in stem for term in terms):
                matches.append(f"{family}/{source.stem}")
    for icon_id in matches[: args.limit]:
        print(icon_id)
    if len(matches) > args.limit:
        print(f"... 共 {len(matches)} 个结果，仅显示前 {args.limit} 个", file=sys.stderr)
    if not matches:
        print("未找到匹配图标。可缩短关键词或使用 --family all。", file=sys.stderr)
        return 1
    return 0


def command_lint(args: argparse.Namespace) -> int:
    spec_path = Path(args.spec).resolve()
    try:
        spec = load_spec(spec_path)
    except ValueError as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 1
    findings = lint_spec(spec, spec_path)
    print_findings(findings)
    return 1 if any(item.severity == "error" for item in findings) else 0


def command_build(args: argparse.Namespace) -> int:
    ensure_runtime()
    spec_path = Path(args.spec).resolve()
    output = Path(args.output).resolve()
    try:
        spec = load_spec(spec_path)
    except ValueError as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 1

    findings = lint_spec(spec, spec_path)
    print_findings(findings)
    if any(item.severity == "error" for item in findings):
        print("存在规格错误，停止构建。", file=sys.stderr)
        return 1
    if output.exists() and not args.force:
        print(f"输出已存在：{output}；使用 --force 覆盖。", file=sys.stderr)
        return 1

    output.parent.mkdir(parents=True, exist_ok=True)
    asset_dir = output.parent / f"{output.stem}_assets"
    asset_dir.mkdir(parents=True, exist_ok=True)
    commands = compile_commands(spec, spec_path, asset_dir)
    command_file = asset_dir / "nova_commands.json"
    command_file.write_text(json.dumps(commands, ensure_ascii=False, indent=2), encoding="utf-8")

    language = str(spec.get("meta", {}).get("language", "zh-CN"))
    try:
        run(["officecli", "create", str(output), "--type", "pptx", "--locale", language, "--force"])
        run(["officecli", "batch", str(output), "--input", str(command_file), "--stop-on-error"])
        subprocess.run(["officecli", "close", str(output)], text=True, capture_output=True)
        repaired_fallbacks = repair_svg_fallbacks(output, asset_dir)
        validation = run(["officecli", "validate", str(output)], capture=True)
        issues = run(["officecli", "view", str(output), "issues"], capture=True)
        stats = run(["officecli", "view", str(output), "stats"], capture=True)
    except subprocess.CalledProcessError as exc:
        print(f"构建失败，退出码 {exc.returncode}", file=sys.stderr)
        if exc.stdout:
            print(exc.stdout, file=sys.stderr)
        if exc.stderr:
            print(exc.stderr, file=sys.stderr)
        return exc.returncode or 1
    finally:
        subprocess.run(["officecli", "close", str(output)], text=True, capture_output=True)

    print(validation.stdout.strip())
    if repaired_fallbacks:
        print(f"已修复 {repaired_fallbacks} 个 SVG 图标的 PNG 兼容预览，矢量 SVG 保持不变")
    print(issues.stdout.strip())
    print(stats.stdout.strip())
    match = re.search(r"Found\s+(\d+)\s+issue", issues.stdout)
    issue_count = int(match.group(1)) if match else 0
    if issue_count and not args.allow_issues:
        print(f"检测到 {issue_count} 个版面问题，停止交付；修复后重建，或经人工确认后使用 --allow-issues。", file=sys.stderr)
        return 2
    print(f"构建完成：{output}")
    print(f"构建记录：{command_file}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Nova PPT 原生演示稿构建器")
    subparsers = parser.add_subparsers(dest="command", required=True)

    catalog_parser = subparsers.add_parser("catalog", help="查看风格、布局或图标家族目录")
    catalog_parser.add_argument("kind", choices=["styles", "layouts", "components", "icons", "fonts"])
    catalog_parser.set_defaults(handler=command_catalog)

    icons_parser = subparsers.add_parser("icons", help="检索本地 SVG 图标资产")
    icons_parser.add_argument("--query", required=True, help="文件名关键词，例如 shield、walk、calendar")
    icons_parser.add_argument("--family", default="all", help="图标家族，默认 all")
    icons_parser.add_argument("--limit", type=int, default=30)
    icons_parser.set_defaults(handler=command_icons)

    lint_parser = subparsers.add_parser("lint", help="检查 deck-spec.json")
    lint_parser.add_argument("--spec", required=True)
    lint_parser.set_defaults(handler=command_lint)

    build_parser_ = subparsers.add_parser("build", help="生成并校验 PPTX")
    build_parser_.add_argument("--spec", required=True)
    build_parser_.add_argument("--output", required=True)
    build_parser_.add_argument("--force", action="store_true")
    build_parser_.add_argument("--allow-issues", action="store_true")
    build_parser_.set_defaults(handler=command_build)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    return int(args.handler(args))


if __name__ == "__main__":
    raise SystemExit(main())
