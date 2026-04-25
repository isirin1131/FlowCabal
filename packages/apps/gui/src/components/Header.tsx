'use client'
import { useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useStore } from '@/store/useStore'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Brain, FileText, List } from 'lucide-react'

export function Header() {
  const workspaces = useStore((s) => s.workspaces)
  const activeWorkspace = useStore((s) => s.activeWorkspace)
  const switchWorkspace = useStore((s) => s.switchWorkspace)
  const createWorkspace = useStore((s) => s.createWorkspace)

  const handleCreateWorkspace = useCallback(() => {
    const name = `Workspace ${workspaces.length + 1}`
    createWorkspace(name)
  }, [createWorkspace, workspaces.length])

  return (
    <header className="h-12 border-b bg-card flex items-center px-4 gap-4 shrink-0">
      <Link href="/" className="font-semibold text-sm mr-2">
        FlowCabal
      </Link>

      <div className="w-[200px]">
        <Select
          value={activeWorkspace?.id || ''}
          onValueChange={switchWorkspace}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="选择 workspace" />
          </SelectTrigger>
          <SelectContent>
            {workspaces.map((ws) => (
              <SelectItem key={ws.id} value={ws.id}>
                {ws.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button variant="outline" size="sm" onClick={handleCreateWorkspace}>
        <Plus className="w-4 h-4" /> New
      </Button>

      <div className="flex-1" />

      <nav className="flex items-center gap-1">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/outputs">
            <List className="w-4 h-4" /> Outputs
          </Link>
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/memory">
            <Brain className="w-4 h-4" /> Memory
          </Link>
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/manuscripts">
            <FileText className="w-4 h-4" /> Manuscripts
          </Link>
        </Button>
      </nav>
    </header>
  )
}
