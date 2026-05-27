import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { createRequire } from "module";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { listAllSessions } from "@/lib/session-reader";

const require = createRequire(import.meta.url);
const archiver = require("archiver") as typeof import("archiver");

const IGNORED_NAMES = new Set([
  "node_modules", ".git", ".next", "dist", "build", "__pycache__",
  ".turbo", ".cache", "coverage", ".pytest_cache", ".mypy_cache",
  "target", "vendor", ".DS_Store", ".git",
]);

const IGNORED_SUFFIXES = [".pyc"];

const TEXT_PREVIEW_TRUNCATE_BYTES = 512 * 1024;
const TEXT_WRITE_MAX_BYTES = 2 * 1024 * 1024;
const IMAGE_PREVIEW_MAX_BYTES = 10 * 1024 * 1024;
const XLSX_MAX_ROWS = 500;
const XLSX_MAX_COLS = 50;

const IMAGE_EXT_TO_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  ico: "image/x-icon",
  avif: "image/avif",
};

const AUDIO_EXT_TO_MIME: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/ogg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  flac: "audio/flac",
  weba: "audio/webm",
  webm: "audio/webm",
};

const DOCUMENT_EXT_TO_MIME: Record<string, string> = {
  pdf: "application/pdf",
};

function getExt(filePath: string): string {
  const ext = path.basename(filePath).toLowerCase().split(".").pop() ?? "";
  return ext;
}

function getImageMime(filePath: string): string | null {
  return IMAGE_EXT_TO_MIME[getExt(filePath)] ?? null;
}

function getAudioMime(filePath: string): string | null {
  return AUDIO_EXT_TO_MIME[getExt(filePath)] ?? null;
}

function getDocumentMime(filePath: string): string | null {
  return DOCUMENT_EXT_TO_MIME[getExt(filePath)] ?? null;
}

function isValidChildName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length > 0 && !trimmed.includes("/") && !trimmed.includes("\\") && !trimmed.includes("\0") && trimmed !== "." && trimmed !== "..";
}

function contentDispositionName(filePath: string): string {
  return encodeURIComponent(path.basename(filePath)).replace(/['()]/g, escape);
}

const EXT_TO_LANGUAGE: Record<string, string> = {
  ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
  mjs: "javascript", cjs: "javascript", py: "python", rb: "ruby",
  go: "go", rs: "rust", java: "java", kt: "kotlin", swift: "swift",
  c: "c", cpp: "cpp", h: "c", hpp: "cpp", cs: "csharp",
  html: "html", htm: "html", css: "css", scss: "css", less: "css",
  json: "json", jsonl: "json", yaml: "yaml", yml: "yaml",
  toml: "toml", xml: "xml", md: "markdown", mdx: "markdown",
  sh: "bash", bash: "bash", zsh: "bash", fish: "bash",
  sql: "sql", graphql: "graphql", gql: "graphql",
  dockerfile: "dockerfile", tf: "hcl", hcl: "hcl",
  env: "bash", gitignore: "bash", txt: "text",
};

const EDITABLE_TEXT_EXTS = new Set([
  "txt", "md", "mdx", "json", "jsonl", "yaml", "yml", "toml", "xml",
  "csv", "html", "htm", "css", "scss", "less", "js", "jsx", "ts", "tsx",
  "mjs", "cjs", "py", "rb", "go", "rs", "java", "kt", "swift", "c", "cpp",
  "h", "hpp", "cs", "sh", "bash", "zsh", "fish", "sql", "graphql", "gql",
  "env", "gitignore",
]);

function getLanguage(filePath: string): string {
  const base = path.basename(filePath).toLowerCase();
  // Special full-name matches
  if (base === "dockerfile" || base.startsWith("dockerfile.")) return "dockerfile";
  if (base === ".env" || base.startsWith(".env.")) return "bash";
  if (base === "makefile" || base === "gnumakefile") return "makefile";
  const ext = base.split(".").pop() ?? "";
  return EXT_TO_LANGUAGE[ext] ?? "text";
}

function isEditableTextPath(filePath: string): boolean {
  const base = path.basename(filePath).toLowerCase();
  if (base === "dockerfile" || base.startsWith("dockerfile.")) return true;
  if (base === "makefile" || base === "gnumakefile") return true;
  if (base === ".env" || base.startsWith(".env.")) return true;
  if (base === ".gitignore") return true;
  const ext = base.split(".").pop() ?? "";
  return EDITABLE_TEXT_EXTS.has(ext);
}

async function readDocxPreview(filePath: string, stat: fs.Stats) {
  const result = await mammoth.convertToHtml({ path: filePath });
  return NextResponse.json({
    kind: "docx",
    html: result.value,
    messages: result.messages.map((message) => ({
      type: message.type,
      message: message.message,
    })),
    size: stat.size,
  });
}

function readXlsxPreview(filePath: string, stat: fs.Stats) {
  const workbook = XLSX.read(fs.readFileSync(filePath), { cellDates: true, dense: true, type: "buffer" });
  const sheets = workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1:A1");
    const rows = Math.min(range.e.r - range.s.r + 1, XLSX_MAX_ROWS);
    const cols = Math.min(range.e.c - range.s.c + 1, XLSX_MAX_COLS);
    const values = XLSX.utils.sheet_to_json<(string | number | boolean | Date | null)[]>(sheet, {
      header: 1,
      raw: false,
      blankrows: true,
      defval: "",
      range: {
        s: range.s,
        e: {
          r: range.s.r + rows - 1,
          c: range.s.c + cols - 1,
        },
      },
    });
    return {
      name,
      rows: values,
      totalRows: range.e.r - range.s.r + 1,
      totalCols: range.e.c - range.s.c + 1,
      truncated: range.e.r - range.s.r + 1 > XLSX_MAX_ROWS || range.e.c - range.s.c + 1 > XLSX_MAX_COLS,
    };
  });

  return NextResponse.json({
    kind: "xlsx",
    sheets,
    size: stat.size,
  });
}

