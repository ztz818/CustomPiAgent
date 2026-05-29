import { NextRequest, NextResponse } from 'next/server';
import { readdir, readFile, rm } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

/**
 * HTML 项目列表 API
 * GET /api/html/list
 * 
 * Response:
 * {
 *   "projects": [
 *     {
 *       "projectId": "proj_abc123",
 *       "createdAt": "2026-05-29T...",
 *       "files": ["index.html", "styles.css"],
 *       "fileCount": 2
 *     }
 *   ]
 * }
 * 
 * DELETE /api/html/list?projectId=proj_abc123
 * 删除指定项目
 */

const STORAGE_BASE = join(process.cwd(), 'storage', 'html-projects');

export async function GET(request: NextRequest) {
  try {
    if (!existsSync(STORAGE_BASE)) {
      return NextResponse.json({ projects: [] });
    }

    const projectDirs = await readdir(STORAGE_BASE);
    const projects = [];

    for (const projectId of projectDirs) {
      const metadataPath = join(STORAGE_BASE, projectId, '.metadata.json');
      
      if (existsSync(metadataPath)) {
        const metadata = JSON.parse(
          await readFile(metadataPath, 'utf-8')
        );
        projects.push(metadata);
      } else {
        // 没有元数据，尝试读取文件列表
        const files = await readdir(join(STORAGE_BASE, projectId));
        projects.push({
          projectId,
          createdAt: null,
          files: files.filter(f => f !== '.metadata.json'),
          fileCount: files.length - 1,
        });
      }
    }

    // 按创建时间倒序
    projects.sort((a, b) => {
      if (!a.createdAt) return 1;
      if (!b.createdAt) return -1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return NextResponse.json({ projects });
  } catch (error: any) {
    console.error('HTML list error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId 参数必填' },
        { status: 400 }
      );
    }

    const projectDir = join(STORAGE_BASE, projectId);

    if (!existsSync(projectDir)) {
      return NextResponse.json(
        { error: '项目不存在' },
        { status: 404 }
      );
    }

    // 删除项目目录
    await rm(projectDir, { recursive: true, force: true });

    return NextResponse.json({
      success: true,
      message: `项目 ${projectId} 已删除`,
    });
  } catch (error: any) {
    console.error('HTML delete error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
