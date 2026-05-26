import { NextResponse } from 'next/server'
import { readWorkspace, writeWorkspace } from '@flowcabal/engine'
import { workspaceToRecord } from '@/lib/serialization'
import { getProjectRoot } from '@/lib/project-root'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workspaceId } = await params
  const { nodeId, op } = await request.json() as { nodeId: string; op?: 'add' | 'toggle' }
  const projectDir = getProjectRoot()
  const workspace = readWorkspace(projectDir, workspaceId)
  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  }
  const has = workspace.target_nodes.includes(nodeId)
  if (op === 'toggle') {
    if (has) workspace.target_nodes = workspace.target_nodes.filter(id => id !== nodeId)
    else workspace.target_nodes.push(nodeId)
  } else {
    if (!has) workspace.target_nodes.push(nodeId)
  }
  writeWorkspace(projectDir, workspaceId, workspace)
  return NextResponse.json({ workspace: workspaceToRecord(workspace) })
}
