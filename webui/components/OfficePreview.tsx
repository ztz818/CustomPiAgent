"use client";

import { useEffect, useRef, useState } from "react";
import { encodeFilePathForApi, getFileName, getRelativeFilePath } from "@/lib/file-paths";

type OfficeKind = "excel" | "pptx";

const PPTX_BASE_WIDTH = 960;
const DEFAULT_PPTX_RATIO = 16 / 9;

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
  sourceSessionId?: string | null;
  onUseCompatibilityView?: () => void;
  onExpandPreview?: () => void;
}

async function preparePptxSource(source: ArrayBuffer): Promise<{ source: ArrayBuffer; ratio: number }> {
  try {
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(source);
    const presentation = zip.file("ppt/presentation.xml");
    if (!presentation) return { source, ratio: DEFAULT_PPTX_RATIO };

    let xml = await presentation.async("text");
    const sizeTag = xml.match(/<p:sldSz\b[^>]*>/)?.[0] ?? "";
    const width = Number(sizeTag.match(/\bcx="(\d+)"/)?.[1]);
    const height = Number(sizeTag.match(/\bcy="(\d+)"/)?.[1]);
    const ratio = width > 0 && height > 0 ? width / height : DEFAULT_PPTX_RATIO;

    // pptx-preview assumes this optional node has an object-shaped payload
    // and calls Object.keys on it. Normalize it for decks with missing or
    // parser-unfriendly default text style content.
    const defaultTextStyle = /<p:defaultTextStyle\b[^>]*>[\s\S]*?<\/p:defaultTextStyle>/.test(xml);
    const normalizedStyle = "<p:defaultTextStyle><a:defPPr><a:defRPr/></a:defPPr></p:defaultTextStyle>";
    if (defaultTextStyle) {
      xml = xml.replace(/<p:defaultTextStyle\b[^>]*>[\s\S]*?<\/p:defaultTextStyle>/, normalizedStyle);
    } else {
      xml = xml.replace(/<\/p:presentation>\s*$/, `${normalizedStyle}</p:presentation>`);
    }
    zip.file("ppt/presentation.xml", xml);
    return { source: await zip.generateAsync({ type: "arraybuffer" }), ratio };
  } catch {
    // Keep the original file available if normalization is not possible.
    return { source, ratio: DEFAULT_PPTX_RATIO };
  }
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

export function OfficePreview({ filePath, cwd, kind, sourceSessionId, onUseCompatibilityView, onExpandPreview }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const previewerRef = useRef<PreviewerHandle | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [slidePage, setSlidePage] = useState(1);
  const [slideCount, setSlideCount] = useState(0);
  const [presentationRatio, setPresentationRatio] = useState(DEFAULT_PPTX_RATIO);
  const [presentationZoom, setPresentationZoom] = useState(1);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (kind !== "pptx") return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    const update = () => setViewportSize({ width: viewport.clientWidth, height: viewport.clientHeight });
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    update();
    return () => observer.disconnect();
  }, [kind]);

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
    setPresentationRatio(DEFAULT_PPTX_RATIO);
    setPresentationZoom(1);

    const encoded = encodeFilePathForApi(filePath);
    const search = new URLSearchParams({ type: "download" });
    if (sourceSessionId) search.set("sessionId", sourceSessionId);
    const responsePromise = fetch(`/api/files/${encoded}?${search.toString()}`);

    async function render() {
      try {
        if (kind === "excel") {
          const [response, excelPreview] = await Promise.all([
            responsePromise,
            import("@js-preview/excel"),
            waitForLayout(target),
          ]);
          if (!response.ok) throw new Error(`无法读取文件（${response.status}）`);
          const source = await response.arrayBuffer();
          if (cancelled) return;
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
          const [response, pptxPreview] = await Promise.all([
            responsePromise,
            import("pptx-preview"),
            waitForLayout(target),
          ]);
          if (!response.ok) throw new Error(`无法读取文件（${response.status}）`);
          const source = await response.arrayBuffer();
          if (cancelled) return;
          const prepared = await preparePptxSource(source);
          if (cancelled) return;
          const ratio = prepared.ratio;
          const renderHeight = Math.round(PPTX_BASE_WIDTH / ratio);
          target.style.width = `${PPTX_BASE_WIDTH}px`;
          target.style.height = `${renderHeight}px`;
          setPresentationRatio(ratio);
          const previewer = pptxPreview.init(target, {
            width: PPTX_BASE_WIDTH,
            height: renderHeight,
            mode: "slide",
          });
          previewerRef.current = previewer;
          await previewer.preview(prepared.source);
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
  }, [filePath, kind, sourceSessionId]);

  const changeSlide = (direction: "previous" | "next") => {
    const previewer = previewerRef.current;
    if (!previewer || status !== "ready") return;
    if (direction === "previous") previewer.renderPreSlide?.();
    else previewer.renderNextSlide?.();
    setSlidePage((previewer.currentIndex ?? 0) + 1);
  };

  const label = kind === "excel" ? "Excel" : "PowerPoint";
  const presentationHeight = Math.round(PPTX_BASE_WIDTH / presentationRatio);
  const fitScale = viewportSize.width > 0 && viewportSize.height > 0
    ? Math.min(
        Math.max(0.1, (viewportSize.width - 32) / PPTX_BASE_WIDTH),
        Math.max(0.1, (viewportSize.height - 32) / presentationHeight),
      )
    : 1;
  const presentationScale = fitScale * presentationZoom;

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
          <>
            <div className="office-preview-zoom">
              <button type="button" onClick={() => setPresentationZoom((value) => Math.max(0.5, Number((value - 0.1).toFixed(1))))} disabled={presentationZoom <= 0.5} title="缩小" aria-label="缩小">−</button>
              <button type="button" onClick={() => setPresentationZoom(1)} title="适应窗口">适应</button>
              <span>{Math.round(presentationZoom * 100)}%</span>
              <button type="button" onClick={() => { onExpandPreview?.(); setPresentationZoom((value) => Math.min(2, Number((value + 0.1).toFixed(1)))); }} disabled={presentationZoom >= 2} title="放大并展开预览" aria-label="放大并展开预览">+</button>
            </div>
            <div className="office-preview-pagination">
            <button type="button" onClick={() => changeSlide("previous")} title="上一页" aria-label="上一页">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            </button>
            <span>{slidePage} / {slideCount}</span>
            <button type="button" onClick={() => changeSlide("next")} title="下一页" aria-label="下一页">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
            </button>
            </div>
          </>
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
      {kind === "pptx" ? (
        <div ref={viewportRef} className="office-preview-canvas office-preview-pptx" aria-label={`${getFileName(filePath)} 预览`}>
          <div className="office-preview-pptx-stage" style={{ width: PPTX_BASE_WIDTH * presentationScale, height: presentationHeight * presentationScale }}>
            <div
              ref={containerRef}
              className="office-preview-pptx-render"
              style={{ width: PPTX_BASE_WIDTH, height: presentationHeight, transform: `scale(${presentationScale})` }}
            />
          </div>
        </div>
      ) : (
        <div ref={containerRef} className="office-preview-canvas office-preview-excel" aria-label={`${getFileName(filePath)} 预览`} />
      )}
    </div>
  );
}
