"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { FormEvent, KeyboardEvent, MouseEvent, ReactNode } from "react";
import { getFileIcon, FolderIcon } from "./FileIcons";
import { encodeFilePathForApi, getRelativeFilePath, joinFilePath } from "@/lib/file-paths";

interface FileEntry {
  name: string;
  isDir: boolean;
  size: number;
  modified: string;
}

interface FileNode {
  name: string;
  fullPath: string;
  isDir: boolean;
  size: number;
  children?: FileNode[];
  loaded?: boolean;
}

interface Props {
  cwd: string;
  onOpenFile: (filePath: string, fileName: string) => void;
  refreshKey?: number;
  onAtMention?: (relativePath: string) => void;
}

const AUTO_REFRESH_INTERVAL_MS = 1000;

interface FileMenuState {
  x: number;
  y: number;
  node: FileNode;
}

interface PendingCreateState {
  parentPath: string;
  type: "mkdir" | "touch";
}

interface DeleteState {
  node: FileNode;
  error?: string;
  deleting?: boolean;
}

async function fetchEntries(dirPath: string): Promise<FileNode[]> {
  const encoded = encodeFilePathForApi(dirPath);
  const res = await fetch(`/api/files/${encoded}?type=list`);
  if (!res.ok) return [];
  const data = await res.json() as { entries?: FileEntry[] };
  return (data.entries ?? []).map((e) => ({
    name: e.name,
    fullPath: joinFilePath(dirPath, e.name),
    isDir: e.isDir,
    size: e.size,
    children: e.isDir ? [] : undefined,
    loaded: !e.isDir,
  }));
}

