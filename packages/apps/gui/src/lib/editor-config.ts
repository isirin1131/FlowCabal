import 'server-only'
import { homedir } from 'os'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import type { EditorConfigData } from './editors'

const CONFIG_DIR = join(homedir(), '.config', 'flowcabal')
const CONFIG_FILE = join(CONFIG_DIR, 'gui-config.json')

export function getEditorConfig(): EditorConfigData {
  if (!existsSync(CONFIG_FILE)) {
    return { default: 'vscode', custom: [] }
  }
  const raw = readFileSync(CONFIG_FILE, 'utf-8')
  const parsed = JSON.parse(raw)
  return {
    default: parsed.default || 'vscode',
    custom: Array.isArray(parsed.custom) ? parsed.custom : [],
  }
}

export function setEditorConfig(config: EditorConfigData): void {
  mkdirSync(CONFIG_DIR, { recursive: true })
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8')
}
