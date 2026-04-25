import { NextResponse } from 'next/server'
import { readWorkspace, writeWorkspace } from '@flowcabal/engine'
import { workspaceToRecord, recordToWorkspace } from '@/lib/serialization'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const projectDir = process.cwd()
  const workspace = readWorkspace(projectDir, id)
  if (!workspace) {
    return NextResponse.json({ workspace: null }, { status: 404 })
  }
  return NextResponse.json({ workspace: workspaceToRecord(workspace) })
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { workspace: clientWs } = await request.json()
  const projectDir = process.cwd()
  writeWorkspace(projectDir, id, recordToWorkspace(clientWs))
  return NextResponse.json({ success: true })
}
