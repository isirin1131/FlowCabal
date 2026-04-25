import { NextResponse } from 'next/server'
import { readWorkspace, writeWorkspace, runAll, readLlmConfigs } from '@flowcabal/engine'
import { workspaceToRecord } from '@/lib/serialization'

export async function POST(request: Request) {
  const { workspaceId } = await request.json()
  const projectDir = process.cwd()
  const config = readLlmConfigs()['default']
  if (!config) {
    return NextResponse.json({ error: 'No default LLM config' }, { status: 400 })
  }
  try {
    const workspace = readWorkspace(projectDir, workspaceId)
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }
    const executed = await runAll(workspace, config, projectDir)
    writeWorkspace(projectDir, workspaceId, workspace)
    return NextResponse.json({ executed, workspace: workspaceToRecord(workspace) })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
