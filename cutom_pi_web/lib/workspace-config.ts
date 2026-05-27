import fs from "fs";
import path from "path";

export interface NovaUser {
  id: string;
  username: string;
  passwordHash?: string;
}

export interface NovaWorkspace {
  id: string;
  name: string;
  rootPath: string;
  users: string[];
}

export interface NovaServerConfig {
  server: {
    host: string;
    port: number;
  };
  auth: {
    defaultUser: string;
  };
  storage: {
    dataDir: string;
  };
  users: NovaUser[];
  workspaces: NovaWorkspace[];
}

const PROJECT_ROOT = path.resolve(process.cwd(), "..");
const DEFAULT_CONFIG_PATH = path.join(PROJECT_ROOT, "conf", "server.yaml");

function resolveProjectPath(value: string): string {
  if (path.isAbsolute(value)) return path.resolve(value);
  return path.resolve(PROJECT_ROOT, value);
}

function scalar(line: string): string {
  return line.trim().replace(/^["']|["']$/g, "");
}

function parseInlineList(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return [];
  return trimmed
    .slice(1, -1)
    .split(",")
    .map((item) => scalar(item))
    .filter(Boolean);
}

function readConfigText(): string {
  const configPath = process.env.NOVA_CONFIG || DEFAULT_CONFIG_PATH;
  if (fs.existsSync(configPath)) return fs.readFileSync(configPath, "utf8");
  return "";
}

export function loadServerConfig(): NovaServerConfig {
  const text = readConfigText();
  const config: NovaServerConfig = {
    server: {
      host: process.env.HOST || "127.0.0.1",
      port: Number(process.env.PORT || 13001),
    },
    auth: {
      defaultUser: process.env.NOVA_USER || "admin",
    },
    storage: {
      dataDir: resolveProjectPath("data"),
    },
    users: [{ id: "admin", username: "admin" }],
    workspaces: [
      {
        id: "demo",
        name: "Demo Workspace",
        rootPath: resolveProjectPath("workspaces/demo"),
        users: ["admin"],
      },
    ],
  };

  let section = "";
  let currentUser: Partial<NovaUser> | null = null;
  let currentWorkspace: Partial<NovaWorkspace> | null = null;

  const flushUser = () => {
    if (!currentUser?.id) return;
    config.users.push({
      id: currentUser.id,
      username: currentUser.username || currentUser.id,
      passwordHash: currentUser.passwordHash,
    });
  };
  const flushWorkspace = () => {
    if (!currentWorkspace?.id || !currentWorkspace.rootPath) return;
    config.workspaces.push({
      id: currentWorkspace.id,
      name: currentWorkspace.name || currentWorkspace.id,
      rootPath: resolveProjectPath(currentWorkspace.rootPath),
      users: currentWorkspace.users || [],
    });
  };

  if (text.trim()) {
    config.users = [];
    config.workspaces = [];
  }

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+#.*$/, "");
    if (!line.trim()) continue;

    const top = /^([a-zA-Z][\w-]*):\s*$/.exec(line);
    if (top) {
      if (section === "users") flushUser();
      if (section === "workspaces") flushWorkspace();
      currentUser = null;
      currentWorkspace = null;
      section = top[1];
      continue;
    }

    if (section === "server") {
      const match = /^\s+(\w+):\s*(.+)$/.exec(line);
      if (!match) continue;
      if (match[1] === "host") config.server.host = scalar(match[2]);
      if (match[1] === "port") config.server.port = Number(scalar(match[2]));
      continue;
    }

    if (section === "auth") {
      const match = /^\s+(\w+):\s*(.+)$/.exec(line);
      if (match?.[1] === "defaultUser") config.auth.defaultUser = scalar(match[2]);
      continue;
    }

    if (section === "storage") {
      const match = /^\s+(\w+):\s*(.+)$/.exec(line);
      if (match?.[1] === "dataDir") config.storage.dataDir = resolveProjectPath(scalar(match[2]));
      continue;
    }

    if (section === "users") {
      const item = /^\s*-\s+id:\s*(.+)$/.exec(line);
      if (item) {
        flushUser();
        currentUser = { id: scalar(item[1]) };
        continue;
      }
      const prop = /^\s+(\w+):\s*(.+)$/.exec(line);
      if (prop && currentUser) currentUser[prop[1] as keyof NovaUser] = scalar(prop[2]);
      continue;
    }

    if (section === "workspaces") {
      const item = /^\s*-\s+id:\s*(.+)$/.exec(line);
      if (item) {
        flushWorkspace();
        currentWorkspace = { id: scalar(item[1]), users: [] };
        continue;
      }
      const prop = /^\s+(\w+):\s*(.+)$/.exec(line);
      if (!prop || !currentWorkspace) continue;
      const key = prop[1] as keyof NovaWorkspace;
      if (key === "users") currentWorkspace.users = parseInlineList(prop[2]);
      else currentWorkspace[key] = scalar(prop[2]) as never;
    }
  }

  if (section === "users") flushUser();
  if (section === "workspaces") flushWorkspace();

  if (process.env.HOST) config.server.host = process.env.HOST;
  if (process.env.PORT) config.server.port = Number(process.env.PORT);
  if (process.env.NOVA_USER) config.auth.defaultUser = process.env.NOVA_USER;

  return config;
}

export function getCurrentUserId(): string {
  return loadServerConfig().auth.defaultUser;
}

export function getAuthorizedWorkspaces(userId = getCurrentUserId()): NovaWorkspace[] {
  return loadServerConfig().workspaces.filter((workspace) => workspace.users.includes(userId));
}

export function findAuthorizedWorkspaceByRoot(rootPath: string, userId = getCurrentUserId()): NovaWorkspace | null {
  const target = path.resolve(rootPath);
  return getAuthorizedWorkspaces(userId).find((workspace) => path.resolve(workspace.rootPath) === target) ?? null;
}

export function findWorkspaceContainingPath(targetPath: string, userId = getCurrentUserId()): NovaWorkspace | null {
  const target = path.resolve(targetPath);
  for (const workspace of getAuthorizedWorkspaces(userId)) {
    const root = path.resolve(workspace.rootPath);
    const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
    if (target === root || target.startsWith(rootWithSep)) return workspace;
  }
  return null;
}

export function getWorkspaceAgentDir(workspace: NovaWorkspace): string {
  return path.join(workspace.rootPath, ".pi", "agent");
}

export function ensureWorkspaceScaffold(workspace: NovaWorkspace): void {
  for (const dir of [
    workspace.rootPath,
    path.join(workspace.rootPath, ".pi", "skills"),
  ]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
