import { NextResponse } from 'next/server'
import { initFromEmpty, writeWorkspace } from '@flowcabal/engine'
import { workspaceToRecord } from '@/lib/serialization'

export async function POST(request: Request) {
  const { name } = await request.json()
  const projectDir = process.cwd()
  const workspace = initFromEmpty(name)
  writeWorkspace(projectDir, workspace.id, workspace)
  return NextResponse.json({ workspace: workspaceToRecord(workspace) })
}
