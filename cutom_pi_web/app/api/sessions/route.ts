import { NextResponse } from "next/server";
import { requireCurrentUser, unauthorizedResponse } from "@/lib/auth-lite";
import { listAllSessions } from "@/lib/session-reader";

export async function GET() {
  try {
    const user = await requireCurrentUser();
    const sessions = await listAllSessions(user.id);
    return NextResponse.json({ sessions });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return unauthorizedResponse();
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
