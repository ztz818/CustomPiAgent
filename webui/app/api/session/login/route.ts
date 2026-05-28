import { NextResponse } from "next/server";
import { authenticateAccessCode, loadServerConfig } from "@/lib/workspace-config";
import { publicUser, setAuthCookie } from "@/lib/auth-lite";

export async function POST(req: Request) {
  try {
    const { username, accessCode } = await req.json() as { username?: string; accessCode?: string };
    const user = authenticateAccessCode(loadServerConfig(), username ?? "", accessCode ?? "");
    if (!user) {
      return NextResponse.json({ error: "用户名或访问码错误" }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true, user: publicUser(user) });
    setAuthCookie(response, user.id);
    return response;
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
