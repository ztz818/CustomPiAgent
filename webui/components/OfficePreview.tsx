"use client";

import { useEffect, useRef, useState } from "react";
import { encodeFilePathForApi, getFileName, getRelativeFilePath } from "@/lib/file-paths";

type OfficeKind = "excel" | "pptx";

type PreviewerHandle = {
  destroy?: () => void;
  renderNextSlide?: () => void;
  renderPreSlide?: () => void;
  slideCount?: number;
  currentIndex?: number;
};

interface Props {
  filePath: string;
  cwd?: string;
  kind: OfficeKind;
  onUseCompatibilityView?: () => void;
}

function waitForLayout(element: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      clearTimeout(timeout);
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    };
    const observer = new ResizeObserver(() => {
      if (element.clientWidth >= 240 && element.clientHeight >= 180) finish();
    });
    const timeout = window.setTimeout(finish, 2500);
    observer.observe(element);
    if (element.clientWidth >= 240 && element.clientHeight >= 180) finish();
  });
}

export function OfficePreview({ filePath, cwd, kind, onUseCompatibilityView }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previewerRef = useRef<PreviewerHandle | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [slidePage, setSlidePage] = useState(1);
  const [slideCount, setSlideCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;
    const target: HTMLDivElement = container;

    target.replaceChildren();
    previewerRef.current?.destroy?.();
    previewerRef.current = null;
    setStatus("loading");
    setError(null);
    setSlidePage(1);
    setSlideCount(0);

    async function render() {
      try {
        await waitForLayout(target);
        if (cancelled) return;

        const encoded = encodeFilePathForApi(filePath);
        const response = await fetch(`/api/files/${encoded}?type=download`);
        if (!response.ok) throw new Error(`无法读取文件（${response.status}）`);
        const source = await response.arrayBuffer();
        if (cancelled) return;

        if (kind === "excel") {
          const excelPreview = await import("@js-preview/excel");
          const previewer = excelPreview.default.init(target, {
            minColLength: 8,
            minRowLength: 20,
            showContextmenu: false,
          });
          previewerRef.current = previewer;
          await previewer.preview(source);
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          const canvas = target.querySelector("canvas");
          if (!canvas || canvas.width === 0 || canvas.height === 0) {
            throw new Error("工作簿画布未能完成初始化");
          }
        } else {
          const pptxPreview = await import("pptx-preview");
          const previewer = pptxPreview.init(target, {
            width: Math.max(target.clientWidth - 32, 320),
            height: Math.max(target.clientHeight - 32, 220),
            mode: "slide",
          });
          previewerRef.current = previewer;
          await previewer.preview(source);
          setSlideCount(previewer.slideCount);
          setSlidePage(previewer.currentIndex + 1);
        }
        if (!cancelled) setStatus("ready");
      } catch (reason) {
        if (!cancelled) {
          setStatus("error");
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      }
    }

    void render();
    return () => {
      cancelled = true;
      previewerRef.current?.destroy?.();
      previewerRef.current = null;
      target.replaceChildren();
    };
  }, [filePath, kind]);

  const changeSlide = (direction: "previous" | "next") => {
    const previewer = previewerRef.current;
    if (!previewer || status !== "ready") return;
    if (direction === "previous") previewer.renderPreSlide?.();
    else previewer.renderNextSlide?.();
    setSlidePage((previewer.currentIndex ?? 0) + 1);
  };

  const label = kind === "excel" ? "Excel" : "PowerPoint";
  return (
    <div className="office-preview-shell">
      <div className="office-preview-header">
        <span className="office-preview-path" title={filePath}>{getRelativeFilePath(filePath, cwd)}</span>
        <span>{label}</span>
        {status === "loading" && <span className="office-preview-status">正在渲染…</span>}
        {kind === "excel" && onUseCompatibilityView && (
          <button className="office-preview-text-button" type="button" onClick={onUseCompatibilityView}>兼容视图</button>
        )}
        {kind === "pptx" && status === "ready" && (
          <div className="office-preview-pagination">
            <button type="button" onClick={() => changeSlide("previous")} title="上一页" aria-label="上一页">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            </button>
            <span>{slidePage} / {slideCount}</span>
            <button type="button" onClick={() => changeSlide("next")} title="下一页" aria-label="下一页">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
            </button>
          </div>
        )}
      </div>
      {status === "error" && (
        <div className="office-preview-error">
          <strong>{label} 预览失败</strong>
          <span>{error}</span>
          {onUseCompatibilityView ? (
            <button className="office-preview-fallback-button" type="button" onClick={onUseCompatibilityView}>打开兼容表格视图</button>
          ) : (
            <span>可先下载文件，或使用系统 Office 打开。</span>
          )}
        </div>
      )}
      <div ref={containerRef} className={`office-preview-canvas office-preview-${kind}`} aria-label={`${getFileName(filePath)} 预览`} />
    </div>
  );
}
