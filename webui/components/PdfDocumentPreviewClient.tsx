"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

interface Props {
  sourceUrl: string;
  fileName: string;
  onUseCompatibilityView: () => void;
  onExpandPreview?: () => void;
}

function useContainerWidth(ref: React.RefObject<HTMLDivElement | null>): number {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => setWidth(element.clientWidth);
    const observer = new ResizeObserver(update);
    observer.observe(element);
    update();
    return () => observer.disconnect();
  }, [ref]);

  return width;
}

export function PdfDocumentPreviewClient({ sourceUrl, fileName, onUseCompatibilityView, onExpandPreview }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const viewportWidth = useContainerWidth(viewportRef);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [scale, setScale] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
    setPageCount(0);
    setScale(1);
    setError(null);
  }, [sourceUrl]);

  const pageWidth = viewportWidth > 0
    ? Math.max(280, (viewportWidth - 40) * scale)
    : undefined;

  return (
    <div className="document-native-preview">
      <div className="document-native-toolbar">
        <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1} title="上一页" aria-label="上一页">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <span>{pageCount ? `${page} / ${pageCount}` : "- / -"}</span>
        <button type="button" onClick={() => setPage((value) => Math.min(pageCount || 1, value + 1))} disabled={!pageCount || page >= pageCount} title="下一页" aria-label="下一页">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
        </button>
        <span className="document-native-toolbar-separator" />
        <button type="button" onClick={() => setScale((value) => Math.max(0.5, Number((value - 0.1).toFixed(1))))} disabled={scale <= 0.5} title="缩小" aria-label="缩小">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="M8 11h6" /><path d="m21 21-4.3-4.3" /></svg>
        </button>
        <span>{Math.round(scale * 100)}%</span>
        <button type="button" onClick={() => { onExpandPreview?.(); setScale((value) => Math.min(2.5, Number((value + 0.1).toFixed(1)))); }} disabled={scale >= 2.5} title="放大并展开预览" aria-label="放大并展开预览">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="M11 8v6M8 11h6" /><path d="m21 21-4.3-4.3" /></svg>
        </button>
        <button type="button" className="document-native-compatibility" onClick={onUseCompatibilityView}>浏览器视图</button>
      </div>
      <div ref={viewportRef} className="document-native-viewport document-native-pdf" aria-label={`${fileName} PDF 预览`}>
        {error ? (
          <div className="document-native-error">
            <strong>PDF 预览失败</strong>
            <span>{error}</span>
            <button type="button" onClick={onUseCompatibilityView}>打开浏览器视图</button>
          </div>
        ) : (
          <Document
            key={sourceUrl}
            file={sourceUrl}
            loading={<div className="document-native-status">正在加载 PDF…</div>}
            onLoadSuccess={({ numPages }) => {
              setPageCount(numPages);
              setPage((value) => Math.min(value, numPages));
            }}
            onLoadError={(reason) => setError(reason instanceof Error ? reason.message : String(reason))}
          >
            <Page
              pageNumber={page}
              width={pageWidth}
              renderAnnotationLayer
              renderTextLayer
              loading={<div className="document-native-status">正在渲染页面…</div>}
            />
          </Document>
        )}
      </div>
    </div>
  );
}
