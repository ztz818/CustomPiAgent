import { NextRequest, NextResponse } from 'next/server';

function serviceBaseUrl(): string | null {
  const value = process.env.HTML_PREVIEW_SERVICE_URL || process.env.NEXT_PUBLIC_HTML_PREVIEW_SERVICE_URL;
  return value ? value.replace(/\/$/, '') : null;
}

/**
 * HTML 渲染代理 API
 *
 * WebUI 只代理独立 HTML Preview Service 的渲染响应，不再直接读取本地 storage。
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; path?: string[] }> }
) {
  const baseUrl = serviceBaseUrl();
  if (!baseUrl) {
    return NextResponse.json(
      { success: false, error: 'HTML_PREVIEW_SERVICE_URL is not configured' },
      { status: 503 }
    );
  }

  const params = await context.params;
  const assetPath = params.path?.map(encodeURIComponent).join('/') || '';
  const upstreamPath = `/api/html/render/${encodeURIComponent(params.projectId)}${assetPath ? `/${assetPath}` : ''}`;
  const upstream = await fetch(`${baseUrl}${upstreamPath}`, { method: 'GET' });

  const headers = new Headers();
  for (const [key, value] of upstream.headers.entries()) {
    const lower = key.toLowerCase();
    if (['content-type', 'cache-control', 'content-security-policy', 'x-content-type-options'].includes(lower)) {
      headers.set(key, value);
    }
  }

  return new NextResponse(upstream.body, { status: upstream.status, headers });
}
