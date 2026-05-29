import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

/**
 * HTML 渲染 API
 * GET /api/html/render/[projectId]/[...path]
 * 
 * Examples:
 * /api/html/render/proj_abc123              → index.html
 * /api/html/render/proj_abc123/styles.css   → styles.css
 * /api/html/render/proj_abc123/assets/logo.png → assets/logo.png
 */

const STORAGE_BASE = join(process.cwd(), 'storage', 'html-projects');

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; path?: string[] }> }
) {
  try {
    const params = await context.params;
    const { projectId, path = [] } = params;
    
    // 构建文件路径
    let filePath: string;
    if (path.length === 0) {
      // 默认返回 index.html
      filePath = join(STORAGE_BASE, projectId, 'index.html');
    } else {
      filePath = join(STORAGE_BASE, projectId, ...path);
    }

    // 安全检查：防止路径穿越
    const normalizedPath = join(STORAGE_BASE, projectId);
    if (!filePath.startsWith(normalizedPath)) {
      return NextResponse.json(
        { error: '非法路径' },
        { status: 403 }
      );
    }

    // 检查文件是否存在
    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: '文件不存在' },
        { status: 404 }
      );
    }

    // 读取文件
    const content = await readFile(filePath);

    // 根据文件扩展名设置 Content-Type
    const ext = filePath.split('.').pop()?.toLowerCase();
    const contentTypeMap: Record<string, string> = {
      html: 'text/html; charset=utf-8',
      css: 'text/css; charset=utf-8',
      js: 'application/javascript; charset=utf-8',
      json: 'application/json; charset=utf-8',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      svg: 'image/svg+xml',
      webp: 'image/webp',
      pdf: 'application/pdf',
    };

    const contentType = contentTypeMap[ext || ''] || 'application/octet-stream';

    return new NextResponse(content, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error: any) {
    console.error('HTML render error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
