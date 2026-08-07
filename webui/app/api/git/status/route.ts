import fs from "fs";
import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser, unauthorizedResponse } from "@/lib/auth-lite";
import { getGitStatus } from "@/lib/git-changes";
import { findWorkspaceContainingPath } from "@/lib/workspace-config";

export async function GET(request: NextRequest) {
  try {
    const user = await requireCurrentUser();
    const cwd = request.nextUrl.searchParams.get("cwd")?.trim() ?? "";
    if (!cwd || !findWorkspaceContainingPath(cwd, user.id)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    try {
      if (!fs.statSync(cwd).isDirectory()) {
        return NextResponse.json({ error: "Not a directory" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "Directory not found" }, { status: 404 });
    }
    return NextResponse.json(await getGitStatus(cwd));
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return unauthorizedResponse();
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
