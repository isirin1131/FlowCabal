import { NextResponse } from 'next/server'
import { readWorkspace, writeWorkspace } from '@flowcabal/engine'
import { workspaceToRecord } from '@/lib/serialization'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workspaceId } = await params
  const { nodeId } = await request.json()
  const projectDir = process.cwd()
  const workspace = readWorkspace(projectDir, workspaceId)
  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  }
  if (!workspace.target_nodes.includes(nodeId)) {
    workspace.target_nodes.push(nodeId)
  }
  writeWorkspace(projectDir, workspaceId, workspace)
  return NextResponse.json({ workspace: workspaceToRecord(workspace) })
}
