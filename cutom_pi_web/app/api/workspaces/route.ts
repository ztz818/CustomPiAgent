import { NextResponse } from "next/server";
import { ensureWorkspaceScaffold, getAuthorizedWorkspaces, getCurrentUserId } from "@/lib/workspace-config";

export async function GET() {
  try {
    const workspaces = getAuthorizedWorkspaces();
    for (const workspace of workspaces) ensureWorkspaceScaffold(workspace);
    return NextResponse.json({ userId: getCurrentUserId(), workspaces });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
