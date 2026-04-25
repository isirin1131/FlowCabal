'use client'
import { useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EditorPanel } from './EditorPanel'
import { OutputsPanel } from './OutputsPanel'
import { ConfigPanel } from './ConfigPanel'

export function FloatingPanel({ nodeId, open, onOpenChange }: {
  nodeId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [tab, setTab] = useState<string>('editor')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[70vh] p-0 gap-0">
        <DialogTitle className="sr-only">节点面板</DialogTitle>
        <div className="px-4 py-2 border-b">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="editor">编辑器</TabsTrigger>
              <TabsTrigger value="outputs">输出</TabsTrigger>
              <TabsTrigger value="config">配置</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {tab === 'editor' && nodeId && <EditorPanel nodeId={nodeId} />}
          {tab === 'outputs' && <OutputsPanel />}
          {tab === 'config' && <ConfigPanel />}
        </div>
      </DialogContent>
    </Dialog>
  )
}
