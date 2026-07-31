import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { NextResponse } from "next/server";
import { requireCurrentUser, unauthorizedResponse } from "@/lib/auth-lite";

type Params = { params: Promise<{ provider: string }> };

async function authorizedRuntime() {
  await requireCurrentUser();
  return ModelRuntime.create();
}

export async function GET(_req: Request, { params }: Params) {
  try {
    const { provider } = await params;
    const runtime = await authorizedRuntime();
    const status = runtime.getProviderAuthStatus(provider);
    const displayName = runtime.getProvider(provider)?.name ?? provider;
    return NextResponse.json({
      provider,
      displayName,
      configured: status.configured,
      source: status.source,
      models: runtime.getModels(provider).length,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return unauthorizedResponse();
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const { provider } = await params;
    const { apiKey } = await req.json() as { apiKey?: string };
    if (!apiKey?.trim()) return NextResponse.json({ error: "apiKey is required" }, { status: 400 });
    const runtime = await authorizedRuntime();
    let submitted = false;
    await runtime.login(provider, "api_key", {
      notify: () => undefined,
      prompt: async (prompt) => {
        if (prompt.type === "select") {
          const option = prompt.options.find((item) => item.id === "api-key" || item.id === "bearer-token");
          if (option) return option.id;
        }
        if (!submitted && prompt.type === "secret") {
          submitted = true;
          return apiKey.trim();
        }
        throw new Error(`${provider} requires additional authentication settings`);
      },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return unauthorizedResponse();
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { provider } = await params;
    const runtime = await authorizedRuntime();
    await runtime.logout(provider);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return unauthorizedResponse();
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
