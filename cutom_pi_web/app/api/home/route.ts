import { NextResponse } from "next/server";
import { getAuthorizedWorkspaces } from "@/lib/workspace-config";

export async function GET() {
  return NextResponse.json({ home: getAuthorizedWorkspaces()[0]?.rootPath ?? process.cwd() });
}
