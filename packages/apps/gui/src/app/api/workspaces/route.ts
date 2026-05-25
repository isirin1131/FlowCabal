import { NextResponse } from 'next/server'
import { initFromEmpty, writeWorkspace, listWorkspaceEntries, readCurrentWorkspace, writeCurrentWorkspace } from '@flowcabal/engine'
import { workspaceToRecord } from '@/lib/serialization'

export async function GET() {
  const projectDir = process.cwd()
  const workspaces = listWorkspaceEntries(projectDir)
  const currentWorkspaceId = readCurrentWorkspace(projectDir)
  return NextResponse.json({ workspaces, currentWorkspaceId })
}

export async function POST(request: Request) {
  const { name } = await request.json()
  const projectDir = process.cwd()
  const workspace = initFromEmpty(name)
  writeWorkspace(projectDir, workspace.id, workspace)
  writeCurrentWorkspace(projectDir, workspace.id)
  return NextResponse.json({ workspace: workspaceToRecord(workspace) })
}
