'use client'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Trash2, Plus } from 'lucide-react'
import { useStore } from '@/store/useStore'
import type { TextBlock, NodeDef } from '@flowcabal/engine'

export function EditorPanel({ nodeId }: { nodeId: string }) {
  const activeWorkspace = useStore((s) => s.activeWorkspace)
  const updateBlock = useStore((s) => s.updateBlock)
  const addBlock = useStore((s) => s.addBlock)
  const removeBlock = useStore((s) => s.removeBlock)
  const node = activeWorkspace?.nodes.find((n: NodeDef) => n.id === nodeId)
  if (!node) return null

  const renderBlocks = (blocks: TextBlock[], isSystem: boolean) => (
    <div className="flex flex-col gap-2">
      {blocks.map((block, i) => (
        <div key={i} className="p-3 bg-muted rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <Badge variant="secondary">{i + 1}. {block.kind}</Badge>
            <Button variant="ghost" size="icon" onClick={() => removeBlock(nodeId, isSystem, i)} className="text-destructive">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
          {block.kind === 'literal' && (
            <Textarea
              defaultValue={block.content}
              onBlur={(e) => updateBlock(nodeId, isSystem, i, { kind: 'literal', content: e.target.value })}
              className="min-h-[80px]"
            />
          )}
          {block.kind === 'agent-inject' && (
            <Textarea
              defaultValue={block.hint}
              placeholder="提示..."
              onBlur={(e) => updateBlock(nodeId, isSystem, i, { kind: 'agent-inject', hint: e.target.value })}
              className="min-h-[60px]"
            />
          )}
        </div>
      ))}
    </div>
  )

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex justify-between mb-3">
          <h3 className="font-semibold">系统提示</h3>
          <Button variant="outline" size="sm" onClick={() => addBlock(nodeId, { kind: 'literal', content: '' }, true)}>
            <Plus className="w-4 h-4" /> 添加
          </Button>
        </div>
        {renderBlocks(node.systemPrompt, true)}
      </div>
      <div>
        <div className="flex justify-between mb-3">
          <h3 className="font-semibold">用户提示</h3>
          <Button variant="outline" size="sm" onClick={() => addBlock(nodeId, { kind: 'literal', content: '' }, false)}>
            <Plus className="w-4 h-4" /> 添加
          </Button>
        </div>
        {renderBlocks(node.userPrompt, false)}
      </div>
    </div>
  )
}
