import { NextResponse } from 'next/server'
import { readLlmConfigs, writeLlmConfigs } from '@flowcabal/engine'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params
  const configs = readLlmConfigs()
  delete configs[name]
  writeLlmConfigs(configs)
  return NextResponse.json({ success: true })
}
