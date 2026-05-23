'use client'
import { useState, useEffect } from 'react'

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

  const openLabel = opening
    ? 'opening...'
    : editorName
      ? `open in ${editorName.toLowerCase()} ↗`
      : 'open in editor ↗'

  return (
    <div className="h-full overflow-y-auto bg-paper">
      <div className="relative">
        <div className="absolute top-6 right-8 z-10">
          <button
            type="button"
            onClick={openInEditor}
            disabled={opening}
            className="font-mono text-[10.5px] text-ink-faint hover:text-clay transition-colors disabled:opacity-50 cursor-pointer tracking-[0.14em] lowercase"
          >
            {openLabel}
          </button>
        </div>

        <section className="pt-24 pb-20 px-6">
          <div className="text-center mb-12 select-none">
            <span className="font-mono text-[10.5px] text-ink-faint tracking-[0.18em] lowercase">
              <span className="text-rule mr-[18px] tracking-[-1px]">— —</span>
              manuscripts
              <span className="text-rule ml-[18px] tracking-[-1px]">— —</span>
            </span>
          </div>

          <div className="max-w-[720px] mx-auto">
            <div className="bg-paper-deep border border-rule rounded-md">
              <div className="px-4 py-2 border-b border-rule-soft">
                <span className="font-mono text-[11px] text-ink-soft tracking-wide">
                  memory/manuscripts/
                </span>
              </div>
              <div className="px-4 py-3">
                {files === null ? (
                  <div className="font-display italic text-[14px] text-ink-faint">
                    — 加载文件列表… —
                  </div>
                ) : files.length === 0 ? (
                  <div className="py-2 text-center font-display italic text-[14px] text-ink-soft">
                    — 尚无手稿，到编辑器中新建 —
                  </div>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {files.map(f => (
                      <li key={f} className="flex items-baseline gap-3 py-1">
                        <span className="text-clay" aria-hidden="true">·</span>
                        <span className="font-display text-[15px] text-ink-soft">
                          {f}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="mt-8 text-center">
              <p className="font-display italic text-[14.5px] text-ink-soft leading-[1.65]">
                手稿目录，存放小说、剧本、世界观等参考材料。
              </p>
              {files !== null && files.length > 0 && (
                <p className="mt-2 font-mono text-[10.5px] text-ink-faint tracking-[0.14em] lowercase">
                  共 {files.length} 个文件
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
