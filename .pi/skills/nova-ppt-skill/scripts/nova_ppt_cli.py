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
from dataclasses import dataclass
from pathlib import Path
from typing import Any

SKILL_ROOT = Path(__file__).resolve().parents[1]
ICON_ROOT = SKILL_ROOT / "assets" / "icons"
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
    slide_names: set[str] = set()

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
            findings.append(Finding("warning", location, "缺少页面角色 role"))
        if not slide.get("message"):
            findings.append(Finding("warning", location, "缺少单页结论 message"))

        elements = slide.get("elements", [])
        if not isinstance(elements, list):
            findings.append(Finding("error", location, "elements 必须是数组"))
            continue
        if len(elements) > 36:
            findings.append(Finding("warning", location, f"对象较多：{len(elements)} 个，检查信息密度"))

        object_names: set[str] = set()
        has_title_signal = False
        for element_index, element in enumerate(elements, start=1):
            element_location = f"{location}.elements[{element_index}]"
            if not isinstance(element, dict):
                findings.append(Finding("error", element_location, "元素必须是对象"))
                continue
            element_type = element.get("type")
            if element_type not in PASS_TYPES | {"icon"}:
                findings.append(Finding("error", element_location, f"不支持的元素类型：{element_type}"))
                continue
            props = element.get("props", {})
            if not isinstance(props, dict):
                findings.append(Finding("error", element_location, "props 必须是对象"))
                continue
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
                    normalize_hex(str(element.get("color", "262626")))
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

            size = length_to_pt(props.get("size"))
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

        if not has_title_signal and slide.get("role") not in {"cover", "section", "closing"}:
            findings.append(Finding("warning", location, "未发现名称中含 title/headline 的标题对象"))

    if len(generic_icon_families) > 1:
        findings.append(Finding("warning", "icons", f"混用了多个通用图标家族：{', '.join(sorted(generic_icon_families))}"))
    return findings


def compile_commands(spec: dict[str, Any], spec_path: Path, asset_dir: Path) -> list[dict[str, Any]]:
    commands: list[dict[str, Any]] = []
    for slide_index, slide in enumerate(spec["slides"], start=1):
        slide_props: dict[str, Any] = {"name": slide["name"]}
        for key in ("background", "transition", "advanceTime", "advanceClick", "hidden"):
            if key in slide:
                slide_props[key] = slide[key]
        commands.append({"command": "add", "parent": "/", "type": "slide", "props": slide_props})

        for element in slide.get("elements", []):
            element_type = element["type"]
            props = dict(element.get("props", {}))
            if element_type == "icon":
                icon_file = materialize_icon(element["icon"], str(element.get("color", "262626")), asset_dir)
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
