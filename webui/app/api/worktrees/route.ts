import { existsSync } from "fs";
import { NextResponse } from "next/server";
import { requireCurrentUser, unauthorizedResponse } from "@/lib/auth-lite";
import { listWorktrees, resolveProject } from "@/lib/worktree";
import { findWorkspaceContainingPath } from "@/lib/workspace-config";

export async function GET(request: Request) {
  try {
    const user = await requireCurrentUser();
    const cwd = new URL(request.url).searchParams.get("cwd")?.trim();
    if (!cwd || !findWorkspaceContainingPath(cwd, user.id)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const project = await resolveProject(cwd);
    let isGit = true;
    let worktrees: Awaited<ReturnType<typeof listWorktrees>> = [];
    try {
      worktrees = (await listWorktrees(existsSync(cwd) ? cwd : project.projectRoot))
        .filter((entry) => Boolean(findWorkspaceContainingPath(entry.path, user.id)));
    } catch {
      isGit = false;
    }

    return NextResponse.json({
      projectRoot: findWorkspaceContainingPath(project.projectRoot, user.id) ? project.projectRoot : cwd,
      isGit,
      isTopLevel: project.isTopLevel,
      worktrees,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return unauthorizedResponse();
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json(
    { error: "Creating worktrees outside the authorized workspace is disabled" },
    { status: 403 },
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: "Removing worktrees through Nova Lab is disabled" },
    { status: 403 },
  );
}
