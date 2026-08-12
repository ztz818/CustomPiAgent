import { NextResponse } from "next/server";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { requireCurrentUser, unauthorizedResponse } from "@/lib/auth-lite";
import { getRpcSession } from "@/lib/rpc-manager";
import { resolveSessionPath } from "@/lib/session-reader";
import { findWorkspaceContainingPath } from "@/lib/workspace-config";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const user = await requireCurrentUser();
    const rpc = getRpcSession(id);
    let cwd = rpc?.isAlive() ? rpc.cwd : "";

    if (!cwd) {
      const filePath = await resolveSessionPath(id);
      if (!filePath) return NextResponse.json({ error: "Session not found" }, { status: 404 });
      cwd = SessionManager.open(filePath).getHeader()?.cwd ?? "";
    }

    if (!findWorkspaceContainingPath(cwd, user.id)) {
      return NextResponse.json({ error: "Session is not authorized" }, { status: 403 });
    }
    if (!rpc?.isAlive()) return NextResponse.json({ running: false });

    const state = await rpc.send({ type: "get_state" });
    return NextResponse.json({ running: true, state });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return unauthorizedResponse();
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
