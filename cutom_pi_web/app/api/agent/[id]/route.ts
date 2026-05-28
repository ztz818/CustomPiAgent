import { NextResponse } from "next/server";
import { requireCurrentUser, unauthorizedResponse } from "@/lib/auth-lite";
import { resolveSessionPath } from "@/lib/session-reader";
import { startRpcSession, getRpcSession, getRpcSessionOwner } from "@/lib/rpc-manager";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { findWorkspaceContainingPath } from "@/lib/workspace-config";

async function getAuthorizedSessionCwd(id: string, userId: string): Promise<{ cwd: string; filePath: string | null } | { error: NextResponse }> {
  const owner = getRpcSessionOwner(id);
  if (owner) {
    if (owner.userId && owner.userId !== userId) {
      return { error: NextResponse.json({ error: "Session is not authorized" }, { status: 403 }) };
    }
    if (!findWorkspaceContainingPath(owner.cwd, userId)) {
      return { error: NextResponse.json({ error: "Session is not authorized" }, { status: 403 }) };
    }
    return { cwd: owner.cwd, filePath: await resolveSessionPath(id) };
  }

  const filePath = await resolveSessionPath(id);
  if (!filePath) {
    return { error: NextResponse.json({ error: "Session not found" }, { status: 404 }) };
  }
  const cwd = SessionManager.open(filePath).getHeader()?.cwd ?? process.cwd();
  if (!findWorkspaceContainingPath(cwd, userId)) {
    return { error: NextResponse.json({ error: "Session is not authorized" }, { status: 403 }) };
  }
  return { cwd, filePath };
}

// POST /api/agent/[id] - Send a command to an existing session
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const user = await requireCurrentUser();
    const body = await req.json() as { type: string; [key: string]: unknown };

    const authorized = await getAuthorizedSessionCwd(id, user.id);
    if ("error" in authorized) return authorized.error;
    const { cwd, filePath } = authorized;

    const existing = getRpcSession(id);
    if (existing?.isAlive()) {
      const result = await existing.send(body);
      return NextResponse.json({ success: true, data: result });
    }

    const { session } = await startRpcSession(id, filePath ?? "", cwd, undefined, user.id);
    const result = await session.send(body);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return unauthorizedResponse();
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// GET /api/agent/[id] - Get current agent state
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const user = await requireCurrentUser();
    const authorized = await getAuthorizedSessionCwd(id, user.id);
    if ("error" in authorized) return authorized.error;

    const session = getRpcSession(id);
    if (!session || !session.isAlive()) {
      return NextResponse.json({ running: false });
    }

    const state = await session.send({ type: "get_state" });
    return NextResponse.json({ running: true, state });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return unauthorizedResponse();
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
