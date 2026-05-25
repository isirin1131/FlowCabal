import { NextResponse } from 'next/server'
import { readLlmFile, writeLlmFile } from '@flowcabal/engine'

export async function GET() {
  const file = readLlmFile()
  return NextResponse.json({ active: file.active, configs: file.configs })
}

export async function POST(request: Request) {
  const { name, config } = await request.json()
  const file = readLlmFile()
  file.configs[name] = config
  if (!file.active) file.active = name  // 首条自动 active
  writeLlmFile(file)
  return NextResponse.json({ success: true })
}

export async function PATCH(request: Request) {
  const { active } = await request.json()
  const file = readLlmFile()
  if (!file.configs[active]) {
    return NextResponse.json({ error: 'config not found' }, { status: 400 })
  }
  file.active = active
  writeLlmFile(file)
  return NextResponse.json({ success: true })
}
