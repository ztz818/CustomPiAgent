"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vs } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { vscDarkPlus } from "react-syntax-highlighter/dist/cjs/styles/prism";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTheme } from "@/hooks/useTheme";
import { encodeFilePathForApi, getFileName, getRelativeFilePath } from "@/lib/file-paths";

interface Props {
  filePath: string;
  cwd?: string;
}

interface FileData {
  kind?: "text";
  content: string;
  language: string;
  size: number;
  modified?: string;
  truncated?: boolean;
  previewBytes?: number;
}

interface DocxData {
  kind: "docx";
  html: string;
  messages: Array<{ type: string; message: string }>;
  size: number;
}

interface XlsxSheet {
  name: string;
  rows: Array<Array<string | number | boolean | null>>;
  totalRows: number;
  totalCols: number;
  truncated: boolean;
}

interface XlsxData {
  kind: "xlsx";
  sheets: XlsxSheet[];
  size: number;
}

const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif"]);
const AUDIO_EXTS = new Set(["mp3", "wav", "ogg", "oga", "opus", "m4a", "aac", "flac", "weba", "webm"]);
const PDF_EXTS = new Set(["pdf"]);
const EDITABLE_TEXT_EXTS = new Set([
  "txt", "md", "mdx", "json", "jsonl", "yaml", "yml", "toml", "xml",
  "csv", "html", "htm", "css", "scss", "less", "js", "jsx", "ts", "tsx",
  "mjs", "cjs", "py", "rb", "go", "rs", "java", "kt", "swift", "c", "cpp",
  "h", "hpp", "cs", "sh", "bash", "zsh", "fish", "sql", "graphql", "gql",
  "env", "gitignore",
]);

function isImagePath(filePath: string): boolean {
  const base = getFileName(filePath);
  const ext = base.toLowerCase().split(".").pop() ?? "";
  return IMAGE_EXTS.has(ext);
}

function isAudioPath(filePath: string): boolean {
  const base = getFileName(filePath);
  const ext = base.toLowerCase().split(".").pop() ?? "";
  return AUDIO_EXTS.has(ext);
}

function isPdfPath(filePath: string): boolean {
  const base = getFileName(filePath);
  const ext = base.toLowerCase().split(".").pop() ?? "";
  return PDF_EXTS.has(ext);
}

function isEditableTextPath(filePath: string): boolean {
  const base = getFileName(filePath).toLowerCase();
  if (base === "dockerfile" || base.startsWith("dockerfile.")) return true;
  if (base === "makefile" || base === "gnumakefile") return true;
  if (base === ".env" || base.startsWith(".env.")) return true;
  if (base === ".gitignore") return true;
  const ext = base.split(".").pop() ?? "";
  return EDITABLE_TEXT_EXTS.has(ext);
}

type DiffLine =
  | { type: "unchanged"; text: string; lineNo: number }
  | { type: "removed"; text: string; lineNo: number }
  | { type: "added"; text: string; lineNo: number };

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Myers diff — returns line-level unified diff
function diffLines(oldLines: string[], newLines: string[]): DiffLine[] {
  const m = oldLines.length;
  const n = newLines.length;
  const max = m + n;
  const v: number[] = new Array(2 * max + 1).fill(0);
  const trace: number[][] = [];

  for (let d = 0; d <= max; d++) {
    trace.push([...v]);
    for (let k = -d; k <= d; k += 2) {
      let x: number;
      if (k === -d || (k !== d && v[k - 1 + max] < v[k + 1 + max])) {
        x = v[k + 1 + max];
      } else {
        x = v[k - 1 + max] + 1;
      }
      let y = x - k;
      while (x < m && y < n && oldLines[x] === newLines[y]) {
        x++;
        y++;
      }
      v[k + max] = x;
      if (x >= m && y >= n) {
        // backtrack
        const result: DiffLine[] = [];
        let cx = m, cy = n;
        for (let dd = d; dd > 0; dd--) {
          const pv = trace[dd - 1];
          const pk = cx - cy;
          let prevK: number;
          if (pk === -dd || (pk !== dd && pv[pk - 1 + max] < pv[pk + 1 + max])) {
            prevK = pk + 1;
          } else {
            prevK = pk - 1;
          }
          const prevX = pv[prevK + max];
          const prevY = prevX - prevK;
          while (cx > prevX && cy > prevY) {
            cx--;
            cy--;
            result.unshift({ type: "unchanged", text: oldLines[cx], lineNo: cx + 1 });
          }
          if (dd > 0) {
            if (cx > prevX) {
              cx--;
              result.unshift({ type: "removed", text: oldLines[cx], lineNo: cx + 1 });
            } else {
              cy--;
              result.unshift({ type: "added", text: newLines[cy], lineNo: cy + 1 });
            }
          }
        }
        while (cx > 0 && cy > 0) {
          cx--;
          cy--;
          result.unshift({ type: "unchanged", text: oldLines[cx], lineNo: cx + 1 });
        }
        return result;
      }
    }
  }
  // Fallback: treat all as replaced
  return [
    ...oldLines.map((t, i) => ({ type: "removed" as const, text: t, lineNo: i + 1 })),
    ...newLines.map((t, i) => ({ type: "added" as const, text: t, lineNo: i + 1 })),
  ];
}

