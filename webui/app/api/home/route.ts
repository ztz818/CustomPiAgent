import { NextResponse } from "next/server";
import { requireCurrentUser, unauthorizedResponse } from "@/lib/auth-lite";
import { getAuthorizedWorkspaces } from "@/lib/workspace-config";

export async function GET() {
  try {
    const user = await requireCurrentUser();
    return NextResponse.json({ home: getAuthorizedWorkspaces(user.id)[0]?.rootPath ?? process.cwd() });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return unauthorizedResponse();
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
