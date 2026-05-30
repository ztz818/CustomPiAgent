import { NextRequest, NextResponse } from 'next/server';

function serviceBaseUrl(): string | null {
  const value = process.env.HTML_PREVIEW_SERVICE_URL || process.env.NEXT_PUBLIC_HTML_PREVIEW_SERVICE_URL;
  return value ? value.replace(/\/$/, '') : null;
}

async function proxyJson(path: string, init: RequestInit) {
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

/**
 * HTML 上传代理 API
 *
 * WebUI 不再保存/渲染 HTML 项目，只转发到独立 HTML Preview Service。
 * 配置：HTML_PREVIEW_SERVICE_URL=http://127.0.0.1:18080
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  return proxyJson('/api/html/upload', {
    method: 'POST',
    headers: { 'Content-Type': request.headers.get('Content-Type') || 'application/json' },
    body,
  });
}
