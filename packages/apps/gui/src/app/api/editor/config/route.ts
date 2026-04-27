import { NextResponse } from 'next/server'
import { platform } from 'os'
import { getEditorConfig, setEditorConfig } from '@/lib/editor-config'
import { BUILTIN_EDITORS } from '@/lib/editors'

export async function GET() {
  const config = getEditorConfig()
  const os = platform()
  const builtins = BUILTIN_EDITORS.filter(e => e.platform.includes(os))
  return NextResponse.json({ config, builtins })
}

export async function PUT(request: Request) {
  const body = await request.json()
  const config = getEditorConfig()

  if (typeof body.default === 'string') {
    config.default = body.default
  }
  if (Array.isArray(body.custom)) {
    config.custom = body.custom
  }

  setEditorConfig(config)
  return NextResponse.json({ config })
}
