'use client'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function Prose({ children, first }: { children: string; first?: boolean }) {
  return (
    <div className={`fc-prose font-display text-[16px] leading-[1.7] text-ink ${first ? 'fc-prose-first' : ''}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {children}
      </ReactMarkdown>
    </div>
  )
}
