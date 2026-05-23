'use client'
import { useCallback, useState } from 'react'
import Link from 'next/link'
import { useStore } from '@/store/useStore'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SettingsDialog } from '@/components/SettingsDialog'

export function Header() {
  const workspaces = useStore((s) => s.workspaces)
  const activeWorkspace = useStore((s) => s.activeWorkspace)
  const switchWorkspace = useStore((s) => s.switchWorkspace)
  const createWorkspace = useStore((s) => s.createWorkspace)
  const runAll = useStore((s) => s.runAll)
  const isLoading = useStore((s) => s.isLoading)
  const nodes = useStore((s) => s.nodes)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const handleCreateWorkspace = useCallback(() => {
    const name = `Workspace ${workspaces.length + 1}`
    createWorkspace(name)
  }, [createWorkspace, workspaces.length])

  const canRun = !isLoading && !!activeWorkspace && nodes.length > 0

  return (
    <header className="h-16 border-b border-rule flex items-center px-7 gap-7 shrink-0 bg-paper relative z-10">
      <Link
        href="/"
        className="font-display text-[13px] font-semibold uppercase text-ink"
        style={{ letterSpacing: '0.14em' }}
      >
        Flowcabal
      </Link>

      {/* workspace pill */}
      <div className="flex items-baseline gap-[10px] text-ink-soft">
        <span
          className="font-display text-[18px] text-rule font-normal"
          aria-hidden="true"
        >
          /
        </span>
        <Select
          value={activeWorkspace?.id || ''}
          onValueChange={switchWorkspace}
        >
          <SelectTrigger
            className="!h-auto !border-0 !bg-transparent !p-0 !shadow-none !ring-0 hover:!bg-transparent focus:!ring-0 focus-visible:!outline-none gap-1.5 font-display text-[16px] italic text-ink !w-auto"
          >
            <SelectValue placeholder="未选择 workspace">
              {activeWorkspace?.name}
            </SelectValue>
          </SelectTrigger>
          <SelectContent
            align="start"
            className="bg-paper border-rule font-display"
          >
            {workspaces.length === 0 && (
              <div className="px-3 py-2 text-[13px] italic text-ink-faint">
                — 暂无 workspace —
              </div>
            )}
            {workspaces.map((ws) => (
              <SelectItem
                key={ws.id}
                value={ws.id}
                className="font-display italic text-[14px]"
              >
                {ws.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <nav className="ml-auto flex items-center gap-[14px] font-body text-[13px] text-ink-soft">
        <NavLink href="/memory">memory</NavLink>
        <Sep />
        <NavLink href="/manuscripts">manuscripts</NavLink>
        <Sep />

        <DropdownMenu>
          <DropdownMenuTrigger
            className="text-ink-faint hover:text-ink text-[16px] leading-none px-1 cursor-pointer outline-none focus-visible:text-clay"
            aria-label="更多"
          >
            ⋯
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="bg-paper border-rule min-w-[160px] font-body text-[13px]"
          >
            <DropdownMenuItem
              onClick={handleCreateWorkspace}
              className="text-ink hover:!bg-clay-faint hover:!text-clay-deep cursor-pointer"
            >
              新建 workspace
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-rule-soft" />
            <DropdownMenuItem
              onClick={() => setSettingsOpen(true)}
              className="text-ink hover:!bg-clay-faint hover:!text-clay-deep cursor-pointer"
            >
              设置...
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          type="button"
          onClick={() => canRun && runAll()}
          disabled={!canRun}
          className="font-display text-[14px] text-clay border-b border-clay pb-[2px] ml-2 disabled:opacity-40 disabled:cursor-not-allowed hover:text-clay-deep hover:border-clay-deep transition-colors duration-200"
          style={{ letterSpacing: '0.02em' }}
        >
          {isLoading ? '正在拟稿…' : '付印'}
        </button>
      </nav>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </header>
  )
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-ink-soft hover:text-ink relative pb-[2px] [&::after]:content-[''] [&::after]:absolute [&::after]:left-0 [&::after]:right-0 [&::after]:-bottom-px [&::after]:h-px [&::after]:bg-clay [&::after]:scale-x-0 [&::after]:origin-left [&::after]:transition-transform [&::after]:duration-200 hover:[&::after]:scale-x-100"
    >
      {children}
    </Link>
  )
}

function Sep() {
  return <span className="text-rule select-none" aria-hidden="true">·</span>
}
