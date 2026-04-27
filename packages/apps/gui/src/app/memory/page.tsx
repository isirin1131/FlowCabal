'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/ui/spinner'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Send, Square, Wrench, Brain, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MemoryStreamChunk } from '@flowcabal/engine'

type UserMessage = { id: string; role: 'user'; content: string }
type AssistantMessage = { id: string; role: 'assistant'; parts: MemoryStreamChunk[]; done: boolean }
type ChatMessage = UserMessage | AssistantMessage

function MessageText({ text }: { text: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none
      prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0
      prose-headings:my-2 prose-headings:text-foreground
      prose-a:text-primary prose-a:no-underline hover:prose-a:underline
      prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:before:content-none prose-code:after:content-none
      prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-pre:rounded-lg
      prose-blockquote:border-l-2 prose-blockquote:border-muted-foreground/30 prose-blockquote:pl-3 prose-blockquote:text-muted-foreground prose-blockquote:not-italic"
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {text}
      </ReactMarkdown>
    </div>
  )
}

function MessageReasoning({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(true)
  return (
    <div className="border-l-2 border-muted pl-3 py-1 my-1">
      <button
        className="flex items-center gap-1 text-xs text-muted-foreground/70 cursor-pointer hover:text-muted-foreground transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <Brain className="w-3 h-3" />
        思考过程
      </button>
      {expanded && (
        <div className="mt-1 text-xs text-muted-foreground/70 whitespace-pre-wrap leading-relaxed">
          {text}
        </div>
      )}
    </div>
  )
}

function MessageToolCall({ chunk }: { chunk: MemoryStreamChunk & { type: 'tool-call' } }) {
  const [expanded, setExpanded] = useState(true)
  return (
    <div className="text-xs border border-dashed border-status-stale/40 rounded-md p-2 my-1 bg-muted/30">
      <button
        className="flex items-center gap-1.5 cursor-pointer hover:text-foreground transition-colors w-full text-left"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
        <Wrench className="w-3 h-3 shrink-0 text-status-stale" />
        <span className="font-medium text-muted-foreground">{chunk.toolName}</span>
      </button>
      {expanded && (
        <pre className="mt-1.5 text-[11px] text-muted-foreground/70 whitespace-pre-wrap overflow-x-auto bg-muted/50 rounded p-1.5 font-mono">
          {JSON.stringify(chunk.args, null, 2)}
        </pre>
      )}
    </div>
  )
}

function MessageToolResult({ chunk }: { chunk: MemoryStreamChunk & { type: 'tool-result' } }) {
  const [expanded, setExpanded] = useState(true)
  const resultStr = typeof chunk.result === 'string' ? chunk.result : JSON.stringify(chunk.result, null, 2)
  return (
    <div className={cn(
      'text-xs border border-dashed rounded-md p-2 my-1',
      chunk.isError
        ? 'border-destructive/40 bg-destructive/5'
        : 'border-status-stale/40 bg-muted/30'
    )}>
      <button
        className="flex items-center gap-1.5 cursor-pointer hover:text-foreground transition-colors w-full text-left"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
        <Wrench className="w-3 h-3 shrink-0 text-status-stale" />
        <span className={cn('font-medium', chunk.isError ? 'text-destructive' : 'text-muted-foreground')}>
          {chunk.toolName} 结果{chunk.isError ? ' (错误)' : ''}
        </span>
        <span className="text-muted-foreground/50 ml-auto text-[10px]">
          {resultStr.length > 200 ? `${resultStr.substring(0, 200)}...` : resultStr.length} 字符
        </span>
      </button>
      {expanded && (
        <div className="mt-1.5 prose prose-sm dark:prose-invert max-w-none text-[11px]
          prose-p:my-0.5 prose-ul:my-0.5 prose-ol:my-0.5
          prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-[11px] prose-code:before:content-none prose-code:after:content-none
          prose-pre:bg-muted/50 prose-pre:border prose-pre:rounded prose-pre:text-[11px]"
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {resultStr}
          </ReactMarkdown>
        </div>
      )}
    </div>
  )
}

function MessageStatus({ chunk }: { chunk: MemoryStreamChunk & { type: 'step-finish' | 'finish' } }) {
  if (chunk.type === 'step-finish') {
    return (
      <div className="flex items-center gap-2 my-2">
        <div className="flex-1 h-px bg-border" />
        <span className="text-[10px] text-muted-foreground/50 shrink-0">
          步骤完成 · {chunk.finishReason}
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>
    )
  }
  return null
}

function MessageError({ error }: { error: string }) {
  return (
    <div className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-md p-2 my-1">
      {error}
    </div>
  )
}

function id() {
  return Math.random().toString(36).slice(2, 10)
}

export default function MemoryPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
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

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 min-h-0 overflow-hidden">
        <div ref={scrollRef} className="flex flex-col gap-3 p-4">
          {messages.map(msg => {
            if (msg.role === 'user') {
              return (
                <div key={msg.id} className="flex justify-end">
                  <div className="bg-primary text-primary-foreground px-4 py-2 rounded-xl rounded-br-sm max-w-[80%] text-sm whitespace-pre-wrap break-words">
                    {msg.content}
                  </div>
                </div>
              )
            }

            const segments: { type: 'text' | 'reasoning' | 'tool-call' | 'tool-result' | 'step-finish' | 'error'; key: string; text?: string; chunk?: MemoryStreamChunk & { type: 'tool-call' | 'tool-result' | 'step-finish' | 'error' } }[] = (() => {
              const result: typeof segments = []
              let textBuf = ''
              let reasoningBuf = ''

              function flushText(i: number) {
                if (textBuf) {
                  result.push({ type: 'text', key: `${msg.id}-t${i}`, text: textBuf })
                  textBuf = ''
                }
              }
              function flushReasoning(i: number) {
                if (reasoningBuf) {
                  result.push({ type: 'reasoning', key: `${msg.id}-r${i}`, text: reasoningBuf })
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
                } else if (p.type === 'tool-call-delta') {
                  // skip — complete tool-call is emitted after streaming args
                } else if (p.type === 'finish') {
                  // nothing to render
                } else {
                  flushText(i)
                  flushReasoning(i)
                  if (p.type === 'tool-call' || p.type === 'tool-result' || p.type === 'step-finish' || p.type === 'error') {
                    result.push({ type: p.type, key: `${msg.id}-p${i}`, chunk: p as typeof segments[number]['chunk'] })
                  }
                }
              }

              flushText(msg.parts.length)
              flushReasoning(msg.parts.length)
              return result
            })()

            return (
              <div key={msg.id} className="flex flex-col max-w-[85%] gap-0.5">
                {segments.map(seg => {
                  if (seg.type === 'text' && seg.text) {
                    return (
                      <div key={seg.key} className="bg-muted px-4 py-2 rounded-xl rounded-bl-sm text-sm">
                        <MessageText text={seg.text} />
                      </div>
                    )
                  }
                  if (seg.type === 'reasoning' && seg.text) {
                    return <MessageReasoning key={seg.key} text={seg.text} />
                  }
                  if (seg.type === 'tool-call' && seg.chunk) {
                    return <MessageToolCall key={seg.key} chunk={seg.chunk as MemoryStreamChunk & { type: 'tool-call' }} />
                  }
                  if (seg.type === 'tool-result' && seg.chunk) {
                    return <MessageToolResult key={seg.key} chunk={seg.chunk as MemoryStreamChunk & { type: 'tool-result' }} />
                  }
                  if (seg.type === 'step-finish' && seg.chunk) {
                    return <MessageStatus key={seg.key} chunk={seg.chunk as MemoryStreamChunk & { type: 'step-finish' }} />
                  }
                  if (seg.type === 'error' && seg.chunk) {
                    return <MessageError key={seg.key} error={(seg.chunk as MemoryStreamChunk & { type: 'error' }).error} />
                  }
                  return null
                })}

                {!msg.done && (
                  <div className="flex items-center gap-2 ml-1">
                    <Spinner className="size-3 text-muted-foreground/50" />
                    <span className="text-xs text-muted-foreground/50">生成中...</span>
                  </div>
                )}
              </div>
            )
          })}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="p-4 border-t flex gap-2 shrink-0 bg-background">
        <Textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入消息..."
          className="min-h-[44px] max-h-[120px]"
        />
        {isStreaming ? (
          <Button size="icon" variant="destructive" onClick={stopGeneration}>
            <Square className="w-4 h-4" />
          </Button>
        ) : (
          <Button size="icon" onClick={sendMessage} disabled={!input.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
