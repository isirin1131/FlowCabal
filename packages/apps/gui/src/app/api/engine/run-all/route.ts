import { readWorkspace, writeWorkspace, runAllDataflow, readLlmConfigs } from '@flowcabal/engine'

export async function POST(request: Request) {
  const { workspaceId } = await request.json()
  const projectDir = process.cwd()
  const config = readLlmConfigs()['default']
  if (!config) {
    return new Response(JSON.stringify({ error: 'No default LLM config' }), {
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
