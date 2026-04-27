import { NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { existsSync, mkdirSync } from 'fs'
import { platform } from 'os'
import { join, resolve } from 'path'
import { getEditorConfig } from '@/lib/editor-config'
import { BUILTIN_EDITORS } from '@/lib/editors'

const TARGET_DIRS: Record<string, string> = {
  manuscripts: join('memory', 'manuscripts'),
  memory: 'memory',
}

export async function POST(request: Request) {
  const { target, path: customPath, editorId } = await request.json()
  const projectDir = process.cwd()

  let dirPath: string
  if (target && TARGET_DIRS[target]) {
    dirPath = resolve(projectDir, TARGET_DIRS[target])
  } else if (typeof customPath === 'string') {
    dirPath = resolve(projectDir, customPath)
    const resolvedProject = resolve(projectDir)
    if (!dirPath.startsWith(resolvedProject)) {
      return NextResponse.json({ error: 'Path is outside project directory' }, { status: 403 })
    }
  } else {
    return NextResponse.json({ error: 'Either "target" or "path" is required' }, { status: 400 })
  }

  const config = getEditorConfig()
  const id = editorId || config.default
  const os = platform()
  const allEditors = [
    ...BUILTIN_EDITORS.filter(e => e.platform.includes(os)),
    ...config.custom,
  ]
  const editor = allEditors.find(e => e.id === id)

  if (!editor) {
    return NextResponse.json({ error: `Editor "${id}" not found` }, { status: 404 })
  }

  const args = editor.args.map(a => a.replace('{path}', dirPath))

  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true })
  }

  try {
    const child = spawn(editor.command, args, {
      detached: true,
      stdio: 'ignore',
    })
    child.unref()

    return NextResponse.json({ success: true, editor: editor.name })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: `Failed to launch editor: ${message}` }, { status: 500 })
  }
}
