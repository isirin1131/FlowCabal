'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { MemoryStreamChunk } from '@flowcabal/engine'

type UserMessage = { id: string; role: 'user'; content: string }
type AssistantMessage = { id: string; role: 'assistant'; parts: MemoryStreamChunk[]; done: boolean }
type ChatMessage = UserMessage | AssistantMessage

function id() {
  return Math.random().toString(36).slice(2, 10)
}

// ───────────────────────────────────────────────────────────────
//  Markdown 渲染（助手消息正文）
//  display serif 16px / 行高 1.7，首段 drop cap 由 .fc-prose-first 接管
// ───────────────────────────────────────────────────────────────
function Prose({ children, first }: { children: string; first?: boolean }) {
  return (
    <div className={`fc-prose font-display text-[16px] leading-[1.7] text-ink ${first ? 'fc-prose-first' : ''}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {children}
      </ReactMarkdown>
    </div>
  )
}

// 思考过程：左 2px clay 竖线 + italic + ink-soft，无图标
function Reasoning({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(true)
  return (
    <div
      className="mt-6 border-l-2 border-clay pl-4 cursor-pointer transition-opacity duration-200 hover:opacity-90"
      onClick={() => setExpanded(!expanded)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpanded(!expanded) }}
    >
      <div className={`font-display italic text-[14.5px] leading-[1.65] text-ink-soft ${expanded ? '' : 'line-clamp-1'}`}>
        {text}
      </div>
    </div>
  )
}

// 行内工具引用：〔参阅 path · path〕
function ToolCite({ name, detail, isError }: { name: string; detail: string; isError?: boolean }) {
  return (
    <div className={`my-[18px] font-display italic text-[13px] ${isError ? 'text-error' : 'text-ink-faint'}`}>
      <span className="text-clay not-italic">〔</span>
      {name}
      {detail && (
        <>
          <span className="mx-2 text-rule">·</span>
          <span className="font-mono not-italic text-[12px]">{detail}</span>
        </>
      )}
      <span className="text-clay not-italic ml-px">〕</span>
    </div>
  )
}

function toolDetailFromArgs(args: unknown): string {
  if (!args || typeof args !== 'object') return ''
  const a = args as Record<string, unknown>
  for (const key of ['path', 'file', 'filename', 'query', 'pattern']) {
    if (typeof a[key] === 'string') return `${key}=${a[key]}`
  }
  const entries = Object.entries(a).slice(0, 1)
  if (entries.length > 0) {
    const [k, v] = entries[0]
    const s = typeof v === 'string' ? v : JSON.stringify(v)
    return `${k}=${s.slice(0, 80)}`
  }
  return ''
}

function toolDetailFromResult(result: unknown): string {
  const s = typeof result === 'string' ? result : JSON.stringify(result)
  if (s.length === 0) return '空'
  return `${s.length.toLocaleString()} 字`
}

function ErrorLine({ error }: { error: string }) {
  return (
    <div className="my-3 font-mono text-[12px] text-error border-l-2 border-error pl-3">
      {error}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  Page
// ═══════════════════════════════════════════════════════════════
export default function MemoryPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [editorName, setEditorName] = useState('')
  const [openingEditor, setOpeningEditor] = useState(false)

  useEffect(() => {
    fetch('/api/editor/config')
      .then(r => r.json())
      .then(d => {
        const eid = d.config?.default || 'vscode'
        const all = [...d.builtins, ...(d.config?.custom || [])]
        const editor = all.find((e: { id: string }) => e.id === eid)
        if (editor) setEditorName(editor.name)
      })
      .catch(() => {})
  }, [])

  const openMemoryDir = async () => {
    setOpeningEditor(true)
    try {
      await fetch('/api/editor/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'memory' }),
      })
    } catch {
      // ignore
    } finally {
      setOpeningEditor(false)
    }
  }

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return

    const userMsg: UserMessage = { id: id(), role: 'user', content: input.trim() }
    const assistantMsg: AssistantMessage = { id: id(), role: 'assistant', parts: [], done: false }

    setMessages(prev => [...prev, userMsg, assistantMsg])
    setInput('')
    setIsStreaming(true)

    const abort = new AbortController()
    abortRef.current = abort

    const allMessages = [...messages, userMsg]
    const coreMessages = allMessages
      .filter(m => m.role === 'user' || (m.role === 'assistant' && m.parts.some(p => p.type === 'text-delta')))
      .map(m => {
        if (m.role === 'user') return { role: 'user' as const, content: m.content }
        const am = m as AssistantMessage
        const text = am.parts
          .filter((p): p is MemoryStreamChunk & { type: 'text-delta' } => p.type === 'text-delta')
          .map(p => p.text)
          .join('')
        const reasoningContent = am.parts
          .filter(p => p.type === 'reasoning')
          .map(p => (p as MemoryStreamChunk & { type: 'reasoning' }).text)
          .join('') || undefined
        return { role: 'assistant' as const, content: text, reasoningContent }
      })

    try {
      const res = await fetch('/api/memory/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: coreMessages }),
        signal: abort.signal,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '请求失败' }))
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMsg.id
              ? { ...m, parts: [{ type: 'error', error: err.error || '未知错误' } as MemoryStreamChunk], done: true }
              : m
          )
        )
        return
      }

      const reader = res.body?.getReader()
      if (!reader) {
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMsg.id
              ? { ...m, parts: [{ type: 'error', error: '无法读取响应流' } as MemoryStreamChunk], done: true }
              : m
          )
        )
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') continue

          try {
            const chunk = JSON.parse(data) as MemoryStreamChunk
            setMessages(prev =>
              prev.map(m =>
                m.id === assistantMsg.id
                  ? {
                      ...m,
                      parts: [...(m as AssistantMessage).parts, chunk],
                      done: chunk.type === 'finish' || chunk.type === 'error',
                    }
                  : m
              )
            )

            if (chunk.type === 'finish' || chunk.type === 'error') {
              return
            }
          } catch {
            // Skip unparseable SSE data
          }
        }
      }

      setMessages(prev =>
        prev.map(m =>
          m.id === assistantMsg.id ? { ...m, done: true } : m
        )
      )
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMsg.id ? { ...m, done: true } : m
          )
        )
      } else {
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMsg.id
              ? {
                  ...m,
                  parts: [...(m as AssistantMessage).parts, { type: 'error', error: (error as Error).message || '连接错误' } as MemoryStreamChunk],
                  done: true,
                }
              : m
          )
        )
      }
    } finally {
      setIsStreaming(false)
      abortRef.current = null
    }
  }

  const stopGeneration = () => {
    abortRef.current?.abort()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // 第一条助手消息（按出现顺序）—— drop cap 只给它
  const firstAssistantId = messages.find(m => m.role === 'assistant')?.id

  return (
    <div className="flex flex-col h-full bg-paper">
      {/* ── Scroll container（包整个 scene + 输入栏顶部按钮在内的可滚动主体） ── */}
      <div className="flex-1 min-h-0 overflow-y-auto">

        {/* ── Scene chrome：顶部「open in editor」浮在右上 ── */}
        <div className="relative">
          <div className="absolute top-6 right-8 z-10">
            <button
              type="button"
              onClick={openMemoryDir}
              disabled={openingEditor}
              className="font-mono text-[10.5px] text-ink-faint hover:text-clay transition-colors disabled:opacity-50 cursor-pointer tracking-[0.14em] lowercase"
            >
              {openingEditor
                ? 'opening...'
                : editorName
                  ? `open in ${editorName.toLowerCase()} ↗`
                  : 'open in editor ↗'}
            </button>
          </div>

          {/* ── Memory scene ──
              padding: 96px(顶) 24px(左右安全缘) 120px(底)
              内部 .memory-column 强制 680px 居中 */}
          <section className="pt-24 pb-30 px-6">
            {/* scene-label — — memory — — */}
            <div className="text-center mb-16 select-none">
              <span className="font-mono text-[10.5px] text-ink-faint tracking-[0.18em] lowercase relative">
                <span className="text-rule mr-[18px] tracking-[-1px]">— —</span>
                memory
                <span className="text-rule ml-[18px] tracking-[-1px]">— —</span>
              </span>
            </div>

            {/* memory-column —— 680px 窄列 */}
            <div className="max-w-[680px] mx-auto">

              {messages.length === 0 && (
                <div className="text-center mt-12">
                  <p className="font-display italic text-[17px] text-ink-soft leading-[1.6]">
                    — 与 memory 对话 —
                  </p>
                  <p className="mt-4 font-body text-[13px] text-ink-faint">
                    它会读取 <span className="font-mono">memory/</span> 与{' '}
                    <span className="font-mono">memory/manuscripts/</span> 来回答你的问题
                  </p>
                </div>
              )}

              {messages.map((msg, idx) => {
                const prev = messages[idx - 1]
                const showDividerAbove = idx > 0 && prev && prev.role !== msg.role

                if (msg.role === 'user') {
                  return (
                    <div key={msg.id}>
                      {showDividerAbove && <TurnDivider />}
                      {/* turn-user: padding-left 56px, who 绝对定位在左侧基线 */}
                      <div className="relative pl-14 mb-14">
                        <span
                          className="absolute left-0 top-0 font-display text-[13px] text-ink-faint tracking-[0.06em] select-none"
                        >
                          Z —
                        </span>
                        <div className="font-body text-[13px] text-ink-soft leading-[1.65] tracking-[0.005em] whitespace-pre-wrap break-words">
                          {msg.content}
                        </div>
                      </div>
                    </div>
                  )
                }

                // ── assistant ──
                type Segment =
                  | { kind: 'text'; key: string; text: string }
                  | { kind: 'reasoning'; key: string; text: string }
                  | { kind: 'tool-call'; key: string; chunk: MemoryStreamChunk & { type: 'tool-call' } }
                  | { kind: 'tool-result'; key: string; chunk: MemoryStreamChunk & { type: 'tool-result' } }
                  | { kind: 'error'; key: string; error: string }

                const segments: Segment[] = []
                {
                  let textBuf = ''
                  let reasoningBuf = ''
                  const flushText = (i: number) => {
                    if (textBuf) {
                      segments.push({ kind: 'text', key: `${msg.id}-t${i}`, text: textBuf })
                      textBuf = ''
                    }
                  }
                  const flushReasoning = (i: number) => {
                    if (reasoningBuf) {
                      segments.push({ kind: 'reasoning', key: `${msg.id}-r${i}`, text: reasoningBuf })
                      reasoningBuf = ''
                    }
                  }

                  for (let i = 0; i < msg.parts.length; i++) {
                    const p = msg.parts[i]
                    if (p.type === 'text-delta') {
                      flushReasoning(i)
                      textBuf += p.text
                    } else if (p.type === 'reasoning') {
                      flushText(i)
                      reasoningBuf += p.text
                    } else if (p.type === 'tool-call-delta' || p.type === 'finish' || p.type === 'step-finish') {
                      // skip — mockup 不显示 step 分隔
                    } else if (p.type === 'tool-call') {
                      flushText(i); flushReasoning(i)
                      segments.push({ kind: 'tool-call', key: `${msg.id}-tc${i}`, chunk: p })
                    } else if (p.type === 'tool-result') {
                      flushText(i); flushReasoning(i)
                      segments.push({ kind: 'tool-result', key: `${msg.id}-tr${i}`, chunk: p })
                    } else if (p.type === 'error') {
                      flushText(i); flushReasoning(i)
                      segments.push({ kind: 'error', key: `${msg.id}-er${i}`, error: p.error })
                    }
                  }
                  flushText(msg.parts.length)
                  flushReasoning(msg.parts.length)
                }

                // 这条助手消息里出现的第一个 text 段，给 drop cap
                const isFirstAssistantMsg = msg.id === firstAssistantId
                let textIndexInMsg = 0

                return (
                  <div key={msg.id}>
                    {showDividerAbove && <TurnDivider />}
                    {/* turn-assistant: padding-left 56px, who 绝对定位（clay） */}
                    <div className="relative pl-14 mb-14">
                      <span
                        className="absolute left-0 top-[6px] font-display text-[13px] text-clay tracking-[0.06em] select-none"
                      >
                        M —
                      </span>

                      <div>
                        {segments.map(seg => {
                          if (seg.kind === 'text') {
                            const isFirstTextOfFirstMsg = isFirstAssistantMsg && textIndexInMsg === 0
                            textIndexInMsg += 1
                            return <Prose key={seg.key} first={isFirstTextOfFirstMsg}>{seg.text}</Prose>
                          }
                          if (seg.kind === 'reasoning') {
                            return <Reasoning key={seg.key} text={seg.text} />
                          }
                          if (seg.kind === 'tool-call') {
                            return (
                              <ToolCite
                                key={seg.key}
                                name={seg.chunk.toolName}
                                detail={toolDetailFromArgs(seg.chunk.args)}
                              />
                            )
                          }
                          if (seg.kind === 'tool-result') {
                            return (
                              <ToolCite
                                key={seg.key}
                                name={`${seg.chunk.toolName} 结果`}
                                detail={toolDetailFromResult(seg.chunk.result)}
                                isError={seg.chunk.isError}
                              />
                            )
                          }
                          if (seg.kind === 'error') {
                            return <ErrorLine key={seg.key} error={seg.error} />
                          }
                          return null
                        })}

                        {!msg.done && (
                          <div className="mt-3 font-display italic text-[13px] text-ink-faint">
                            <span className="inline-block animate-pulse">— 正在响应…</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* scene-end ornament */}
              {messages.length > 0 && (
                <div className="text-center mt-4 mb-2 font-mono text-[12px] text-ink-faint tracking-[0.6em] select-none">
                  ·  ·  ·
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          </section>
        </div>
      </div>

      {/* ── Input compose card —— 固定在底部，遵循 24px 安全缘 ── */}
      <div className="shrink-0 bg-paper border-t border-rule-soft">
        <div className="px-6 pt-6 pb-8">
          <div className="max-w-[680px] mx-auto">
            <div
              className={[
                'bg-paper-deep border rounded-[8px] transition-colors duration-200 shadow-paper',
                input.trim() ? 'border-clay/40' : 'border-rule',
              ].join(' ')}
            >
              {/* Textarea */}
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="向 memory 提问…"
                rows={2}
                className="
                  block w-full resize-none bg-transparent outline-none
                  font-display text-[15px] text-ink placeholder:text-ink-faint placeholder:italic
                  leading-[1.65]
                  px-5 pt-4 pb-3
                  min-h-[64px] max-h-[260px]
                "
                style={{ fieldSizing: 'content' } as React.CSSProperties}
              />

              {/* Hairline divider */}
              <div className="h-px bg-rule-soft mx-5" />

              {/* Bottom bar */}
              <div className="flex items-center justify-between px-5 py-3">
                <div className="font-mono text-[10.5px] text-ink-faint tracking-wide flex items-center gap-3 select-none">
                  <span className="flex items-center gap-1.5">
                    <kbd className="font-mono border border-rule rounded-sm px-1.5 py-px not-italic text-ink-soft">↵</kbd>
                    <span>发送</span>
                  </span>
                  <span className="text-rule">·</span>
                  <span className="flex items-center gap-1.5">
                    <kbd className="font-mono border border-rule rounded-sm px-1.5 py-px not-italic text-ink-soft">⇧↵</kbd>
                    <span>换行</span>
                  </span>
                </div>

                {isStreaming ? (
                  <button
                    type="button"
                    onClick={stopGeneration}
                    className="font-display italic text-[14px] text-error hover:opacity-80 cursor-pointer"
                  >
                    停止
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={sendMessage}
                    disabled={!input.trim()}
                    className="font-display italic text-[14px] text-clay hover:text-clay-deep disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    发送&nbsp;→
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Turn divider —— 36px 外距 + 1px hairline，连接两次对话
function TurnDivider() {
  return <div className="my-9 h-px bg-rule" />
}
