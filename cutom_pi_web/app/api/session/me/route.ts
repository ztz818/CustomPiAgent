import { NextResponse } from "next/server";
import { getCurrentUser, unauthorizedResponse } from "@/lib/auth-lite";
import { getAuthorizedWorkspaces } from "@/lib/workspace-config";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  return NextResponse.json({ user, workspaces: getAuthorizedWorkspaces(user.id) });
}
