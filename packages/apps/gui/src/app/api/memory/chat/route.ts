import { NextResponse } from 'next/server'
import { runMemoryAgent, readLlmConfigs } from '@flowcabal/engine'

export async function POST(request: Request) {
  const { messages } = await request.json()
  const lastUserMsg = messages?.filter((m: any) => m.role === 'user').pop()
  if (!lastUserMsg) {
    return NextResponse.json({ response: '' })
  }
  const projectDir = process.cwd()
  const config = readLlmConfigs()['default']
  if (!config) {
    return NextResponse.json({ error: 'No default LLM config' }, { status: 400 })
  }
  try {
    const response = await runMemoryAgent(projectDir, config, lastUserMsg.content)
    return NextResponse.json({ response })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
