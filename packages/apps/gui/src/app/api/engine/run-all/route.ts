import { readWorkspace, writeWorkspace, runAllDataflow, getActiveLlmConfig } from '@flowcabal/engine'
import { getProjectRoot } from '@/lib/project-root'

export async function POST(request: Request) {
  const { workspaceId } = await request.json()
  const projectDir = getProjectRoot()
  const config = getActiveLlmConfig()
  if (!config) {
    return new Response(JSON.stringify({ error: '请先在 settings 选择活跃 LLM' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const workspace = readWorkspace(projectDir, workspaceId)
  if (!workspace) {
    return new Response(JSON.stringify({ error: 'Workspace not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      try {
        for await (const event of runAllDataflow(workspace, config, projectDir)) {
          controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'))
        }
        writeWorkspace(projectDir, workspaceId, workspace)
      } catch {
        // node-error 已 yield 给客户端；catch 阻止 unhandled throw
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
    },
  })
}
