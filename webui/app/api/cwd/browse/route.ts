import path from "path";
import { stat } from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser, unauthorizedResponse } from "@/lib/auth-lite";
import { getParentDirectory, listDirectories, resolveDirectory } from "@/lib/directory-browser";
import { findWorkspaceContainingPath, getAuthorizedWorkspaces } from "@/lib/workspace-config";

export async function GET(request: NextRequest) {
  try {
    const user = await requireCurrentUser();
    const requested = request.nextUrl.searchParams.get("path")?.trim();

    if (!requested) {
      const directories = getAuthorizedWorkspaces(user.id).map((workspace) => ({
        name: workspace.name,
        path: workspace.rootPath,
      }));
      return NextResponse.json({ path: "", parentPath: null, directories });
    }

    const workspace = findWorkspaceContainingPath(requested, user.id);
    if (!workspace) return NextResponse.json({ error: "Access denied" }, { status: 403 });

    let resolved: string;
    try {
      resolved = await resolveDirectory(requested);
      if (!findWorkspaceContainingPath(resolved, user.id)) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
      if (!(await stat(resolved)).isDirectory()) {
        return NextResponse.json({ error: "Path is not a directory" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "Directory does not exist" }, { status: 404 });
    }

    const root = path.resolve(workspace.rootPath);
    const parent = getParentDirectory(resolved);
    return NextResponse.json({
      path: resolved,
      parentPath: path.resolve(resolved) === root ? "" : parent,
      directories: await listDirectories(resolved),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return unauthorizedResponse();
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
