'use client'
import { useStore } from '@/store/useStore'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Copy, X } from 'lucide-react'
import type { NodeDef } from '@flowcabal/engine'

export default function PinnedOutputsPage() {
  const pinnedOutputs = useStore((s) => s.pinnedOutputs)
  const activeWorkspace = useStore((s) => s.activeWorkspace)
  const togglePinOutput = useStore((s) => s.togglePinOutput)
  const outputs = activeWorkspace?.outputs

  return (
    <div className="p-6 overflow-auto h-full">
      <h1 className="text-2xl font-semibold mb-6">固定输出</h1>
      {pinnedOutputs.length === 0 && <p className="text-muted-foreground">暂无固定的输出。</p>}
      <div className="flex flex-col gap-4">
        {pinnedOutputs.map((nodeId) => {
          const node = activeWorkspace?.nodes.find((n: NodeDef) => n.id === nodeId)
          const output = outputs?.get(nodeId)
          return (
            <Card key={nodeId}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">{node?.label}</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => togglePinOutput(nodeId)}>
                  <X className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-sm font-mono bg-muted p-3 rounded-lg max-h-[300px]">
                  {output || '（无输出）'}
                </pre>
                <Button variant="outline" size="sm" className="mt-2"
                  onClick={() => navigator.clipboard.writeText(output || '')}>
                  <Copy className="w-4 h-4" /> 复制
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
