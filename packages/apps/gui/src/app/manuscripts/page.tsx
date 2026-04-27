'use client'
import { useState, useEffect } from 'react'
import { FileText, ExternalLink, FolderOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

export default function ManuscriptsPage() {
  const [files, setFiles] = useState<string[] | null>(null)
  const [editorName, setEditorName] = useState<string>('')
  const [opening, setOpening] = useState(false)

  useEffect(() => {
    fetch('/api/manuscripts')
      .then(r => r.json())
      .then(d => setFiles(d.files))
      .catch(() => setFiles([]))

    fetch('/api/editor/config')
      .then(r => r.json())
      .then(d => {
        const id = d.config?.default || 'vscode'
        const all = [...d.builtins, ...(d.config?.custom || [])]
        const editor = all.find((e: { id: string }) => e.id === id)
        if (editor) setEditorName(editor.name)
      })
      .catch(() => {})
  }, [])

  const openInEditor = async () => {
    setOpening(true)
    try {
      await fetch('/api/editor/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'manuscripts' }),
      })
    } catch {
      // ignore
    } finally {
      setOpening(false)
    }
  }

  const buttonLabel = opening
    ? '正在打开...'
    : editorName
      ? `在 ${editorName} 中打开`
      : '在编辑器中打开'

  return (
    <div className="p-6 overflow-auto h-full">
      <h1 className="text-2xl font-semibold mb-6">手稿</h1>

      <div className="flex flex-col gap-6">
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <FolderOpen className="w-5 h-5 text-muted-foreground shrink-0" />
                <h2 className="font-medium">memory/manuscripts/</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                手稿目录，存放你的小说、剧本、世界观等参考材料。
              </p>

              {files === null ? (
                <div className="flex items-center gap-2 mt-3">
                  <Spinner className="size-3" />
                  <span className="text-xs text-muted-foreground">加载文件列表...</span>
                </div>
              ) : files.length === 0 ? (
                <p className="text-xs text-muted-foreground mt-3">
                  暂无手稿文件。点击下方按钮在编辑器中新建。
                </p>
              ) : (
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground mb-1">
                    {files.length} 个文件：
                  </p>
                  <ul className="text-sm space-y-0.5">
                    {files.map((f) => (
                      <li key={f} className="flex items-center gap-1.5 text-muted-foreground">
                        <FileText className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <Button
              onClick={openInEditor}
              disabled={opening}
              className="shrink-0"
            >
              <ExternalLink className="w-4 h-4" />
              {buttonLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
