import { NextResponse } from 'next/server'
import { readWorkspace, writeWorkspace, insertBlock, updateBlock, removeBlock } from '@flowcabal/engine'
import { workspaceToRecord } from '@/lib/serialization'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { nodeId, action, isSystem, block, index } = await request.json()
  const projectDir = process.cwd()
  const workspace = readWorkspace(projectDir, id)
  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  }

  let result = false
  switch (action) {
    case 'insert':
      result = insertBlock(workspace, nodeId, block, isSystem, index)
      break
    case 'update':
      result = updateBlock(workspace, nodeId, isSystem, index, block)
      break
    case 'remove':
      result = removeBlock(workspace, nodeId, isSystem, index)
      break
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  if (!result) {
    return NextResponse.json({ error: 'Operation failed' }, { status: 400 })
  }

  writeWorkspace(projectDir, id, workspace)
  return NextResponse.json({ success: true, workspace: workspaceToRecord(workspace) })
}
