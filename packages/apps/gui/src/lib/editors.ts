export interface EditorDef {
  id: string
  name: string
  command: string
  args: string[]
  platform: string[]
}

export interface EditorConfigData {
  default: string
  custom: EditorDef[]
}

export const BUILTIN_EDITORS: EditorDef[] = [
  { id: 'vscode', name: 'VS Code', command: 'code', args: ['{path}'], platform: ['darwin', 'linux', 'win32'] },
  { id: 'cursor', name: 'Cursor', command: 'cursor', args: ['{path}'], platform: ['darwin'] },
  { id: 'sublime', name: 'Sublime Text', command: 'subl', args: ['{path}'], platform: ['darwin'] },
  { id: 'textedit', name: 'TextEdit', command: 'open', args: ['-a', 'TextEdit', '{path}'], platform: ['darwin'] },
  { id: 'kate', name: 'Kate', command: 'kate', args: ['{path}'], platform: ['linux'] },
  { id: 'gedit', name: 'Gedit', command: 'gedit', args: ['{path}'], platform: ['linux'] },
  { id: 'notepad', name: 'Notepad', command: 'notepad', args: ['{path}'], platform: ['win32'] },
]
