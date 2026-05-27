import { NextResponse } from "next/server";
import { ensureWorkspaceScaffold, getAuthorizedWorkspaces } from "@/lib/workspace-config";

// POST /api/default-cwd
// Returns the first configured workspace for the current lightweight user.
export async function POST() {
  try {
    const workspace = getAuthorizedWorkspaces()[0];
    if (!workspace) return NextResponse.json({ error: "No workspace configured" }, { status: 404 });
    ensureWorkspaceScaffold(workspace);
    return NextResponse.json({ cwd: workspace.rootPath, workspace });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
