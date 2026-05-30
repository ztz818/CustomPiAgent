import { NextRequest, NextResponse } from 'next/server';

function serviceBaseUrl(): string | null {
  const value = process.env.HTML_PREVIEW_SERVICE_URL || process.env.NEXT_PUBLIC_HTML_PREVIEW_SERVICE_URL;
  return value ? value.replace(/\/$/, '') : null;
}

async function proxy(path: string, init: RequestInit = {}) {
  const baseUrl = serviceBaseUrl();
  if (!baseUrl) {
    return NextResponse.json(
      { success: false, error: 'HTML_PREVIEW_SERVICE_URL is not configured' },
      { status: 503 }
    );
  }

  const upstream = await fetch(`${baseUrl}${path}`, init);
  const text = await upstream.text();
  const headers = new Headers();
  headers.set('Content-Type', upstream.headers.get('Content-Type') || 'application/json; charset=utf-8');
  return new NextResponse(text, { status: upstream.status, headers });
}

/** HTML 项目列表/删除代理 API，实际能力由独立 HTML Preview Service 提供。 */
export async function GET() {
  return proxy('/api/html/list', { method: 'GET' });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const qs = searchParams.toString();
  return proxy(`/api/html/list${qs ? `?${qs}` : ''}`, { method: 'DELETE' });
}
