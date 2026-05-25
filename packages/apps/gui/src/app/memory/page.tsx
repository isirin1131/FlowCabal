'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { MemoryStreamChunk } from '@flowcabal/engine'
import {
  isPersistenceAvailable,
  listConversations,
  createConversation,
  renameConversation,
  touchConversation,
  deleteConversation,
  loadMessages,
  appendMessage,
  updateMessage,
  type Conversation,
  type PersistedMessage,
} from '@/lib/memory-db'

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

// 行内工具引用：〔toolName · detail〕——可点击触发右侧抽屉
function ToolCite({
  name,
  detail,
  isError,
  onClick,
}: {
  name: string
  detail: string
  isError?: boolean
  onClick?: () => void
}) {
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={[
        'my-[18px] font-display italic text-[13px] text-left',
        isError ? 'text-error' : 'text-ink-faint',
        onClick
          ? 'cursor-pointer hover:text-ink transition-colors duration-150 group'
          : '',
      ].join(' ')}
    >
      <span className={`not-italic ${isError ? 'text-error' : 'text-clay'} ${onClick ? 'group-hover:text-clay-deep' : ''}`}>〔</span>
      {name}
      {detail && (
        <>
          <span className="mx-2 text-rule">·</span>
          <span className="font-mono not-italic text-[12px]">{detail}</span>
        </>
      )}
      <span className={`not-italic ml-px ${isError ? 'text-error' : 'text-clay'} ${onClick ? 'group-hover:text-clay-deep' : ''}`}>〕</span>
    </Comp>
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

// ───────────────────────────────────────────────────────────────
//  Tool detail drawer —— 右侧 480px 抽屉，paper 底 + rule 左边
// ───────────────────────────────────────────────────────────────
type ToolPair = {
  toolCallId: string
  toolName: string
  args: unknown
  // 配对的 result（若尚未到达则为 undefined）
  result?: unknown
  isError?: boolean
}

function formatValue(v: unknown): string {
  if (v === undefined) return ''
  if (typeof v === 'string') return v
  try {
    return JSON.stringify(v, null, 2)
  } catch {
    return String(v)
  }
}

function ToolDrawer({ pair, onClose }: { pair: ToolPair | null; onClose: () => void }) {
  // Esc 关闭
  useEffect(() => {
    if (!pair) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pair, onClose])

  const open = pair !== null

  return (
    <>
      {/* 背幕：极淡 ink 蒙板，仅用于点击关闭，不阻挡阅读对话 */}
      <div
        className={[
          'fixed inset-0 z-40 transition-opacity duration-200',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        ].join(' ')}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={[
          'fixed top-0 right-0 bottom-0 z-50 w-[480px] max-w-[92vw]',
          'bg-paper border-l border-rule shadow-lift',
          'transition-transform duration-300 ease-out',
          'flex flex-col',
          open ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
        aria-hidden={!open}
      >
        {/* 顶部 chrome */}
        <div className="shrink-0 px-7 pt-6 pb-5 border-b border-rule-soft flex items-baseline justify-between">
          <div>
            <div className="font-mono text-[10.5px] text-ink-faint tracking-[0.14em] lowercase">
              tool call
            </div>
            <div className="mt-1.5 font-display text-[18px] text-ink leading-tight">
              {pair?.toolName ?? ''}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="font-display text-[18px] text-ink-faint hover:text-clay transition-colors leading-none cursor-pointer"
            aria-label="关闭"
          >
            ×
          </button>
        </div>

        {/* 内容滚动区 */}
        <div className="flex-1 min-h-0 overflow-y-auto px-7 py-6">
          {pair && (
            <>
              {/* 参数 */}
              <SectionLabel>参数</SectionLabel>
              <CodeBlock content={formatValue(pair.args) || '（无参数）'} />

              {/* 结果 / 等待 / 错误 */}
              <div className="mt-7">
                <SectionLabel error={pair.isError}>
                  {pair.isError ? '错误' : '结果'}
                </SectionLabel>
                {pair.result === undefined ? (
                  <div className="font-display italic text-[13.5px] text-ink-faint">
                    — 正在等待结果…
                  </div>
                ) : (
                  <CodeBlock
                    content={formatValue(pair.result) || '（空）'}
                    error={pair.isError}
                  />
                )}
              </div>
            </>
          )}
        </div>

        {/* 底部 toolCallId（mono，方便调试） */}
        {pair && (
          <div className="shrink-0 px-7 py-3 border-t border-rule-soft font-mono text-[10.5px] text-ink-faint tracking-wide lowercase truncate">
            id: {pair.toolCallId}
          </div>
        )}
      </aside>
    </>
  )
}

// ───────────────────────────────────────────────────────────────
//  Conversations sidebar —— 左侧 280px 抽屉
// ───────────────────────────────────────────────────────────────
function ConversationsSidebar({
  open,
  onClose,
  conversations,
  activeId,
  persistenceOk,
  onSelect,
  onNew,
  onRename,
  onDelete,
}: {
  open: boolean
  onClose: () => void
  conversations: Conversation[]
  activeId: string | null
  persistenceOk: boolean
  onSelect: (id: string) => void
  onNew: () => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <>
      <div
        className={[
          'fixed inset-0 z-40 transition-opacity duration-200',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        ].join(' ')}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={[
          'fixed top-0 left-0 bottom-0 z-50 w-[280px] max-w-[88vw]',
          'bg-paper border-r border-rule shadow-lift',
          'transition-transform duration-300 ease-out',
          'flex flex-col',
          open ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
        aria-hidden={!open}
      >
        {/* scene-label 风顶部 */}
        <div className="shrink-0 pt-7 pb-5 text-center select-none">
          <span className="font-mono text-[10.5px] text-ink-faint tracking-[0.18em] lowercase relative">
            <span className="text-rule mr-[14px] tracking-[-1px]">—</span>
            conversations
            <span className="text-rule ml-[14px] tracking-[-1px]">—</span>
          </span>
        </div>

        {/* 新建按钮 */}
        <div className="shrink-0 px-6 pb-3">
          <button
            type="button"
            onClick={onNew}
            className="font-display italic text-[14px] text-clay hover:text-clay-deep transition-colors cursor-pointer"
          >
            + 新建对话
          </button>
        </div>

        <div className="shrink-0 h-px bg-rule-soft mx-6" />

        {/* 列表 / 空态 / 不可用提示 */}
        <div className="flex-1 min-h-0 overflow-y-auto py-3">
          {!persistenceOk && (
            <div className="px-6 py-3 font-display italic text-[12.5px] text-ink-faint leading-[1.55]">
              — 当前浏览器不支持持久化，对话仅暂存于内存
            </div>
          )}
          {persistenceOk && conversations.length === 0 && (
            <div className="px-6 py-6 text-center font-display italic text-[13.5px] text-ink-faint">
              尚未开始任何对话
            </div>
          )}
          {conversations.map(conv => (
            <ConversationItem
              key={conv.id}
              conv={conv}
              active={conv.id === activeId}
              onSelect={() => onSelect(conv.id)}
              onRename={(t) => onRename(conv.id, t)}
              onDelete={() => onDelete(conv.id)}
            />
          ))}
        </div>
      </aside>
    </>
  )
}

function ConversationItem({
  conv, active, onSelect, onRename, onDelete,
}: {
  conv: Conversation
  active: boolean
  onSelect: () => void
  onRename: (title: string) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(conv.title)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const commit = () => {
    const t = draft.trim()
    if (t && t !== conv.title) onRename(t)
    setEditing(false)
  }

  const d = new Date(conv.updatedAt)
  const meta = `${d.getMonth() + 1} 月 ${d.getDate()} 日`

  return (
    <div
      className={[
        'group relative pl-6 pr-6 py-2.5',
        'cursor-pointer transition-colors duration-150',
        active ? 'bg-paper-deep' : 'hover:bg-paper-deep/60',
      ].join(' ')}
      onClick={() => !editing && onSelect()}
    >
      {/* active 左竖线 */}
      {active && (
        <span className="absolute left-0 top-2 bottom-2 w-[2px] bg-clay" aria-hidden="true" />
      )}

      {/* 标题 / 编辑态 */}
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); commit() }
            else if (e.key === 'Escape') { setDraft(conv.title); setEditing(false) }
          }}
          onClick={e => e.stopPropagation()}
          className="w-full bg-transparent border-b border-clay outline-none font-display text-[14.5px] text-ink leading-tight pb-0.5"
        />
      ) : (
        <div
          onDoubleClick={e => { e.stopPropagation(); setEditing(true); setDraft(conv.title) }}
          className={[
            'font-display text-[14.5px] leading-tight truncate pr-5',
            active ? 'text-ink font-medium' : 'text-ink-soft',
          ].join(' ')}
          title={conv.title || '（无标题）'}
        >
          {conv.title || '（无标题）'}
        </div>
      )}

      {/* meta */}
      <div className="mt-1 font-mono text-[10.5px] text-ink-faint tracking-wide tabular-nums">
        {meta}
      </div>

      {/* 删除按钮，hover 出现 */}
      {!editing && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onDelete() }}
          className="absolute right-3 top-2.5 font-display text-[16px] leading-none text-ink-faint hover:text-error opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          aria-label="删除对话"
        >
          ×
        </button>
      )}
    </div>
  )
}