function readTextPreview(filePath: string, stat: fs.Stats) {
  const limit = Math.min(stat.size, TEXT_PREVIEW_TRUNCATE_BYTES);
  const fd = fs.openSync(filePath, "r");
  try {
    const buffer = Buffer.alloc(limit);
    const bytesRead = fs.readSync(fd, buffer, 0, limit, 0);
    const content = buffer.subarray(0, bytesRead).toString("utf-8");
    const language = getLanguage(filePath);
    return NextResponse.json({
      kind: "text",
      content,
      language,
      size: stat.size,
      modified: stat.mtime.toISOString(),
      truncated: stat.size > TEXT_PREVIEW_TRUNCATE_BYTES,
      previewBytes: bytesRead,
    });
  } finally {
    fs.closeSync(fd);
  }
}

// Short-TTL cache for the allowed-roots set. Without this, every file list/read
// request re-scans every pi session on disk just to check access. 5s is short
// enough that newly-created cwds appear promptly; stored on globalThis so it
// survives Next.js hot-reload.
declare global {
  var __piAllowedRootsCache: { roots: Set<string>; expiresAt: number } | undefined;
}

const ALLOWED_ROOTS_TTL_MS = 5_000;
const WINDOWS_ABSOLUTE_RE = /^[a-zA-Z]:[\\/]/;