async function runJsonAction(url: string, init: RequestInit) {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({})) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request failed: ${res.status}`);
  return data;
}

function downloadPath(filePath: string, isDir: boolean) {
  const encoded = encodeFilePathForApi(filePath);
  window.location.href = `/api/files/${encoded}?type=${isDir ? "download-zip" : "download"}`;
}

function defaultCreateName(type: "mkdir" | "touch") {
  return type === "mkdir" ? "untitled" : "untitled.md";
}

function getRenameSelection(name: string, isDir: boolean) {
  if (isDir) return { start: 0, end: name.length };
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return { start: 0, end: name.length };
  return { start: 0, end: dot };
}

function InlineNameInput({
  depth,
  icon,
  initialValue,
  placeholder,
  autoSelectNameOnly,
  onCancel,
  onSubmit,
}: {
  depth: number;
  icon: ReactNode;
  initialValue: string;
  placeholder: string;
  autoSelectNameOnly?: { isDir: boolean };
  onCancel: () => void;
  onSubmit: (name: string) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    if (autoSelectNameOnly) {
      const selection = getRenameSelection(initialValue, autoSelectNameOnly.isDir);
      input.setSelectionRange(selection.start, selection.end);
    } else {
      input.select();
    }
  }, [autoSelectNameOnly, initialValue]);

  const submit = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit(trimmed);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }, [name, onSubmit]);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void submit();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  }, [onCancel, submit]);

  const handleSubmit = useCallback((event: FormEvent) => {
    event.preventDefault();
    void submit();
  }, [submit]);

  return (
    <form onSubmit={handleSubmit} style={{ paddingLeft: 8 + depth * 14, paddingRight: 8, margin: "1px 0 3px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          height: 26,
          borderRadius: 5,
          background: "var(--bg-hover)",
          border: `1px solid ${error ? "#ef4444" : "var(--accent)"}`,
          padding: "0 6px",
        }}
      >
        <span style={{ width: 10, flexShrink: 0 }} />
        <span style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>{icon}</span>
        <input
          ref={inputRef}
          value={name}
          placeholder={placeholder}
          disabled={saving}
          onChange={(event) => {
            setName(event.target.value);
            if (error) setError(null);
          }}
          onKeyDown={handleKeyDown}
          style={{
            minWidth: 0,
            flex: 1,
            border: "none",
            outline: "none",
            background: "transparent",
            color: "var(--text)",
            fontSize: 12,
            height: 22,
          }}
        />
        {saving && <span style={{ fontSize: 11, color: "var(--text-dim)" }}>Saving</span>}
      </div>
      {error && (
        <div style={{ paddingLeft: 28, paddingTop: 3, color: "#ef4444", fontSize: 11 }}>
          {error}
        </div>
      )}
    </form>
  );
}

function TreeNode({
  node,
  depth,
  cwd,
  onOpenFile,
  onAtMention,
  expandedPaths,
  onToggleExpanded,
  refreshKey,
  onContextMenu,
  pendingCreate,
  editingPath,
  onCancelInline,
  onSubmitCreate,
  onSubmitRename,
}: {
  node: FileNode;
  depth: number;
  cwd: string;
  onOpenFile: (filePath: string, fileName: string) => void;
  onAtMention?: (relativePath: string) => void;
  expandedPaths: Set<string>;
  onToggleExpanded: (fullPath: string, open: boolean) => void;
  refreshKey?: number | string;
  onContextMenu: (event: MouseEvent, node: FileNode) => void;
  pendingCreate: PendingCreateState | null;
  editingPath: string | null;
  onCancelInline: () => void;
  onSubmitCreate: (parentPath: string, type: "mkdir" | "touch", name: string) => Promise<void>;
  onSubmitRename: (node: FileNode, name: string) => Promise<void>;
}) {
  const open = expandedPaths.has(node.fullPath);
  const [children, setChildren] = useState<FileNode[]>(node.children ?? []);
  const [loaded, setLoaded] = useState(node.loaded ?? false);
  const [loading, setLoading] = useState(false);
  const [hovered, setHovered] = useState(false);

  const loadChildren = useCallback(async (force = false, showLoading = true) => {
    if (loaded && !force) return;
    if (showLoading) setLoading(true);
    try {
      const entries = await fetchEntries(node.fullPath);
      setChildren(entries);
      setLoaded(true);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [loaded, node.fullPath]);

  // When refreshKey causes a re-render with the same node identity, reload open dirs
  const prevLoadedRef = useRef(loaded);
  useEffect(() => {
    prevLoadedRef.current = loaded;
  });

  // Re-fetch children when refreshKey changes and the directory is already open/loaded
  useEffect(() => {
    if (open && loaded) {
      loadChildren(true, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const handleClick = useCallback(() => {
    if (editingPath === node.fullPath) return;
    if (node.isDir) {
      const next = !open;
      onToggleExpanded(node.fullPath, next);
      if (next && !loaded) loadChildren();
    } else {
      onOpenFile(node.fullPath, node.name);
    }
  }, [editingPath, node.isDir, node.fullPath, node.name, loaded, open, loadChildren, onOpenFile, onToggleExpanded]);

  const showInlineCreate = node.isDir && open && pendingCreate?.parentPath === node.fullPath;
  const isRenaming = editingPath === node.fullPath;

  return (
    <div>
      {isRenaming ? (
        <InlineNameInput
          depth={depth}
          icon={node.isDir ? <FolderIcon size={14} open={open} /> : getFileIcon(node.name, 14)}
          initialValue={node.name}
          placeholder="Name"
          autoSelectNameOnly={{ isDir: node.isDir }}
          onCancel={onCancelInline}
          onSubmit={(name) => onSubmitRename(node, name)}
        />
      ) : (
        <div
          onClick={handleClick}
          onContextMenu={(event) => onContextMenu(event, node)}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: 4,
            paddingLeft: 8 + depth * 14,
            paddingRight: 8,
            height: 24,
            cursor: "pointer",
            background: hovered ? "var(--bg-hover)" : "transparent",
            borderRadius: 4,
            userSelect: "none",
          }}
        >
          {node.isDir && (
            <svg
              width="10" height="10" viewBox="0 0 10 10" fill="none"
              stroke="var(--text-dim)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
              style={{ flexShrink: 0, transform: open ? "rotate(90deg)" : "none", transition: "transform 0.1s" }}
            >
              <polyline points="3 2 7 5 3 8" />
            </svg>
          )}
          {!node.isDir && <span style={{ width: 10, flexShrink: 0 }} />}
          <span style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
            {node.isDir ? <FolderIcon size={14} open={open} /> : getFileIcon(node.name, 14)}
          </span>
          <span
            style={{
              fontSize: 12,
              color: "var(--text)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
            }}
            title={node.fullPath}
          >
            {node.name}
          </span>
          {loading && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2" strokeLinecap="round">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" />
            </svg>
          )}
          {onAtMention && hovered && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAtMention(getRelativeFilePath(node.fullPath, cwd));
              }}
              title="Insert path into chat"
              style={{
                position: "absolute",
                right: 4,
                top: "50%",
                transform: "translateY(-50%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                padding: "0 8px",
                height: 20,
                background: "var(--bg-panel)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                color: "var(--accent)",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4" />
                <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" />
              </svg>
              mention
            </button>
          )}
        </div>
      )}
      {node.isDir && open && (
        <div>
          {showInlineCreate && (
            <InlineNameInput
              depth={depth + 1}
              icon={pendingCreate.type === "mkdir" ? <FolderIcon size={14} /> : getFileIcon(defaultCreateName(pendingCreate.type), 14)}
              initialValue={defaultCreateName(pendingCreate.type)}
              placeholder={pendingCreate.type === "mkdir" ? "Folder name" : "File name"}
              onCancel={onCancelInline}
              onSubmit={(name) => onSubmitCreate(node.fullPath, pendingCreate.type, name)}
            />
          )}
          {children.map((child) => (
            <TreeNode key={child.fullPath} node={child} depth={depth + 1} cwd={cwd} onOpenFile={onOpenFile} onAtMention={onAtMention} expandedPaths={expandedPaths} onToggleExpanded={onToggleExpanded} refreshKey={refreshKey} onContextMenu={onContextMenu} pendingCreate={pendingCreate} editingPath={editingPath} onCancelInline={onCancelInline} onSubmitCreate={onSubmitCreate} onSubmitRename={onSubmitRename} />
          ))}
          {children.length === 0 && loaded && !showInlineCreate && (
            <div style={{ paddingLeft: 8 + (depth + 1) * 14, fontSize: 11, color: "var(--text-dim)", height: 22, display: "flex", alignItems: "center" }}>
              empty
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function FileExplorer({ cwd, onOpenFile, refreshKey, onAtMention }: Props) {
  const [roots, setRoots] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [autoRefreshKey, setAutoRefreshKey] = useState(0);
  const [menu, setMenu] = useState<FileMenuState | null>(null);
  const [pendingCreate, setPendingCreate] = useState<PendingCreateState | null>(null);
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [deleteState, setDeleteState] = useState<DeleteState | null>(null);
  const prevCwdRef = useRef<string | null>(null);
  const effectiveRefreshKey = `${refreshKey ?? 0}:${autoRefreshKey}`;
  const bumpRefresh = useCallback(() => setAutoRefreshKey((key) => key + 1), []);

  const handleToggleExpanded = useCallback((fullPath: string, open: boolean) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (open) next.add(fullPath); else next.delete(fullPath);
      return next;
    });
  }, []);

  const startCreate = useCallback((parentPath: string, type: "mkdir" | "touch") => {
    setMenu(null);
    setEditingPath(null);
    setPendingCreate({ parentPath, type });
    if (parentPath !== cwd) handleToggleExpanded(parentPath, true);
  }, [cwd, handleToggleExpanded]);

  const cancelInline = useCallback(() => {
    setPendingCreate(null);
    setEditingPath(null);
  }, []);

  const submitCreate = useCallback(async (dirPath: string, type: "mkdir" | "touch", name: string) => {
    const encoded = encodeFilePathForApi(dirPath);
    const data = await runJsonAction(`/api/files/${encoded}?type=${type}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }) as { path?: string };
    const createdPath = data.path ?? joinFilePath(dirPath, name);
    setPendingCreate(null);
    if (type === "mkdir") {
      handleToggleExpanded(createdPath, true);
    } else {
      onOpenFile(createdPath, name);
    }
    bumpRefresh();
  }, [bumpRefresh, handleToggleExpanded, onOpenFile]);

  const submitRename = useCallback(async (node: FileNode, name: string) => {
    if (name === node.name) {
      setEditingPath(null);
      return;
    }
    const encoded = encodeFilePathForApi(node.fullPath);
    await runJsonAction(`/api/files/${encoded}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setEditingPath(null);
    bumpRefresh();
  }, [bumpRefresh]);

  const uploadInto = useCallback((dirPath: string) => {
    setMenu(null);
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.onchange = async () => {
      const files = Array.from(input.files ?? []);
      if (files.length === 0) return;
      const form = new FormData();
      for (const file of files) form.append("files", file);
      form.append("overwrite", "false");
      try {
        const encoded = encodeFilePathForApi(dirPath);
        await runJsonAction(`/api/files/${encoded}?type=upload`, { method: "POST", body: form });
        bumpRefresh();
      } catch (e) {
        window.alert(String(e));
      }
    };
    input.click();
  }, [bumpRefresh]);

  const startRename = useCallback((node: FileNode) => {
    setMenu(null);
    setPendingCreate(null);
    setEditingPath(node.fullPath);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteState) return;
    setDeleteState({ ...deleteState, deleting: true, error: undefined });
    try {
      const encoded = encodeFilePathForApi(deleteState.node.fullPath);
      await runJsonAction(`/api/files/${encoded}`, { method: "DELETE" });
      setDeleteState(null);
      bumpRefresh();
    } catch (e) {
      setDeleteState({
        ...deleteState,
        deleting: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }, [bumpRefresh, deleteState]);

  const handleContextMenu = useCallback((event: MouseEvent, node: FileNode) => {
    event.preventDefault();
    setMenu({ x: event.clientX, y: event.clientY, node });
  }, []);

  useEffect(() => {
    const close = () => setMenu(null);
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setMenu(null);
    };
    window.addEventListener("click", close);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  useEffect(() => {
    const cwdChanged = prevCwdRef.current !== cwd;
    prevCwdRef.current = cwd;

    // Reset expanded state only when cwd changes, not on refreshKey bumps
    if (cwdChanged) setExpandedPaths(new Set());

    setLoading(cwdChanged);
    setError(null);
    fetchEntries(cwd)
      .then((entries) => setRoots(entries))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [cwd, effectiveRefreshKey]);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const syncPolling = () => {
      if (document.hidden) {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
        return;
      }
      if (!intervalId) {
        intervalId = setInterval(() => {
          setAutoRefreshKey((key) => key + 1);
        }, AUTO_REFRESH_INTERVAL_MS);
      }
    };

    syncPolling();
    document.addEventListener("visibilitychange", syncPolling);

    return () => {
      document.removeEventListener("visibilitychange", syncPolling);
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  if (loading) {
    return (
      <div style={{ padding: "8px 12px", fontSize: 11, color: "var(--text-dim)" }}>
        Loading files...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "8px 12px", fontSize: 11, color: "#f87171" }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ padding: "2px 4px", position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 4px 6px" }}>
        <ToolbarButton onClick={() => startCreate(cwd, "touch")} title="New file">
          <FilePlusIcon />
        </ToolbarButton>
        <ToolbarButton onClick={() => startCreate(cwd, "mkdir")} title="New folder">
          <FolderPlusIcon />
        </ToolbarButton>
        <ToolbarButton onClick={() => uploadInto(cwd)} title="Upload files">
          <UploadIcon />
        </ToolbarButton>
        <ToolbarButton onClick={bumpRefresh} title="Refresh">
          <RefreshIcon />
        </ToolbarButton>
      </div>
      {pendingCreate?.parentPath === cwd && (
        <InlineNameInput
          depth={0}
          icon={pendingCreate.type === "mkdir" ? <FolderIcon size={14} /> : getFileIcon(defaultCreateName(pendingCreate.type), 14)}
          initialValue={defaultCreateName(pendingCreate.type)}
          placeholder={pendingCreate.type === "mkdir" ? "Folder name" : "File name"}
          onCancel={cancelInline}
          onSubmit={(name) => submitCreate(cwd, pendingCreate.type, name)}
        />
      )}
      {roots.map((node) => (
        <TreeNode
          key={node.fullPath}
          node={node}
          depth={0}
          cwd={cwd}
          onOpenFile={onOpenFile}
          onAtMention={onAtMention}
          expandedPaths={expandedPaths}
          onToggleExpanded={handleToggleExpanded}
          refreshKey={effectiveRefreshKey}
          onContextMenu={handleContextMenu}
          pendingCreate={pendingCreate}
          editingPath={editingPath}
          onCancelInline={cancelInline}
          onSubmitCreate={submitCreate}
          onSubmitRename={submitRename}
        />
      ))}
      {roots.length === 0 && (
        <div style={{ padding: "8px 12px", fontSize: 11, color: "var(--text-dim)" }}>
          No files found
        </div>
      )}
      {menu && (
        <div
          onClick={(event) => event.stopPropagation()}
          style={{
            position: "fixed",
            left: menu.x,
            top: menu.y,
            zIndex: 1000,
            minWidth: 170,
            padding: 4,
            background: "var(--bg-panel)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
          }}
        >
          {menu.node.isDir && (
            <>
              <MenuButton onClick={() => startCreate(menu.node.fullPath, "touch")}>New File</MenuButton>
              <MenuButton onClick={() => startCreate(menu.node.fullPath, "mkdir")}>New Folder</MenuButton>
              <MenuButton onClick={() => uploadInto(menu.node.fullPath)}>Upload Here</MenuButton>
              <MenuDivider />
            </>
          )}
          <MenuButton onClick={() => startRename(menu.node)}>Rename</MenuButton>
          <MenuButton onClick={() => { navigator.clipboard?.writeText(getRelativeFilePath(menu.node.fullPath, cwd)); setMenu(null); }}>Copy Path</MenuButton>
          <MenuButton onClick={() => { downloadPath(menu.node.fullPath, menu.node.isDir); setMenu(null); }}>Download</MenuButton>
          <MenuDivider />
          <MenuButton tone="danger" onClick={() => { setDeleteState({ node: menu.node }); setMenu(null); }}>Delete</MenuButton>
        </div>
      )}
      {deleteState && (
        <DeleteConfirmDialog
          state={deleteState}
          onCancel={() => setDeleteState(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}

function ToolbarButton({ children, onClick, title }: { children: ReactNode; onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      style={{
        width: 26,
        height: 24,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
        border: "1px solid transparent",
        borderRadius: 6,
        color: "var(--text-muted)",
        cursor: "pointer",
        padding: 0,
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.background = "var(--bg-hover)";
        event.currentTarget.style.color = "var(--text)";
        event.currentTarget.style.borderColor = "var(--border)";
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.background = "transparent";
        event.currentTarget.style.color = "var(--text-muted)";
        event.currentTarget.style.borderColor = "transparent";
      }}
    >
      {children}
    </button>
  );
}

function MenuButton({ children, onClick, tone = "default" }: { children: ReactNode; onClick: () => void; tone?: "default" | "danger" }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        background: "transparent",
        border: "none",
        borderRadius: 5,
        color: tone === "danger" ? "#ef4444" : "var(--text)",
        cursor: "pointer",
        fontSize: 12,
        padding: "7px 9px",
        textAlign: "left",
      }}
    >
      {children}
    </button>
  );
}

function MenuDivider() {
  return <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />;
}

function DeleteConfirmDialog({
  state,
  onCancel,
  onConfirm,
}: {
  state: DeleteState;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Delete ${state.node.name}`}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.25)",
      }}
      onClick={onCancel}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(360px, calc(100vw - 32px))",
          background: "var(--bg-panel)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          boxShadow: "0 18px 50px rgba(0,0,0,0.25)",
          padding: 14,
        }}
      >
        <div style={{ color: "var(--text)", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
          Delete {state.node.isDir ? "folder" : "file"}?
        </div>
        <div style={{ color: "var(--text-muted)", fontSize: 12, lineHeight: 1.5, marginBottom: 12 }}>
          <span style={{ color: "var(--text)", fontWeight: 600 }}>{state.node.name}</span> will be permanently removed.
        </div>
        {state.error && (
          <div style={{ color: "#ef4444", fontSize: 11, marginBottom: 12 }}>
            {state.error}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" onClick={onCancel} disabled={state.deleting} style={dialogButtonStyle}>
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={state.deleting}
            style={{ ...dialogButtonStyle, background: "#ef4444", borderColor: "#ef4444", color: "white" }}
          >
            {state.deleting ? "Deleting" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

const dialogButtonStyle = {
  height: 28,
  padding: "0 10px",
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--bg-panel)",
  color: "var(--text)",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 600,
};

function FilePlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M12 11v6" />
      <path d="M9 14h6" />
    </svg>
  );
}

function FolderPlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 10v6" />
      <path d="M9 13h6" />
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7l-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M17 8l-5-5-5 5" />
      <path d="M12 3v12" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 0 1-15.3 6.4L3 16" />
      <path d="M3 21v-5h5" />
      <path d="M3 12A9 9 0 0 1 18.3 5.6L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  );
}
