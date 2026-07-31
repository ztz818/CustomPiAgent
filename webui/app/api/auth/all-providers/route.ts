import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { requireCurrentUser, unauthorizedResponse } from "@/lib/auth-lite";
import { buildApiKeyProviderList } from "@/lib/provider-listing";
import { collectProviderListingInputs } from "@/lib/provider-listing-runtime";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireCurrentUser();
    const modelRuntime = await ModelRuntime.create();
    const providers = buildApiKeyProviderList(await collectProviderListingInputs(modelRuntime));
    return Response.json({ providers });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return unauthorizedResponse();
    return Response.json({ error: String(error) }, { status: 500 });
  }
}
