import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

/**
 * HTML 上传 API
 * POST /api/html/upload
 * 
 * Body:
 * {
 *   "projectId": "proj_abc123",  // 可选，不提供则自动生成
 *   "files": [
 *     { "path": "index.html", "content": "..." },
 *     { "path": "styles.css", "content": "..." }
 *   ]
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "projectId": "proj_abc123",
 *   "url": "/render/proj_abc123",
 *   "files": ["index.html", "styles.css"]
 * }
 */

const STORAGE_BASE = join(process.cwd(), 'storage', 'html-projects');

function generateProjectId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `proj_${timestamp}_${random}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId: providedId, files } = body;

    // 验证
    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { success: false, error: 'files 字段必须是非空数组' },
        { status: 400 }
      );
    }

    // 生成或使用提供的 projectId
    const projectId = providedId || generateProjectId();
    const projectDir = join(STORAGE_BASE, projectId);

    // 创建项目目录
    if (!existsSync(projectDir)) {
      await mkdir(projectDir, { recursive: true });
    }

    // 写入所有文件
    const uploadedFiles: string[] = [];
    for (const file of files) {
      if (!file.path || !file.content) {
        continue;
      }

      const filePath = join(projectDir, file.path);
      const fileDir = join(filePath, '..');
      
      // 确保子目录存在
      if (!existsSync(fileDir)) {
        await mkdir(fileDir, { recursive: true });
      }

      await writeFile(filePath, file.content, 'utf-8');
      uploadedFiles.push(file.path);
    }

    // 记录元数据
    const metadata = {
      projectId,
      createdAt: new Date().toISOString(),
      files: uploadedFiles,
      fileCount: uploadedFiles.length,
    };

    await writeFile(
      join(projectDir, '.metadata.json'),
      JSON.stringify(metadata, null, 2),
      'utf-8'
    );

    return NextResponse.json({
      success: true,
      projectId,
      url: `/render/${projectId}`,
      files: uploadedFiles,
      createdAt: metadata.createdAt,
    });
  } catch (error: any) {
    console.error('HTML upload error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
