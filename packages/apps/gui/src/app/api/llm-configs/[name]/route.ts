import { NextResponse } from 'next/server'
import { readLlmFile, writeLlmFile } from '@flowcabal/engine'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params
  const file = readLlmFile()
  delete file.configs[name]
  if (file.active === name) {
    file.active = Object.keys(file.configs).sort()[0] ?? ''
  }
  writeLlmFile(file)
  return NextResponse.json({ success: true })
}
