import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { requireCurrentUser, unauthorizedResponse } from "@/lib/auth-lite";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    await requireCurrentUser();
    const { provider } = await params;
    const runtime = await ModelRuntime.create();
    await runtime.logout(provider);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return unauthorizedResponse();
    return Response.json({ error: String(error) }, { status: 500 });
  }
}