function normalizeSlashes(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function isWindowsAbsolutePath(filePath: string): boolean {
  return WINDOWS_ABSOLUTE_RE.test(filePath) || filePath.startsWith("\\\\") || filePath.startsWith("//");
}

function filePathFromSegments(segments: string[]): string {
  const joined = segments.join("/");
  const slashJoined = normalizeSlashes(joined);
  if (isWindowsAbsolutePath(slashJoined)) return slashJoined;
  return "/" + joined.replace(/^\/+/, "");
}

async function getAllowedRoots(): Promise<Set<string>> {
  const now = Date.now();
  const cached = globalThis.__piAllowedRootsCache;
  if (cached && cached.expiresAt > now) return cached.roots;

  const sessions = await listAllSessions();
  const roots = new Set<string>();
  for (const s of sessions) {
    if (s.cwd) roots.add(s.cwd);
  }
  // Also allow ~/pi-cwd-* directories created by the default-cwd endpoint
  const home = (await import("os")).homedir();
  const { readdirSync } = await import("fs");
  try {
    for (const name of readdirSync(home)) {
      if (/^pi-cwd-\d{8}$/.test(name)) {
        roots.add(path.join(home, name));
      }
    }
  } catch {
    // ignore if home is unreadable
  }

  globalThis.__piAllowedRootsCache = { roots, expiresAt: now + ALLOWED_ROOTS_TTL_MS };
  return roots;
}

function isPathAllowed(target: string, allowedRoots: Set<string>): boolean {
  for (const root of allowedRoots) {
    const useWindowsRules = isWindowsAbsolutePath(target) || isWindowsAbsolutePath(root);
    const resolver = useWindowsRules ? path.win32 : path;
    const sep = useWindowsRules ? "\\" : path.sep;
    const normalized = resolver.resolve(target);
    const normalizedRoot = resolver.resolve(root);
    const comparable = useWindowsRules ? normalized.toLowerCase() : normalized;
    const comparableRoot = useWindowsRules ? normalizedRoot.toLowerCase() : normalizedRoot;
    const rootWithSep = comparableRoot.endsWith(sep) ? comparableRoot : comparableRoot + sep;
    if (comparable === comparableRoot || comparable.startsWith(rootWithSep)) {
      return true;
    }
  }
  return false;
}

function createFileBodyStream(filePath: string, range?: { start: number; end: number }): ReadableStream<Uint8Array> {
  const fileStream = fs.createReadStream(filePath, range);
  let closed = false;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      fileStream.on("data", (chunk: Buffer) => {
        if (closed) return;
        try {
          controller.enqueue(new Uint8Array(chunk));
        } catch {
          closed = true;
          fileStream.destroy();
        }
      });
      fileStream.once("end", () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // The browser may cancel media probes before the file stream ends.
        }
      });
      fileStream.once("error", (error) => {
        if (closed) return;
        closed = true;
        try {
          controller.error(error);
        } catch {
          // The response was already abandoned by the client.
        }
      });
    },
    cancel() {
      closed = true;
      fileStream.destroy();
    },
  });
}

