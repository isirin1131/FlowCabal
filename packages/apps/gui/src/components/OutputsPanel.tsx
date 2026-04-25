'use client'
import { useStore } from '@/store/useStore'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { NodeDef } from '@flowcabal/engine'

export function OutputsPanel() {
  const activeWorkspace = useStore((s) => s.activeWorkspace)
  const selectedNodeId = useStore((s) => s.selectedNodeId)
  if (!selectedNodeId || !activeWorkspace) {
    return <p className="text-muted-foreground">未选择节点</p>
  }
  const node = activeWorkspace.nodes.find((n: NodeDef) => n.id === selectedNodeId)
  const output = activeWorkspace.outputs.get(selectedNodeId)
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-semibold">{node?.label || '未知节点'} 的输出</h3>
      <ScrollArea className="max-h-[40vh]">
        <pre className="whitespace-pre-wrap text-sm font-mono bg-muted p-3 rounded-lg">
          {output || '（无输出）'}
        </pre>
      </ScrollArea>
    </div>
  )
}
