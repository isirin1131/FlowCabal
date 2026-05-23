'use client'
import { useStore, toRoman } from '@/store/useStore'
import type { TextBlock, NodeDef } from '@flowcabal/engine'

function SceneLabel({ text }: { text: string }) {
  return (
    <div className="text-center mb-6 select-none">
      <span className="font-mono text-[10.5px] text-ink-faint tracking-[0.18em] lowercase">
        <span className="text-rule mr-[18px] tracking-[-1px]">— —</span>
        {text}
        <span className="text-rule ml-[18px] tracking-[-1px]">— —</span>
      </span>
    </div>
  )
}

export function EditorPanel({ nodeId }: { nodeId: string }) {
  const activeWorkspace = useStore((s) => s.activeWorkspace)
  const updateBlock = useStore((s) => s.updateBlock)
  const addBlock = useStore((s) => s.addBlock)
  const removeBlock = useStore((s) => s.removeBlock)

  const node = activeWorkspace?.nodes.find((n: NodeDef) => n.id === nodeId)
  if (!node || !activeWorkspace) {
    return (
      <div className="max-w-[680px] mx-auto text-center py-12">
        <p className="font-display italic text-[14.5px] text-ink-soft">— 节点未找到 —</p>
      </div>
    )
  }

  const upstreamRoman = (sourceId: string): string => {
    const i = activeWorkspace.nodes.findIndex((n: NodeDef) => n.id === sourceId)
    return i >= 0 ? toRoman(i + 1) : '—'
  }
  const upstreamLabel = (sourceId: string): string => {
    const n = activeWorkspace.nodes.find((n: NodeDef) => n.id === sourceId)
    return n?.label || sourceId
  }

  const renderBlock = (block: TextBlock, i: number, isSystem: boolean) => {
    const kindLabel =
      block.kind === 'ref'
        ? `ref → ${upstreamRoman(block.nodeId)}`
        : block.kind
    return (
      <div
        key={i}
        className="bg-paper-deep border border-rule rounded-md mb-3 last:mb-0"
      >
        <div className="px-4 py-2 border-b border-rule-soft flex items-baseline justify-between">
          <span className="font-mono text-[11px] text-ink-faint tracking-wide lowercase">
            {i + 1} · {kindLabel}
          </span>
          <button
            type="button"
            onClick={() => removeBlock(nodeId, isSystem, i)}
            className="font-display text-[16px] leading-none text-ink-faint hover:text-error transition-colors cursor-pointer"
            aria-label="删除段落"
          >
            ×
          </button>
        </div>
        <div className="px-4 py-3">
          {block.kind === 'literal' && (
            <textarea
              defaultValue={block.content}
              onBlur={(e) => updateBlock(nodeId, isSystem, i, { kind: 'literal', content: e.target.value })}
              className="block w-full bg-transparent outline-none resize-none border-0 font-display text-[15px] text-ink leading-[1.65] min-h-[80px]"
              style={{ fieldSizing: 'content' } as React.CSSProperties}
            />
          )}
          {block.kind === 'agent-inject' && (
            <textarea
              defaultValue={block.hint}
              placeholder="向 agent 描述要注入的内容…"
              onBlur={(e) => updateBlock(nodeId, isSystem, i, { kind: 'agent-inject', hint: e.target.value })}
              className="block w-full bg-transparent outline-none resize-none border-0 font-display italic text-[14.5px] text-ink-soft leading-[1.65] min-h-[60px] placeholder:text-ink-faint placeholder:italic"
              style={{ fieldSizing: 'content' } as React.CSSProperties}
            />
          )}
          {block.kind === 'ref' && (
            <div className="font-display italic text-[14.5px] text-ink-soft leading-[1.65]">
              引自 {upstreamRoman(block.nodeId)} · {upstreamLabel(block.nodeId)}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-[680px] mx-auto flex flex-col gap-12">
      <section>
        <SceneLabel text="system prompt" />
        <div>
          {node.systemPrompt.map((b, i) => renderBlock(b, i, true))}
        </div>
        <div className="mt-3 text-right">
          <button
            type="button"
            onClick={() => addBlock(nodeId, { kind: 'literal', content: '' }, true)}
            className="font-display italic text-[14px] text-clay hover:text-clay-deep transition-colors cursor-pointer"
          >
            + 添加段落
          </button>
        </div>
      </section>

      <section>
        <SceneLabel text="user prompt" />
        <div>
          {node.userPrompt.map((b, i) => renderBlock(b, i, false))}
        </div>
        <div className="mt-3 text-right">
          <button
            type="button"
            onClick={() => addBlock(nodeId, { kind: 'literal', content: '' }, false)}
            className="font-display italic text-[14px] text-clay hover:text-clay-deep transition-colors cursor-pointer"
          >
            + 添加段落
          </button>
        </div>
      </section>
    </div>
  )
}
