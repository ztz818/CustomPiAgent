import { NextResponse } from "next/server";
import { requireCurrentUser, unauthorizedResponse } from "@/lib/auth-lite";
import { startRpcSession } from "@/lib/rpc-manager";
import { ensureWorkspaceScaffold, findAuthorizedWorkspaceByRoot } from "@/lib/workspace-config";

// POST /api/agent/new  body: { cwd: string; type: string; message: string; ... }
// Spawns a brand-new pi session and immediately sends the first command.
// Returns { sessionId, data } where sessionId is pi's real session id.
export async function POST(req: Request) {
  try {
    const user = await requireCurrentUser();
    const body = await req.json() as { cwd?: string; [key: string]: unknown };
    const { cwd, ...command } = body;

    if (!cwd || typeof cwd !== "string") {
      return NextResponse.json({ error: "cwd is required" }, { status: 400 });
    }
    const workspace = findAuthorizedWorkspaceByRoot(cwd, user.id);
    if (!workspace) {
      return NextResponse.json({ error: "Workspace is not authorized" }, { status: 403 });
    }
    ensureWorkspaceScaffold(workspace);

    // Use a one-time key so startRpcSession's lock doesn't conflict with real session ids
    const { provider, modelId, toolNames, thinkingLevel, createOnly, ...promptCommand } = command as { provider?: string; modelId?: string; toolNames?: string[]; thinkingLevel?: string; createOnly?: boolean; [key: string]: unknown };

    const tempKey = `__new__${Date.now()}`;
    const { session, realSessionId } = await startRpcSession(tempKey, "", workspace.rootPath, toolNames, user.id);

    // Keep the files-route allowed-roots cache (see app/api/files/[...path]/route.ts)
    // in sync so the new cwd is immediately readable via /api/files. Without this,
    // a file request under a brand-new cwd would 403 for up to the cache TTL.
    globalThis.__piAllowedRootsCache?.get(user.id)?.roots.add(workspace.rootPath);

    // Apply pre-selected model before sending the prompt
    if (provider && modelId) {
      await session.send({ type: "set_model", provider, modelId });
    }

    // Apply pre-selected thinking level before sending the prompt
    if (thinkingLevel) {
      await session.send({ type: "set_thinking_level", level: thinkingLevel });
    }

    if (createOnly) {
      return NextResponse.json({ success: true, sessionId: realSessionId, data: null });
    }

    const result = await session.send(promptCommand);

    return NextResponse.json({ success: true, sessionId: realSessionId, data: result });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return unauthorizedResponse();
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
