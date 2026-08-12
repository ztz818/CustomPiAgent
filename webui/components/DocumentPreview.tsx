"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

interface PreviewProps {
  sourceUrl: string;
  fileName: string;
  onUseCompatibilityView: () => void;
  onExpandPreview?: () => void;
}

export const PdfDocumentPreview = dynamic(
  () => import("./PdfDocumentPreviewClient").then((module) => module.PdfDocumentPreviewClient),
  {
    ssr: false,
    loading: () => <div className="document-native-status">正在加载 PDF 查看器…</div>,
  },
);

export function DocxDocumentPreview({ sourceUrl, fileName, onUseCompatibilityView }: PreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;
    const target: HTMLDivElement = container;

    target.replaceChildren();
    setStatus("loading");
    setError(null);

    async function render() {
      try {
        const response = await fetch(sourceUrl);
        if (!response.ok) throw new Error(`无法读取文件（${response.status}）`);
        const buffer = await response.arrayBuffer();
        if (cancelled) return;
        const { renderAsync } = await import("docx-preview");
        if (cancelled) return;
        await renderAsync(buffer, target, undefined, {
          className: "docx-native-page",
          inWrapper: true,
          breakPages: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true,
          useBase64URL: true,
        });
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
      target.replaceChildren();
    };
  }, [sourceUrl]);

  return (
    <div className="document-native-preview">
      <div className="document-native-toolbar">
        <span>Word</span>
        {status === "loading" && <span className="document-native-status-inline">正在渲染…</span>}
        <button type="button" className="document-native-compatibility" onClick={onUseCompatibilityView}>兼容视图</button>
      </div>
      {status === "error" && (
        <div className="document-native-error">
          <strong>DOCX 预览失败</strong>
          <span>{error}</span>
          <button type="button" onClick={onUseCompatibilityView}>打开兼容视图</button>
        </div>
      )}
      <div ref={containerRef} className="document-native-viewport document-native-docx" aria-label={`${fileName} Word 预览`} />
    </div>
  );
}