function SectionLabel({ children, error }: { children: React.ReactNode; error?: boolean }) {
  return (
    <div
      className={[
        'font-mono text-[10.5px] tracking-[0.14em] lowercase mb-2',
        error ? 'text-error' : 'text-ink-faint',
      ].join(' ')}
    >
      {children}
    </div>
  )
}

function CodeBlock({ content, error }: { content: string; error?: boolean }) {
  return (
    <pre
      className={[
        'font-mono text-[12px] leading-[1.6] whitespace-pre-wrap break-words',
        'bg-paper-deep border rounded-[6px] px-4 py-3',
        error ? 'border-error/40 text-error' : 'border-rule-soft text-ink',
      ].join(' ')}
    >
      {content}
    </pre>
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
  const [openPair, setOpenPair] = useState<ToolPair | null>(null)

  // 持久化 / 多会话
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  // 必须 SSR/hydrate 一致地从 false 起步，挂载后再探测；否则 React 报 hydration mismatch
  const [persistenceOk, setPersistenceOk] = useState(false)
  // 流式期间用于节流写库的 timer 句柄；keyed by message id
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 流式中的最新 parts 快照，flush 时用
  const liveSnapRef = useRef<{ id: string; parts: MemoryStreamChunk[]; done: boolean } | null>(null)

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

  // ─── 持久化初始化：挂载后探测 IDB 可用性，再拉会话列表 ───
  useEffect(() => {
    const ok = isPersistenceAvailable()
    setPersistenceOk(ok)
    if (!ok) return
    listConversations().then(setConversations).catch(() => {})
  }, [])

  // ─── 节流写库（200ms debounce）。SSE 高频 text-delta 不会把磁盘写爆 ───
  const flushPersist = useCallback(() => {
    const snap = liveSnapRef.current
    if (!snap) return
    updateMessage(snap.id, { parts: snap.parts, done: snap.done }).catch(() => {})
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current)
      flushTimerRef.current = null
    }
  }, [])

  const schedulePersist = useCallback((snap: { id: string; parts: MemoryStreamChunk[]; done: boolean }) => {
    liveSnapRef.current = snap
    if (flushTimerRef.current) return // 已经有 timer，等它触发
    flushTimerRef.current = setTimeout(() => {
      flushPersist()
    }, 200)
  }, [flushPersist])

  // 卸载时确保最后一次 flush
  useEffect(() => {
    return () => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current)
        flushPersist()
      }
    }
  }, [flushPersist])

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

    // ─── 持久化：lazy 建会话 + 即刻写 user/assistant 消息 ───
    let convId = activeId
    if (persistenceOk) {
      if (!convId) {
        const titleRaw = userMsg.content.trim().replace(/\s+/g, ' ')
        const title = titleRaw.length > 40 ? `${titleRaw.slice(0, 40)}…` : titleRaw
        const conv = await createConversation(title)
        if (conv) {
          convId = conv.id
          setActiveId(conv.id)
          setConversations(prev => [conv, ...prev])
        }
      }
      if (convId) {
        const now = Date.now()
        appendMessage({
          id: userMsg.id, conversationId: convId, role: 'user',
          content: userMsg.content, parts: [], done: true, createdAt: now,
        }).catch(() => {})
        appendMessage({
          id: assistantMsg.id, conversationId: convId, role: 'assistant',
          content: '', parts: [], done: false, createdAt: now + 1,
        }).catch(() => {})
        touchConversation(convId).catch(() => {})
      }
    }

    const abort = new AbortController()
    abortRef.current = abort

    // 闭包：用最新 React state 的那条 assistant 消息派生 snap，写入 ref + 触发节流
    const persistFromState = (updatedMessages: ChatMessage[]) => {
      if (!persistenceOk || !convId) return
      const am = updatedMessages.find(m => m.id === assistantMsg.id) as AssistantMessage | undefined
      if (!am) return
      schedulePersist({ id: assistantMsg.id, parts: am.parts, done: am.done })
    }

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
        setMessages(prev => {
          const next = prev.map(m =>
            m.id === assistantMsg.id
              ? { ...m, parts: [{ type: 'error', error: err.error || '未知错误' } as MemoryStreamChunk], done: true }
              : m
          )
          persistFromState(next)
          return next
        })
        return
      }

      const reader = res.body?.getReader()
      if (!reader) {
        setMessages(prev => {
          const next = prev.map(m =>
            m.id === assistantMsg.id
              ? { ...m, parts: [{ type: 'error', error: '无法读取响应流' } as MemoryStreamChunk], done: true }
              : m
          )
          persistFromState(next)
          return next
        })
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
            setMessages(prev => {
              const next = prev.map(m =>
                m.id === assistantMsg.id
                  ? {
                      ...m,
                      parts: [...(m as AssistantMessage).parts, chunk],
                      done: chunk.type === 'finish' || chunk.type === 'error',
                    }
                  : m
              )
              persistFromState(next)
              return next
            })

            if (chunk.type === 'finish' || chunk.type === 'error') {
              return
            }
          } catch {
            // Skip unparseable SSE data
          }
        }
      }

      setMessages(prev => {
        const next = prev.map(m =>
          m.id === assistantMsg.id ? { ...m, done: true } : m
        )
        persistFromState(next)
        return next
      })
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        setMessages(prev => {
          const next = prev.map(m =>
            m.id === assistantMsg.id ? { ...m, done: true } : m
          )
          persistFromState(next)
          return next
        })
      } else {
        setMessages(prev => {
          const next = prev.map(m =>
            m.id === assistantMsg.id
              ? {
                  ...m,
                  parts: [...(m as AssistantMessage).parts, { type: 'error', error: (error as Error).message || '连接错误' } as MemoryStreamChunk],
                  done: true,
                }
              : m
          )
          persistFromState(next)
          return next
        })
      }
    } finally {
      setIsStreaming(false)
      abortRef.current = null
      // 终态：强制把最后一次 snap 立刻 flush 到 IDB，覆盖可能的 200ms debounce 未到
      flushPersist()
    }
  }

  const stopGeneration = () => {
    abortRef.current?.abort()
  }

  // ─── 会话操作 ───
  const selectConversation = async (id: string) => {
    if (id === activeId) {
      setSidebarOpen(false)
      return
    }
    if (isStreaming) abortRef.current?.abort()
    setActiveId(id)
    setSidebarOpen(false)
    const persisted = await loadMessages(id)
    const restored: ChatMessage[] = persisted.map(m => {
      if (m.role === 'user') {
        return { id: m.id, role: 'user', content: m.content } as UserMessage
      }
      return {
        id: m.id, role: 'assistant', parts: m.parts ?? [], done: m.done,
      } as AssistantMessage
    })
    setMessages(restored)
  }

  const newConversation = () => {
    if (isStreaming) abortRef.current?.abort()
    setActiveId(null)
    setMessages([])
    setSidebarOpen(false)
  }

  const handleRename = async (id: string, title: string) => {
    await renameConversation(id, title)
    setConversations(prev =>
      prev.map(c => c.id === id ? { ...c, title } : c)
    )
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('删除此对话？')) return
    await deleteConversation(id)
    setConversations(prev => prev.filter(c => c.id !== id))
    if (activeId === id) {
      setActiveId(null)
      setMessages([])
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // 第一条助手消息按出现顺序（保留用于将来可能的差异化）—— 当前 drop cap 每条都给
  // const firstAssistantId = messages.find(m => m.role === 'assistant')?.id

  return (
    <div className="flex flex-col h-full bg-paper">
      {/* ── Scroll container（包整个 scene + 输入栏顶部按钮在内的可滚动主体） ── */}
      <div className="flex-1 min-h-0 overflow-y-auto">

        {/* ── Scene chrome：左上「对话」抽屉触发；右上「open in editor」 ── */}
        <div className="relative">
          <div className="absolute top-6 left-8 z-10">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="font-mono text-[10.5px] text-ink-faint hover:text-clay transition-colors cursor-pointer tracking-[0.14em] lowercase"
              aria-label="打开对话列表"
            >
              〔 对话{conversations.length > 0 ? ` · ${conversations.length}` : ''} 〕
            </button>
          </div>
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
                    <span className="font-mono">manuscripts/</span> 来回答你的问题，或是帮助你整理修改 <span className="font-mono">memory/</span>
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
                  | { kind: 'tool-pair'; key: string; pair: ToolPair }
                  | { kind: 'error'; key: string; error: string }

                const segments: Segment[] = []
                // toolCallId → segments 数组下标，方便后续 result 来时回填同一格
                const pairIndex = new Map<string, number>()
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
                      // skip
                    } else if (p.type === 'tool-call') {
                      flushText(i); flushReasoning(i)
                      const pair: ToolPair = {
                        toolCallId: p.toolCallId,
                        toolName: p.toolName,
                        args: p.args,
                      }
                      pairIndex.set(p.toolCallId, segments.length)
                      segments.push({ kind: 'tool-pair', key: `${msg.id}-tp${i}`, pair })
                    } else if (p.type === 'tool-result') {
                      // 找到对应的 tool-call segment 把 result 填回去
                      const idx = pairIndex.get(p.toolCallId)
                      if (idx !== undefined) {
                        const seg = segments[idx]
                        if (seg && seg.kind === 'tool-pair') {
                          seg.pair.result = p.result
                          seg.pair.isError = p.isError
                          // toolName 通常一致，但 result 可能携带更准的 name
                          if (p.toolName) seg.pair.toolName = p.toolName
                        }
                      } else {
                        // 孤立 result（极少见）—— 单独成一个 pair 显示
                        flushText(i); flushReasoning(i)
                        segments.push({
                          kind: 'tool-pair',
                          key: `${msg.id}-tp${i}`,
                          pair: {
                            toolCallId: p.toolCallId,
                            toolName: p.toolName,
                            args: undefined,
                            result: p.result,
                            isError: p.isError,
                          },
                        })
                      }
                    } else if (p.type === 'error') {
                      flushText(i); flushReasoning(i)
                      segments.push({ kind: 'error', key: `${msg.id}-er${i}`, error: p.error })
                    }
                  }
                  flushText(msg.parts.length)
                  flushReasoning(msg.parts.length)
                }

                // drop cap：每条助手消息的第一个 text 段都加
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
                            const isFirstText = textIndexInMsg === 0
                            textIndexInMsg += 1
                            return <Prose key={seg.key} first={isFirstText}>{seg.text}</Prose>
                          }
                          if (seg.kind === 'reasoning') {
                            return <Reasoning key={seg.key} text={seg.text} />
                          }
                          if (seg.kind === 'tool-pair') {
                            const { pair } = seg
                            // 摘要：优先用 args 里的 path/query/...，否则用 result 字数
                            const detail =
                              toolDetailFromArgs(pair.args) ||
                              (pair.result !== undefined ? toolDetailFromResult(pair.result) : '')
                            return (
                              <ToolCite
                                key={seg.key}
                                name={pair.toolName}
                                detail={detail}
                                isError={pair.isError}
                                onClick={() => setOpenPair(pair)}
                              />
                            )
                          }
                          if (seg.kind === 'error') {
                            return <ErrorLine key={seg.key} error={seg.error} />
                          }
                          return null
                        })}

                        {!msg.done && isStreaming && (
                          <div className="mt-3 font-display italic text-[13px] text-ink-faint">
                            <span className="inline-block animate-pulse">— 正在响应…</span>
                          </div>
                        )}
                        {!msg.done && !isStreaming && (
                          <div className="mt-3 font-display italic text-[13px] text-ink-faint">
                            — 此响应未完成
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

      {/* ── Tool detail drawer ── */}
      <ToolDrawer pair={openPair} onClose={() => setOpenPair(null)} />

      {/* ── Conversations sidebar ── */}
      <ConversationsSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        conversations={conversations}
        activeId={activeId}
        persistenceOk={persistenceOk}
        onSelect={selectConversation}
        onNew={newConversation}
        onRename={handleRename}
        onDelete={handleDelete}
      />
    </div>
  )
}

// ── Turn divider —— 36px 外距 + 1px hairline，连接两次对话
function TurnDivider() {
  return <div className="my-9 h-px bg-rule" />
}