function DiffView({ oldContent, newContent }: { oldContent: string; newContent: string; language: string }) {
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");
  const diff = diffLines(oldLines, newLines);

  const hasChanges = diff.some((l) => l.type !== "unchanged");
  if (!hasChanges) {
    return (
      <div style={{ padding: "12px 16px", fontSize: 12, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
        No changes
      </div>
    );
  }

  // Render with context: show 3 lines around each change, collapse the rest
  const CONTEXT = 3;
  const changed = new Set(diff.flatMap((l, i) => (l.type !== "unchanged" ? [i] : [])));
  const visible = new Set<number>();
  for (const ci of changed) {
    for (let j = Math.max(0, ci - CONTEXT); j <= Math.min(diff.length - 1, ci + CONTEXT); j++) {
      visible.add(j);
    }
  }

  const segments: Array<{ hidden: true; count: number } | { hidden: false; lines: DiffLine[] }> = [];
  let i = 0;
  while (i < diff.length) {
    if (visible.has(i)) {
      const block: DiffLine[] = [];
      while (i < diff.length && visible.has(i)) {
        block.push(diff[i]);
        i++;
      }
      segments.push({ hidden: false, lines: block });
    } else {
      let count = 0;
      while (i < diff.length && !visible.has(i)) {
        count++;
        i++;
      }
      segments.push({ hidden: true, count });
    }
  }

  // Track running line number for added/unchanged lines
  const newLineNos: number[] = [];
  let nlo = 1;
  for (const line of diff) {
    if (line.type === "removed") {
      newLineNos.push(0);
    } else {
      newLineNos.push(nlo++);
    }
  }

  let diffIdx = 0;

  return (
    <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, lineHeight: 1.6 }}>
      {segments.map((seg, si) => {
        if (seg.hidden) {
          const result = (
            <div
              key={si}
              style={{
                padding: "2px 16px",
                color: "var(--text-dim)",
                background: "var(--bg-panel)",
                fontSize: 11,
                borderTop: "1px solid var(--border)",
                borderBottom: "1px solid var(--border)",
              }}
            >
              ... {seg.count} unchanged lines ...
            </div>
          );
          diffIdx += seg.count;
          return result;
        }
        const lines = seg.lines.map((line, li) => {
          const idx = diffIdx + li;
          const newLno = newLineNos[idx];
          const bg =
            line.type === "added"
              ? "rgba(0,200,80,0.12)"
              : line.type === "removed"
              ? "rgba(240,60,60,0.14)"
              : "transparent";
          const prefix =
            line.type === "added" ? "+" : line.type === "removed" ? "-" : " ";
          const prefixColor =
            line.type === "added" ? "#4ade80" : line.type === "removed" ? "#f87171" : "var(--text-dim)";

          return (
            <div
              key={li}
              style={{
                display: "flex",
                background: bg,
                borderLeft: line.type === "added"
                  ? "3px solid #4ade80"
                  : line.type === "removed"
                  ? "3px solid #f87171"
                  : "3px solid transparent",
              }}
            >
              <span
                style={{
                  minWidth: 44,
                  padding: "0 8px 0 16px",
                  textAlign: "right",
                  color: "var(--text-dim)",
                  userSelect: "none",
                  fontSize: 11,
                  lineHeight: 1.6,
                  borderRight: "1px solid var(--border)",
                  background: "var(--bg-panel)",
                  flexShrink: 0,
                }}
              >
                {line.type === "removed" ? line.lineNo : newLno || ""}
              </span>
              <span
                style={{
                  minWidth: 16,
                  padding: "0 6px",
                  color: prefixColor,
                  userSelect: "none",
                  flexShrink: 0,
                  fontWeight: 600,
                }}
              >
                {prefix}
              </span>
              <span
                style={{
                  flex: 1,
                  padding: "0 8px 0 0",
                  whiteSpace: "pre",
                  color: "var(--text)",
                  overflowX: "auto",
                }}
              >
                {line.text || "\u00a0"}
              </span>
            </div>
          );
        });
        diffIdx += seg.lines.length;
        return <div key={si}>{lines}</div>;
      })}
    </div>
  );
}

