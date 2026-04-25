import { NextResponse } from 'next/server'
import { readLlmConfigs, writeLlmConfigs } from '@flowcabal/engine'

export async function GET() {
  const configs = readLlmConfigs()
  return NextResponse.json({ configs })
}

export async function POST(request: Request) {
  const { name, config } = await request.json()
  const configs = readLlmConfigs()
  configs[name] = config
  writeLlmConfigs(configs)
  return NextResponse.json({ success: true })
}
