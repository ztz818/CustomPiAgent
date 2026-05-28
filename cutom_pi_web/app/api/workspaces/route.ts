import { NextResponse } from "next/server";
import { requireCurrentUser, unauthorizedResponse } from "@/lib/auth-lite";
import { ensureWorkspaceScaffold, getAuthorizedWorkspaces } from "@/lib/workspace-config";

export async function GET() {
  try {
    const user = await requireCurrentUser();
    const workspaces = getAuthorizedWorkspaces(user.id);
    for (const workspace of workspaces) ensureWorkspaceScaffold(workspace);
    return NextResponse.json({ userId: user.id, user, workspaces });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return unauthorizedResponse();
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
