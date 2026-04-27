import { conversationalMemoryAgentStream, readLlmConfigs, type MemoryStreamChunk } from '@flowcabal/engine'

interface MemoryMessage {
  role: 'user' | 'assistant'
  content: string
  reasoningContent?: string
}

export async function POST(request: Request) {
  const { messages, configName } = (await request.json()) as {
    messages: MemoryMessage[]
    configName?: string
  }

  if (!messages || messages.length === 0) {
    return new Response(JSON.stringify({ error: 'No messages provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const projectDir = process.cwd()
  const configs = readLlmConfigs()
  const name = configName || 'default'
  const config = configs[name]
  if (!config) {
    return new Response(JSON.stringify({ error: `LLM config '${name}' not found` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const coreMessages = messages.map(m => {
    if (m.role === 'user') {
      return { role: 'user' as const, content: m.content }
    }
    return {
      role: 'assistant' as const,
      content: m.content,
      ...(m.reasoningContent
        ? { providerOptions: { openaiCompatible: { reasoning_content: m.reasoningContent } } }
        : {}),
    }
  })

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        console.log('[memory-chat] starting agent...')
        const agent = conversationalMemoryAgentStream(projectDir, config, coreMessages, {
          abortSignal: request.signal,
        })

        for await (const chunk of agent) {
          const line = `data: ${JSON.stringify(chunk)}\n\n`
          controller.enqueue(encoder.encode(line))
        }
      } catch (error) {
        console.error('[memory-chat] stream error:', error)
        let errMsg: string
        try {
          errMsg = error instanceof Error ? error.message : String(error)
        } catch {
          errMsg = 'Failed to extract error message'
        }
        const errorChunk: MemoryStreamChunk = {
          type: 'error',
          error: errMsg,
        }
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorChunk)}\n\n`))
        } catch {}
      } finally {
        try { controller.close() } catch {}
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
