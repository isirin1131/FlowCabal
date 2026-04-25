'use client'
import { useState, useCallback } from 'react'
import { useStore } from '@/store/useStore'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Save } from 'lucide-react'
import type { NodeDef } from '@flowcabal/engine'

export function ConfigPanel() {
  const activeWorkspace = useStore((s) => s.activeWorkspace)
  const selectedNodeId = useStore((s) => s.selectedNodeId)
  const renameNode = useStore((s) => s.renameNode)
  if (!selectedNodeId || !activeWorkspace) {
    return <p className="text-muted-foreground">未选择节点</p>
  }
  const node = activeWorkspace.nodes.find((n: NodeDef) => n.id === selectedNodeId)
  if (!node) return null

  const [label, setLabel] = useState(node.label)

  const handleSave = useCallback(() => {
    if (label.trim() && label !== node.label) {
      renameNode(node.id, label.trim())
    }
  }, [label, node, renameNode])

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">节点配置</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label>节点名称</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label>节点 ID</Label>
            <Input value={node.id} disabled />
          </div>
          <Button size="sm" onClick={handleSave} disabled={label === node.label || !label.trim()}>
            <Save className="w-4 h-4" /> 保存
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
