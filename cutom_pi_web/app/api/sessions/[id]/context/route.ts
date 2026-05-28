import { NextResponse } from "next/server";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { requireCurrentUser, unauthorizedResponse } from "@/lib/auth-lite";
import { resolveSessionPath, buildSessionContext } from "@/lib/session-reader";
import { findWorkspaceContainingPath } from "@/lib/workspace-config";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(req.url);
  const leafId = url.searchParams.get("leafId") ?? undefined;

  try {
    const user = await requireCurrentUser();
    const filePath = await resolveSessionPath(id);
    if (!filePath) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const sm = SessionManager.open(filePath);
    const cwd = sm.getHeader()?.cwd ?? "";
    if (!findWorkspaceContainingPath(cwd, user.id)) {
      return NextResponse.json({ error: "Session is not authorized" }, { status: 403 });
    }
    const context = buildSessionContext(sm.getEntries() as never, leafId);

    return NextResponse.json({ context });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return unauthorizedResponse();
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