function streamFile(filePath: string, stat: fs.Stats, contentType: string, rangeHeader: string | null, extraHeaders: Record<string, string> = {}): Response {
  const headers = {
    "Content-Type": contentType,
    "Cache-Control": "no-cache",
    "Accept-Ranges": "bytes",
    ...extraHeaders,
  };

  if (!rangeHeader) {
    return new Response(createFileBodyStream(filePath), {
      headers: {
        ...headers,
        "Content-Length": String(stat.size),
      },
    });
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
  if (!match) {
    return new Response(null, {
      status: 416,
      headers: {
        ...headers,
        "Content-Range": `bytes */${stat.size}`,
      },
    });
  }

  let start = match[1] ? Number(match[1]) : 0;
  let end = match[2] ? Number(match[2]) : stat.size - 1;
  if (!match[1] && match[2]) {
    const suffixLength = Number(match[2]);
    start = Math.max(stat.size - suffixLength, 0);
    end = stat.size - 1;
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || start >= stat.size) {
    return new Response(null, {
      status: 416,
      headers: {
        ...headers,
        "Content-Range": `bytes */${stat.size}`,
      },
    });
  }

  end = Math.min(end, stat.size - 1);
  const chunkSize = end - start + 1;
  return new Response(createFileBodyStream(filePath, { start, end }), {
    status: 206,
    headers: {
      ...headers,
      "Content-Length": String(chunkSize),
      "Content-Range": `bytes ${start}-${end}/${stat.size}`,
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: segments } = await params;
    const filePath = filePathFromSegments(segments);
    const type = request.nextUrl.searchParams.get("type") ?? "list";

    const allowedRoots = await getAllowedRoots();
    if (!isPathAllowed(filePath, allowedRoots)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    let stat: fs.Stats;
    try {
      stat = fs.statSync(filePath);
    } catch {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (type === "read") {
      if (!stat.isFile()) {
        return NextResponse.json({ error: "Not a file" }, { status: 400 });
      }
      const imageMime = getImageMime(filePath);
      if (imageMime) {
        if (stat.size > IMAGE_PREVIEW_MAX_BYTES) {
          return NextResponse.json({ error: "Image too large (>10MB)" }, { status: 413 });
        }
        return streamFile(filePath, stat, imageMime, request.headers.get("range"));
      }
      const audioMime = getAudioMime(filePath);
      if (audioMime) {
        return streamFile(filePath, stat, audioMime, request.headers.get("range"));
      }
      const documentMime = getDocumentMime(filePath);
      if (documentMime) {
        return streamFile(filePath, stat, documentMime, request.headers.get("range"));
      }
      const ext = getExt(filePath);
      if (ext === "docx") {
        return readDocxPreview(filePath, stat);
      }
      if (ext === "xlsx" || ext === "xls") {
        return readXlsxPreview(filePath, stat);
      }
      return readTextPreview(filePath, stat);
    }

    if (type === "download") {
      if (!stat.isFile()) {
        return NextResponse.json({ error: "Not a file" }, { status: 400 });
      }
      return streamFile(filePath, stat, "application/octet-stream", request.headers.get("range"), {
        "Content-Disposition": `attachment; filename*=UTF-8''${contentDispositionName(filePath)}`,
      });
    }

    if (type === "download-zip") {
      if (!stat.isDirectory()) {
        return NextResponse.json({ error: "Not a directory" }, { status: 400 });
      }
      const archive = archiver("zip", { zlib: { level: 9 } });
      archive.directory(filePath, false);
      archive.finalize();
      return new Response(Readable.toWeb(archive) as ReadableStream<Uint8Array>, {
        headers: {
          "Content-Type": "application/zip",
          "Cache-Control": "no-cache",
          "Content-Disposition": `attachment; filename*=UTF-8''${contentDispositionName(filePath)}.zip`,
        },
      });
    }

    if (type === "watch") {
      if (!stat.isFile()) {
        return NextResponse.json({ error: "Not a file" }, { status: 400 });
      }
      let watcher: fs.FSWatcher | null = null;
      const stream = new ReadableStream({
        start(controller) {
          const send = (eventName: string, data: Record<string, unknown>) => {
            const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
            try {
              controller.enqueue(new TextEncoder().encode(payload));
            } catch {
              // client disconnected
            }
          };
          // Send initial ping so client knows connection is live
          send("connected", { filePath });
          try {
            watcher = fs.watch(filePath, () => {
              try {
                const s = fs.statSync(filePath);
                send("change", { mtime: s.mtime.toISOString(), size: s.size });
              } catch {
                send("change", { mtime: new Date().toISOString(), size: 0 });
              }
            });
            watcher.on("error", () => {
              try { controller.close(); } catch { /* ignore */ }
            });
          } catch {
            send("error", { message: "Failed to watch file" });
            controller.close();
          }
        },
        cancel() {
          try { watcher?.close(); } catch { /* ignore */ }
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    }

    // type === "list"
    if (!stat.isDirectory()) {
      return NextResponse.json({ error: "Not a directory" }, { status: 400 });
    }

    const names = fs.readdirSync(filePath);
    const entries = names
      .filter((name) => !IGNORED_NAMES.has(name) && !IGNORED_SUFFIXES.some((s) => name.endsWith(s)))
      .map((name) => {
        const full = path.join(filePath, name);
        try {
          const s = fs.statSync(full);
          return {
            name,
            isDir: s.isDirectory(),
            size: s.isFile() ? s.size : 0,
            modified: s.mtime.toISOString(),
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => {
        // Dirs first, then files, both alphabetically
        if (a!.isDir !== b!.isDir) return a!.isDir ? -1 : 1;
        return a!.name.localeCompare(b!.name);
      });

    return NextResponse.json({ entries, path: filePath });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: segments } = await params;
    const dirPath = filePathFromSegments(segments);
    const type = request.nextUrl.searchParams.get("type");

    const allowedRoots = await getAllowedRoots();
    if (!isPathAllowed(dirPath, allowedRoots)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
      return NextResponse.json({ error: "Target is not a directory" }, { status: 400 });
    }

    if (type === "mkdir" || type === "touch") {
      const body = await request.json() as { name?: string; overwrite?: boolean };
      const name = body.name ?? "";
      if (!isValidChildName(name)) {
        return NextResponse.json({ error: "Invalid name" }, { status: 400 });
      }
      const target = path.join(dirPath, name);
      if (!isPathAllowed(target, allowedRoots)) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
      if (fs.existsSync(target) && !body.overwrite) {
        return NextResponse.json({ error: "Already exists", conflict: true }, { status: 409 });
      }
      if (type === "mkdir") {
        fs.mkdirSync(target, { recursive: false });
      } else {
        fs.closeSync(fs.openSync(target, body.overwrite ? "w" : "wx"));
      }
      return NextResponse.json({ ok: true, path: target });
    }

    if (type === "upload") {
      const form = await request.formData();
      const overwrite = form.get("overwrite") === "true";
      const files = form.getAll("files").filter((item): item is File => item instanceof File);
      const conflicts: string[] = [];
      const uploaded: string[] = [];

      for (const file of files) {
        if (!isValidChildName(file.name)) {
          return NextResponse.json({ error: `Invalid file name: ${file.name}` }, { status: 400 });
        }
        const target = path.join(dirPath, file.name);
        if (!isPathAllowed(target, allowedRoots)) {
          return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }
        if (fs.existsSync(target) && !overwrite) {
          conflicts.push(file.name);
          continue;
        }
        const buffer = Buffer.from(await file.arrayBuffer());
        fs.writeFileSync(target, buffer, { flag: overwrite ? "w" : "wx" });
        uploaded.push(target);
      }

      if (conflicts.length > 0) {
        return NextResponse.json({ error: "Conflicts", conflict: true, conflicts, uploaded }, { status: 409 });
      }
      return NextResponse.json({ ok: true, uploaded });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: segments } = await params;
    const filePath = filePathFromSegments(segments);
    const allowedRoots = await getAllowedRoots();
    if (!isPathAllowed(filePath, allowedRoots)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json() as { name?: string; overwrite?: boolean };
    const name = body.name ?? "";
    if (!isValidChildName(name)) {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }
    const target = path.join(path.dirname(filePath), name);
    if (!isPathAllowed(target, allowedRoots)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    if (fs.existsSync(target) && !body.overwrite) {
      return NextResponse.json({ error: "Already exists", conflict: true }, { status: 409 });
    }
    fs.renameSync(filePath, target);
    return NextResponse.json({ ok: true, path: target });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: segments } = await params;
    const filePath = filePathFromSegments(segments);
    const allowedRoots = await getAllowedRoots();
    if (!isPathAllowed(filePath, allowedRoots)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    fs.rmSync(filePath, { recursive: true, force: false });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: segments } = await params;
    const filePath = filePathFromSegments(segments);
    const allowedRoots = await getAllowedRoots();
    if (!isPathAllowed(filePath, allowedRoots)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      return NextResponse.json({ error: "Not a file" }, { status: 404 });
    }
    if (!isEditableTextPath(filePath)) {
      return NextResponse.json({ error: "This file type is read-only" }, { status: 415 });
    }

    const before = fs.statSync(filePath);
    const body = await request.json() as { content?: string; previousModified?: string };
    const content = body.content ?? "";
    if (Buffer.byteLength(content, "utf-8") > TEXT_WRITE_MAX_BYTES) {
      return NextResponse.json({ error: "File is too large to save (>2MB)" }, { status: 413 });
    }
    if (body.previousModified && body.previousModified !== before.mtime.toISOString()) {
      return NextResponse.json({
        error: "File changed on disk",
        conflict: true,
        modified: before.mtime.toISOString(),
      }, { status: 409 });
    }

    fs.writeFileSync(filePath, content, "utf-8");
    const after = fs.statSync(filePath);
    return NextResponse.json({
      ok: true,
      size: after.size,
      modified: after.mtime.toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
