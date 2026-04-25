'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Send } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function MemoryPage() {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return
    const userMsg = { role: 'user', content: input }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsLoading(true)
    try {
      const res = await fetch('/api/memory/chat', {
        method: 'POST',
        body: JSON.stringify({ messages: [...messages, userMsg] }),
      })
      const data = await res.json()
      setMessages((prev) => [...prev, { role: 'assistant', content: data.response }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-4">
        <div className="flex flex-col gap-4">
          {messages.map((msg, i) => (
            <div key={i} className={cn(
              'p-3 rounded-lg max-w-[80%]',
              msg.role === 'user' ? 'bg-primary text-primary-foreground ml-auto' : 'bg-muted',
            )}>{msg.content}</div>
          ))}
        </div>
      </ScrollArea>
      <div className="p-4 border-t flex gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          placeholder="输入消息..."
          className="min-h-[44px]"
        />
        <Button size="icon" onClick={sendMessage} disabled={isLoading}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
