import { NextResponse } from 'next/server';
import { readLastErrorPerNode, readAllErrors } from '@flowcabal/engine';
import { getProjectRoot } from '@/lib/project-root';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workspaceId } = await params;
  const url = new URL(request.url);
  const projectDir = getProjectRoot();

  if (url.searchParams.get('per-node') === 'last') {
    const map = await readLastErrorPerNode(projectDir, workspaceId);
    return NextResponse.json(Object.fromEntries(map));
  }
  const all = await readAllErrors(projectDir, workspaceId);
  return NextResponse.json(all);
}
