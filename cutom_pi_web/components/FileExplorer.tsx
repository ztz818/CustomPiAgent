"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { MouseEvent, ReactNode } from "react";
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
    if (node.isDir) {
      const next = !open;
      onToggleExpanded(node.fullPath, next);
      if (next && !loaded) loadChildren();
    } else {
      onOpenFile(node.fullPath, node.name);
    }
  }, [node.isDir, node.fullPath, node.name, loaded, open, loadChildren, onOpenFile, onToggleExpanded]);

  return (
    <div>
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
      {node.isDir && open && (
        <div>
          {children.map((child) => (
            <TreeNode key={child.fullPath} node={child} depth={depth + 1} cwd={cwd} onOpenFile={onOpenFile} onAtMention={onAtMention} expandedPaths={expandedPaths} onToggleExpanded={onToggleExpanded} refreshKey={refreshKey} onContextMenu={onContextMenu} />
          ))}
          {children.length === 0 && loaded && (
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

  const createChild = useCallback(async (dirPath: string, type: "mkdir" | "touch") => {
    const label = type === "mkdir" ? "folder" : "file";
    const name = window.prompt(`New ${label} name`);
    if (!name) return;
    try {
      const encoded = encodeFilePathForApi(dirPath);
      await runJsonAction(`/api/files/${encoded}?type=${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      bumpRefresh();
    } catch (e) {
      window.alert(String(e));
    }
  }, [bumpRefresh]);

  const uploadInto = useCallback((dirPath: string) => {
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

  const renameNode = useCallback(async (node: FileNode) => {
    const name = window.prompt("Rename to", node.name);
    if (!name || name === node.name) return;
    try {
      const encoded = encodeFilePathForApi(node.fullPath);
      await runJsonAction(`/api/files/${encoded}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      bumpRefresh();
    } catch (e) {
      window.alert(String(e));
    }
  }, [bumpRefresh]);

  const deleteNode = useCallback(async (node: FileNode) => {
    const ok = window.confirm(`Delete ${node.isDir ? "folder" : "file"} "${node.name}"? This cannot be undone.`);
    if (!ok) return;
    try {
      const encoded = encodeFilePathForApi(node.fullPath);
      await runJsonAction(`/api/files/${encoded}`, { method: "DELETE" });
      bumpRefresh();
    } catch (e) {
      window.alert(String(e));
    }
  }, [bumpRefresh]);

  const handleContextMenu = useCallback((event: MouseEvent, node: FileNode) => {
    event.preventDefault();
    setMenu({ x: event.clientX, y: event.clientY, node });
  }, []);

  useEffect(() => {
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", close);
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
        <button onClick={() => createChild(cwd, "touch")} title="New file" style={toolbarButtonStyle}>+ File</button>
        <button onClick={() => createChild(cwd, "mkdir")} title="New folder" style={toolbarButtonStyle}>+ Folder</button>
        <button onClick={() => uploadInto(cwd)} title="Upload files" style={toolbarButtonStyle}>Upload</button>
      </div>
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
              <MenuButton onClick={() => { createChild(menu.node.fullPath, "touch"); setMenu(null); }}>New File</MenuButton>
              <MenuButton onClick={() => { createChild(menu.node.fullPath, "mkdir"); setMenu(null); }}>New Folder</MenuButton>
              <MenuButton onClick={() => { uploadInto(menu.node.fullPath); setMenu(null); }}>Upload Here</MenuButton>
              <MenuDivider />
            </>
          )}
          <MenuButton onClick={() => { renameNode(menu.node); setMenu(null); }}>Rename</MenuButton>
          <MenuButton onClick={() => { deleteNode(menu.node); setMenu(null); }}>Delete</MenuButton>
          <MenuButton onClick={() => { downloadPath(menu.node.fullPath, menu.node.isDir); setMenu(null); }}>Download</MenuButton>
          <MenuButton onClick={() => { navigator.clipboard?.writeText(getRelativeFilePath(menu.node.fullPath, cwd)); setMenu(null); }}>Copy Path</MenuButton>
        </div>
      )}
    </div>
  );
}

const toolbarButtonStyle = {
  background: "var(--bg-panel)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  color: "var(--text-muted)",
  cursor: "pointer",
  fontSize: 11,
  fontWeight: 600,
  height: 24,
  padding: "0 8px",
};

function MenuButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        background: "transparent",
        border: "none",
        borderRadius: 5,
        color: "var(--text)",
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
