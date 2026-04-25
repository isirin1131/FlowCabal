import { NextResponse } from 'next/server'
import { readWorkspace, writeWorkspace, addNode, removeNode, renameNode } from '@flowcabal/engine'
import { workspaceToRecord } from '@/lib/serialization'

export async function POST(request: Request) {
  const { workspaceId, label } = await request.json()
  const projectDir = process.cwd()
  const workspace = readWorkspace(projectDir, workspaceId)
  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  }
  const node = addNode(workspace, label)
  writeWorkspace(projectDir, workspaceId, workspace)
  return NextResponse.json({ node, workspace: workspaceToRecord(workspace) })
}

export async function DELETE(request: Request) {
  const { workspaceId, nodeId } = await request.json()
  const projectDir = process.cwd()
  const workspace = readWorkspace(projectDir, workspaceId)
  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  }
  const removed = removeNode(workspace, nodeId)
  if (!removed) {
    return NextResponse.json({ error: 'Node not found' }, { status: 404 })
  }
  writeWorkspace(projectDir, workspaceId, workspace)
  return NextResponse.json({ success: true, workspace: workspaceToRecord(workspace) })
}

export async function PUT(request: Request) {
  const { workspaceId, nodeId, label } = await request.json()
  const projectDir = process.cwd()
  const workspace = readWorkspace(projectDir, workspaceId)
  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  }
  const renamed = renameNode(workspace, nodeId, label)
  if (!renamed) {
    return NextResponse.json({ error: 'Node not found' }, { status: 404 })
  }
  writeWorkspace(projectDir, workspaceId, workspace)
  return NextResponse.json({ success: true, workspace: workspaceToRecord(workspace) })
}