function ImageViewer({ filePath, cwd }: { filePath: string; cwd?: string }) {
  const [watching, setWatching] = useState(false);
  const [bust, setBust] = useState(0);
  const [size, setSize] = useState<number | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const ext = getFileName(filePath).toLowerCase().split(".").pop() ?? "";

  useEffect(() => {
    setBust(0);
    setSize(null);
    setNaturalSize(null);
    setError(null);
    setWatching(false);

    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    const encoded = encodeFilePathForApi(filePath);
    const es = new EventSource(`/api/files/${encoded}?type=watch`);
    esRef.current = es;

    es.addEventListener("connected", () => setWatching(true));
    es.addEventListener("change", (e) => {
      try {
        const d = JSON.parse((e as MessageEvent).data) as { size?: number };
        if (typeof d.size === "number") setSize(d.size);
      } catch { /* ignore */ }
      setBust((b) => b + 1);
    });
    es.addEventListener("error", () => setWatching(false));
    es.onerror = () => setWatching(false);

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [filePath]);

  const encoded = encodeFilePathForApi(filePath);
  const src = `/api/files/${encoded}?type=read${bust ? `&v=${bust}` : ""}`;

  const formatSizeStr = size != null ? formatSize(size) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "4px 16px",
          borderBottom: "1px solid var(--border)",
          fontSize: 11,
          color: "var(--text-dim)",
          background: "var(--bg)",
          flexShrink: 0,
        }}
      >
        <span style={{ fontFamily: "var(--font-mono)" }} title={filePath}>
          {getRelativeFilePath(filePath, cwd)}
        </span>
        <span style={{ marginLeft: "auto" }}>{ext || "image"}</span>
        {naturalSize && <span>{naturalSize.w} × {naturalSize.h}</span>}
        {formatSizeStr && <span>{formatSizeStr}</span>}
        <span
          title={watching ? "Live sync active" : "Not watching"}
          style={{ display: "flex", alignItems: "center", gap: 4, color: watching ? "#4ade80" : "var(--text-dim)" }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: watching ? "#4ade80" : "var(--border)",
              display: "inline-block",
              boxShadow: watching ? "0 0 4px #4ade80" : "none",
            }}
          />
          {watching ? "live" : "static"}
        </span>
      </div>
      <div
        style={{
          flex: 1,
          overflow: "auto",
          background: "var(--bg-panel)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
          backgroundImage:
            "linear-gradient(45deg, var(--bg) 25%, transparent 25%), linear-gradient(-45deg, var(--bg) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--bg) 75%), linear-gradient(-45deg, transparent 75%, var(--bg) 75%)",
          backgroundSize: "16px 16px",
          backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
        }}
      >
        {error ? (
          <div style={{ color: "#f87171", fontSize: 13 }}>{error}</div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={filePath}
            onLoad={(e) => {
              const img = e.currentTarget;
              setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
            }}
            onError={() => setError("Failed to load image")}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            }}
          />
        )}
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return "";
  const totalSeconds = Math.round(seconds);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function AudioViewer({ filePath, cwd }: { filePath: string; cwd?: string }) {
  const [watching, setWatching] = useState(false);
  const [bust, setBust] = useState(0);
  const [size, setSize] = useState<number | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const ext = getFileName(filePath).toLowerCase().split(".").pop() ?? "";

  useEffect(() => {
    setBust(0);
    setSize(null);
    setDuration(null);
    setError(null);
    setWatching(false);

    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    const encoded = encodeFilePathForApi(filePath);
    const es = new EventSource(`/api/files/${encoded}?type=watch`);
    esRef.current = es;

    es.addEventListener("connected", () => setWatching(true));
    es.addEventListener("change", (e) => {
      try {
        const d = JSON.parse((e as MessageEvent).data) as { size?: number };
        if (typeof d.size === "number") setSize(d.size);
      } catch { /* ignore */ }
      setDuration(null);
      setError(null);
      setBust((b) => b + 1);
    });
    es.addEventListener("error", () => setWatching(false));
    es.onerror = () => setWatching(false);

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [filePath]);

  const encoded = encodeFilePathForApi(filePath);
  const src = `/api/files/${encoded}?type=read${bust ? `&v=${bust}` : ""}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "4px 16px",
          borderBottom: "1px solid var(--border)",
          fontSize: 11,
          color: "var(--text-dim)",
          background: "var(--bg)",
          flexShrink: 0,
        }}
      >
        <span style={{ fontFamily: "var(--font-mono)" }} title={filePath}>
          {getRelativeFilePath(filePath, cwd)}
        </span>
        <span style={{ marginLeft: "auto" }}>{ext || "audio"}</span>
        {duration != null && <span>{formatDuration(duration)}</span>}
        {size != null && <span>{formatSize(size)}</span>}
        <span
          title={watching ? "Live sync active" : "Not watching"}
          style={{ display: "flex", alignItems: "center", gap: 4, color: watching ? "#4ade80" : "var(--text-dim)" }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: watching ? "#4ade80" : "var(--border)",
              display: "inline-block",
              boxShadow: watching ? "0 0 4px #4ade80" : "none",
            }}
          />
          {watching ? "live" : "static"}
        </span>
      </div>
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          background: "var(--bg-panel)",
        }}
      >
        <div style={{ width: "min(680px, 100%)" }}>
          {error && (
            <div style={{ color: "#f87171", fontSize: 13, marginBottom: 12, textAlign: "center" }}>
              {error}
            </div>
          )}
          <audio
            key={src}
            controls
            preload="metadata"
            src={src}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
            onError={() => setError("Failed to load audio")}
            style={{ width: "100%" }}
          />
        </div>
      </div>
    </div>
  );
}

function PdfViewer({ filePath, cwd }: { filePath: string; cwd?: string }) {
  const encoded = encodeFilePathForApi(filePath);
  const src = `/api/files/${encoded}?type=read`;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "4px 16px",
          borderBottom: "1px solid var(--border)",
          fontSize: 11,
          color: "var(--text-dim)",
          background: "var(--bg)",
          flexShrink: 0,
        }}
      >
        <span style={{ fontFamily: "var(--font-mono)" }} title={filePath}>
          {getRelativeFilePath(filePath, cwd)}
        </span>
        <span style={{ marginLeft: "auto" }}>pdf</span>
      </div>
      <iframe
        src={src}
        title={getFileName(filePath)}
        style={{ width: "100%", height: "100%", border: "none", background: "var(--bg-panel)" }}
      />
    </div>
  );
}

export function FileViewer({ filePath, cwd }: Props) {
  if (isImagePath(filePath)) {
    return <ImageViewer filePath={filePath} cwd={cwd} />;
  }
  if (isAudioPath(filePath)) {
    return <AudioViewer filePath={filePath} cwd={cwd} />;
  }
  if (isPdfPath(filePath)) {
    return <PdfViewer filePath={filePath} cwd={cwd} />;
  }
  return <TextFileViewer filePath={filePath} cwd={cwd} />;
}

function WorkbookPreview({ data }: { data: XlsxData }) {
  const [activeSheet, setActiveSheet] = useState(0);
  const sheet = data.sheets[activeSheet] ?? data.sheets[0];

  if (!sheet) {
    return (
      <div style={{ padding: 24, color: "var(--text-dim)", fontSize: 13 }}>
        No sheets found
      </div>
    );
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 12px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-panel)",
          overflowX: "auto",
          flexShrink: 0,
        }}
      >
        {data.sheets.map((item, index) => (
          <button
            key={item.name}
            onClick={() => setActiveSheet(index)}
            style={{
              border: "1px solid var(--border)",
              borderRadius: 6,
              background: index === activeSheet ? "var(--bg-selected)" : "var(--bg)",
              color: index === activeSheet ? "var(--accent)" : "var(--text-muted)",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: index === activeSheet ? 600 : 500,
              padding: "5px 10px",
              whiteSpace: "nowrap",
            }}
          >
            {item.name}
          </button>
        ))}
        <span style={{ marginLeft: "auto", color: "var(--text-dim)", fontSize: 11, whiteSpace: "nowrap" }}>
          {sheet.totalRows} rows × {sheet.totalCols} cols
          {sheet.truncated ? " · preview limited" : ""}
        </span>
      </div>
      <div style={{ flex: 1, overflow: "auto", background: "var(--bg)" }}>
        <table style={{ borderCollapse: "collapse", fontSize: 12, minWidth: "100%" }}>
          <tbody>
            {sheet.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <th
                  style={{
                    position: "sticky",
                    left: 0,
                    zIndex: 1,
                    minWidth: 44,
                    padding: "4px 8px",
                    textAlign: "right",
                    color: "var(--text-dim)",
                    background: "var(--bg-panel)",
                    border: "1px solid var(--border)",
                    fontWeight: 500,
                  }}
                >
                  {rowIndex + 1}
                </th>
                {row.map((cell, colIndex) => (
                  <td
                    key={colIndex}
                    style={{
                      border: "1px solid var(--border)",
                      color: "var(--text)",
                      maxWidth: 260,
                      minWidth: 96,
                      overflow: "hidden",
                      padding: "4px 8px",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={String(cell ?? "")}
                  >
                    {String(cell ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TextFileViewer({ filePath, cwd }: Props) {
  const { isDark } = useTheme();
  const [data, setData] = useState<FileData | DocxData | XlsxData | null>(null);
  const [prevContent, setPrevContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [viewMode, setViewMode] = useState<"source" | "diff">("source");
  const [wrapLines, setWrapLines] = useState(false);
  const [watching, setWatching] = useState(false);
  const [changeCount, setChangeCount] = useState(0);
  const [editorContent, setEditorContent] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "dirty" | "saving" | "saved" | "error" | "conflict">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const dirtyRef = useRef(false);

  const fetchContent = useCallback((filePath: string, isRefresh = false) => {
    const encoded = encodeFilePathForApi(filePath);
    return fetch(`/api/files/${encoded}?type=read`)
      .then((r) => r.json())
      .then((d: (FileData | DocxData | XlsxData) & { error?: string }) => {
        if (d.error) {
          setError(d.error);
          return null;
        }
        const nextData = d as FileData | DocxData | XlsxData;
        if (isRefresh) {
          setData((prev) => {
            if (prev && "content" in prev && "content" in nextData) setPrevContent(prev.content);
            return nextData;
          });
          if ("content" in nextData && !dirtyRef.current) {
            setEditorContent(nextData.content);
            setSaveStatus("idle");
            setSaveError(null);
          }
          setChangeCount((c) => c + 1);
        } else {
          setData(nextData);
          if ("content" in nextData) {
            setEditorContent(nextData.content);
            dirtyRef.current = false;
            setSaveStatus("idle");
            setSaveError(null);
          }
        }
        return nextData;
      })
      .catch((e) => {
        setError(String(e));
        return null;
      });
  }, []);

  // Initial load + SSE watch setup
  useEffect(() => {
    setLoading(true);
    setError(null);
    setData(null);
    setPrevContent(null);
    setPreviewMode(false);
    setViewMode("source");
    setWrapLines(false);
    setChangeCount(0);
    setWatching(false);
    setEditorContent("");
    setSaveStatus("idle");
    setSaveError(null);
    dirtyRef.current = false;

    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    fetchContent(filePath).then((d) => {
      if (d && "language" in d && d.language === "markdown") setPreviewMode(true);
    }).finally(() => setLoading(false));

    // Set up SSE watch
    const encoded = encodeFilePathForApi(filePath);
    const es = new EventSource(`/api/files/${encoded}?type=watch`);
    esRef.current = es;

    es.addEventListener("connected", () => {
      setWatching(true);
    });

    es.addEventListener("change", () => {
      if (dirtyRef.current) {
        setSaveStatus("conflict");
        setSaveError("File changed on disk while you have unsaved edits.");
        return;
      }
      fetchContent(filePath, true);
    });

    es.addEventListener("error", () => {
      setWatching(false);
    });

    es.onerror = () => {
      setWatching(false);
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [filePath, fetchContent]);

  useEffect(() => {
    if (!data || !("content" in data)) return;
    if (!dirtyRef.current || editorContent === data.content) return;
    if (data.truncated || !isEditableTextPath(filePath)) return;

    const timeoutId = setTimeout(async () => {
      setSaveStatus("saving");
      setSaveError(null);
      const encoded = encodeFilePathForApi(filePath);
      try {
        const res = await fetch(`/api/files/${encoded}?type=write`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: editorContent,
            previousModified: data.modified,
          }),
        });
        const saved = await res.json() as { error?: string; modified?: string; size?: number };
        if (!res.ok) {
          setSaveStatus(res.status === 409 ? "conflict" : "error");
          setSaveError(saved.error ?? "Save failed");
          return;
        }
        dirtyRef.current = false;
        setSaveStatus("saved");
        setData((prev) => {
          if (!prev || !("content" in prev)) return prev;
          return {
            ...prev,
            content: editorContent,
            modified: saved.modified ?? prev.modified,
            size: saved.size ?? prev.size,
            truncated: false,
            previewBytes: undefined,
          };
        });
      } catch (e) {
        setSaveStatus("error");
        setSaveError(String(e));
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [data, editorContent, filePath]);

  if (loading) {
    return (
      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 13 }}>
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#f87171", fontSize: 13 }}>
        {error}
      </div>
    );
  }

  if (!data) return null;

  const isTextData = "content" in data;
  const isDocxData = data.kind === "docx";
  const isXlsxData = data.kind === "xlsx";
  const isHtml = isTextData && data.language === "html";
  const isMarkdown = isTextData && data.language === "markdown";
  const displayedContent = isTextData ? editorContent : "";
  const lines = isTextData ? displayedContent.split("\n") : [];
  const hasDiff = isTextData && prevContent !== null && prevContent !== displayedContent;
  const fileTypeLabel = isDocxData ? "docx" : isXlsxData ? "xlsx" : isTextData ? data.language : "file";
  const editable = isTextData && !data.truncated && isEditableTextPath(filePath);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Status bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "4px 16px",
          borderBottom: "1px solid var(--border)",
          fontSize: 11,
          color: "var(--text-dim)",
          background: "var(--bg)",
          flexShrink: 0,
        }}
      >
        <span style={{ fontFamily: "var(--font-mono)" }} title={filePath}>
          {getRelativeFilePath(filePath, cwd)}
        </span>
        <span style={{ marginLeft: "auto" }}>{fileTypeLabel}</span>
        {isTextData && viewMode === "source" && <span>{lines.length} lines</span>}
        <span>{formatSize(data.size)}</span>
        {isTextData && data.truncated && (
          <span style={{ color: "var(--warning)", fontWeight: 600 }}>
            preview first {formatSize(data.previewBytes ?? 0)}
          </span>
        )}
        {editable && (
          <span
            title={saveError ?? undefined}
            style={{
              color: saveStatus === "error" || saveStatus === "conflict" ? "var(--error)" : saveStatus === "dirty" || saveStatus === "saving" ? "var(--warning)" : saveStatus === "saved" ? "var(--success)" : "var(--text-dim)",
              fontWeight: saveStatus === "idle" ? 500 : 700,
            }}
          >
            {saveStatus === "dirty" ? "unsaved" : saveStatus === "saving" ? "saving..." : saveStatus === "saved" ? "saved" : saveStatus === "conflict" ? "conflict" : saveStatus === "error" ? "save failed" : "editable"}
          </span>
        )}

        {/* Live watch indicator */}
        {isTextData && (
          <span
            title={watching ? "Live sync active" : "Not watching"}
            style={{ display: "flex", alignItems: "center", gap: 4, color: watching ? "#4ade80" : "var(--text-dim)" }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: watching ? "#4ade80" : "var(--border)",
                display: "inline-block",
                boxShadow: watching ? "0 0 4px #4ade80" : "none",
              }}
            />
            {watching ? "live" : "static"}
          </span>
        )}

        {/* Diff / Source toggle — shown only when there are changes */}
        {hasDiff && (
          <div style={{ display: "flex", borderRadius: 5, overflow: "hidden", border: "1px solid var(--border)" }}>
            <button
              onClick={() => setViewMode("source")}
              style={{
                padding: "2px 8px", fontSize: 11, border: "none", cursor: "pointer",
                background: viewMode === "source" ? "var(--bg-selected)" : "var(--bg-hover)",
                color: viewMode === "source" ? "var(--text)" : "var(--text-muted)",
                fontWeight: viewMode === "source" ? 600 : 400,
              }}
            >
              Source
            </button>
            <button
              onClick={() => setViewMode("diff")}
              style={{
                padding: "2px 8px", fontSize: 11, border: "none", borderLeft: "1px solid var(--border)", cursor: "pointer",
                background: viewMode === "diff" ? "var(--bg-selected)" : "var(--bg-hover)",
                color: viewMode === "diff" ? "var(--text)" : "var(--text-muted)",
                fontWeight: viewMode === "diff" ? 600 : 400,
              }}
            >
              Diff {changeCount > 0 && <span style={{ color: "#4ade80", marginLeft: 2 }}>+{changeCount}</span>}
            </button>
          </div>
        )}

        {/* Word wrap toggle */}
        {isTextData && viewMode === "source" && !previewMode && (
          <button
            onClick={() => setWrapLines((v) => !v)}
            title={wrapLines ? "Disable word wrap" : "Enable word wrap"}
            style={{
              padding: "2px 8px", fontSize: 11, cursor: "pointer",
              background: wrapLines ? "var(--bg-selected)" : "var(--bg-hover)",
              color: wrapLines ? "var(--text)" : "var(--text-muted)",
              border: "1px solid var(--border)", borderRadius: 5,
              fontWeight: wrapLines ? 600 : 400,
            }}
          >
            wrap
          </button>
        )}

        {/* HTML source/preview toggle */}
        {isHtml && viewMode === "source" && (
          <div style={{ display: "flex", borderRadius: 5, overflow: "hidden", border: "1px solid var(--border)" }}>
            <button
              onClick={() => setPreviewMode(false)}
              style={{
                padding: "2px 8px", fontSize: 11, border: "none", cursor: "pointer",
                background: !previewMode ? "var(--bg-selected)" : "var(--bg-hover)",
                color: !previewMode ? "var(--text)" : "var(--text-muted)",
                fontWeight: !previewMode ? 600 : 400,
              }}
            >
              Code
            </button>
            <button
              onClick={() => setPreviewMode(true)}
              style={{
                padding: "2px 8px", fontSize: 11, border: "none", borderLeft: "1px solid var(--border)", cursor: "pointer",
                background: previewMode ? "var(--bg-selected)" : "var(--bg-hover)",
                color: previewMode ? "var(--text)" : "var(--text-muted)",
                fontWeight: previewMode ? 600 : 400,
              }}
            >
              Preview
            </button>
          </div>
        )}

        {/* Markdown preview/raw toggle */}
        {isMarkdown && viewMode === "source" && (
          <div style={{ display: "flex", borderRadius: 5, overflow: "hidden", border: "1px solid var(--border)" }}>
            <button
              onClick={() => setPreviewMode(true)}
              style={{
                padding: "2px 8px", fontSize: 11, border: "none", cursor: "pointer",
                background: previewMode ? "var(--bg-selected)" : "var(--bg-hover)",
                color: previewMode ? "var(--text)" : "var(--text-muted)",
                fontWeight: previewMode ? 600 : 400,
              }}
            >
              Preview
            </button>
            <button
              onClick={() => setPreviewMode(false)}
              style={{
                padding: "2px 8px", fontSize: 11, border: "none", borderLeft: "1px solid var(--border)", cursor: "pointer",
                background: !previewMode ? "var(--bg-selected)" : "var(--bg-hover)",
                color: !previewMode ? "var(--text)" : "var(--text-muted)",
                fontWeight: !previewMode ? 600 : 400,
              }}
            >
              Raw
            </button>
          </div>
        )}
      </div>

      {/* Content area */}
      <div style={{ flex: 1, overflow: "auto", background: "var(--bg)" }}>
        {isDocxData ? (
          <div
            className="markdown-body docx-file-preview"
            style={{ padding: "24px 32px", maxWidth: 920 }}
            dangerouslySetInnerHTML={{ __html: data.html }}
          />
        ) : isXlsxData ? (
          <WorkbookPreview data={data} />
        ) : viewMode === "diff" && hasDiff ? (
          <DiffView oldContent={prevContent!} newContent={displayedContent} language={data.language} />
        ) : isHtml && previewMode ? (
          <iframe
            srcDoc={displayedContent}
            sandbox="allow-scripts"
            style={{ width: "100%", height: "100%", border: "none", background: "var(--bg)" }}
            title="HTML preview"
          />
        ) : isMarkdown && previewMode ? (
          <div
            className="markdown-body markdown-file-preview"
            style={{ padding: "24px 32px", maxWidth: 800 }}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayedContent}</ReactMarkdown>
          </div>
        ) : editable ? (
          <textarea
            value={editorContent}
            onChange={(event) => {
              dirtyRef.current = true;
              setEditorContent(event.target.value);
              setSaveStatus("dirty");
              setSaveError(null);
            }}
            spellCheck={false}
            wrap={wrapLines ? "soft" : "off"}
            style={{
              width: "100%",
              height: "100%",
              resize: "none",
              border: "none",
              outline: "none",
              background: "var(--bg)",
              color: "var(--text)",
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              lineHeight: 1.6,
              padding: "12px 16px",
              whiteSpace: wrapLines ? "pre-wrap" : "pre",
            }}
          />
        ) : (
          <SyntaxHighlighter
            language={data.language === "text" ? "plaintext" : data.language}
            style={isDark ? vscDarkPlus : vs}
            showLineNumbers
            lineNumberStyle={{
              color: "var(--text-dim)",
              fontStyle: "normal",
              minWidth: "3em",
              paddingRight: "1em",
            }}
            customStyle={{
              margin: 0,
              padding: "12px 0",
              background: "var(--bg)",
              fontSize: 13,
              lineHeight: 1.6,
              fontFamily: "var(--font-mono)",
              minHeight: "100%",
            }}
            codeTagProps={{ style: { fontFamily: "var(--font-mono)" } }}
            wrapLongLines={wrapLines}
          >
            {displayedContent}
          </SyntaxHighlighter>
        )}
      </div>
    </div>
  );
}
