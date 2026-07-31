import { createAgentSessionServices, getAgentDir } from "@earendil-works/pi-coding-agent";
import { getSupportedThinkingLevels } from "@earendil-works/pi-ai";
import { requireCurrentUser, unauthorizedResponse } from "@/lib/auth-lite";
import { getAuthorizedWorkspaces } from "@/lib/workspace-config";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireCurrentUser();
    const workspace = getAuthorizedWorkspaces(user.id)[0];
    if (!workspace) return Response.json({ error: "No workspace configured" }, { status: 404 });

    const services = await createAgentSessionServices({
      cwd: workspace.rootPath,
      agentDir: getAgentDir(),
    });
    const available = await services.modelRuntime.getAvailable();
    const modelList = available
      .map((model) => ({ id: model.id, name: model.name, provider: model.provider }))
      .sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id, undefined, { numeric: true }));
    const models: Record<string, string> = {};
    const thinkingLevels: Record<string, string[]> = {};
    const thinkingLevelMaps: Record<string, Record<string, string | null>> = {};
    for (const model of available) {
      const key = `${model.provider}:${model.id}`;
      models[key] = model.name;
      thinkingLevels[key] = getSupportedThinkingLevels(model);
      if (model.thinkingLevelMap) thinkingLevelMaps[key] = model.thinkingLevelMap;
    }

    const provider = services.settingsManager.getDefaultProvider();
    const modelId = services.settingsManager.getDefaultModel();
    const fallback = available[0];
    const defaultModel = provider && modelId
      ? { provider, modelId }
      : fallback ? { provider: fallback.provider, modelId: fallback.id } : null;

    return Response.json({
      models,
      modelList,
      defaultModel,
      thinkingLevels,
      thinkingLevelMaps,
      ...(services.modelRuntime.getError() ? { modelError: services.modelRuntime.getError() } : {}),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return unauthorizedResponse();
    return Response.json({
      models: {}, modelList: [], defaultModel: null,
      thinkingLevels: {}, thinkingLevelMaps: {},
      modelError: error instanceof Error ? error.message : String(error),
    });
  }
}
