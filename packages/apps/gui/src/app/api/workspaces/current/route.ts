import { NextResponse } from 'next/server'
import { writeCurrentWorkspace } from '@flowcabal/engine'
import { getProjectRoot } from '@/lib/project-root'

export async function PUT(request: Request) {
  const { workspaceId } = await request.json()
  writeCurrentWorkspace(getProjectRoot(), workspaceId)
  return NextResponse.json({ ok: true })
}
