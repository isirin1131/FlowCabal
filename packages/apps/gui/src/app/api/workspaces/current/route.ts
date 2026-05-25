import { NextResponse } from 'next/server'
import { writeCurrentWorkspace } from '@flowcabal/engine'

export async function PUT(request: Request) {
  const { workspaceId } = await request.json()
  writeCurrentWorkspace(process.cwd(), workspaceId)
  return NextResponse.json({ ok: true })
}
