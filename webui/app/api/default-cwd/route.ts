import { NextResponse } from "next/server";
import { requireCurrentUser, unauthorizedResponse } from "@/lib/auth-lite";
import { ensureWorkspaceScaffold, getAuthorizedWorkspaces } from "@/lib/workspace-config";

// POST /api/default-cwd
// Returns the first configured workspace for the current lightweight user.
export async function POST() {
  try {
    const user = await requireCurrentUser();
    const workspace = getAuthorizedWorkspaces(user.id)[0];
    if (!workspace) return NextResponse.json({ error: "No workspace configured" }, { status: 404 });
    ensureWorkspaceScaffold(workspace);
    return NextResponse.json({ cwd: workspace.rootPath, workspace });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return unauthorizedResponse();
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
