import { NextResponse } from "next/server";
import { requireCurrentUser, unauthorizedResponse } from "@/lib/auth-lite";
import { getRpcSession, getRunningRpcSessionIds } from "@/lib/rpc-manager";
import { findWorkspaceContainingPath } from "@/lib/workspace-config";

export const dynamic = "force-dynamic";

// Return only running sessions visible to the current user's workspaces.
export async function GET() {
  try {
    const user = await requireCurrentUser();
    const runningSessionIds = getRunningRpcSessionIds().filter((id) => {
      const session = getRpcSession(id);
      return Boolean(session?.isAlive() && findWorkspaceContainingPath(session.cwd, user.id));
    });

    return NextResponse.json(
      { runningSessionIds },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return unauthorizedResponse();
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
