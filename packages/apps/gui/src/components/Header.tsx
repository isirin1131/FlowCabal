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
import { SettingsDialog } from '@/components/SettingsDialog'

export function Header() {
  const workspaces = useStore((s) => s.workspaces)
  const activeWorkspace = useStore((s) => s.activeWorkspace)
  const switchWorkspace = useStore((s) => s.switchWorkspace)
  const createWorkspace = useStore((s) => s.createWorkspace)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const handleSelectChange = useCallback((value: string) => {
    if (value === '__create__') {
      const name = `Workspace ${workspaces.length + 1}`
      createWorkspace(name)
    } else {
      switchWorkspace(value)
    }
  }, [createWorkspace, workspaces.length, switchWorkspace])

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
          onValueChange={handleSelectChange}
        >
          <SelectTrigger
            className="!h-auto !border-0 !bg-transparent !p-0 !shadow-none !ring-0 hover:!bg-transparent focus:!ring-0 focus-visible:!outline-none gap-1.5 font-display text-[16px] italic text-ink !w-auto"
          >
            <SelectValue placeholder="未选择 workspace" />
          </SelectTrigger>
          <SelectContent
            align="start"
            className="bg-paper border-rule font-display"
          >
            {workspaces.length === 0 ? (
              <SelectItem
                value="__create__"
                className="font-display italic text-[14px]"
              >
                新建 workspace
              </SelectItem>
            ) : (
              <>
                {workspaces.map((ws) => (
                  <SelectItem
                    key={ws.id}
                    value={ws.id}
                    className="font-display italic text-[14px]"
                  >
                    {ws.name}
                  </SelectItem>
                ))}
                <div className="mx-2 my-1 border-t border-rule-soft" />
                <SelectItem
                  value="__create__"
                  className="font-display italic text-[13px] text-ink-faint"
                >
                  + 新建 workspace
                </SelectItem>
              </>
            )}
          </SelectContent>
        </Select>
      </div>

      <nav className="ml-auto flex items-center gap-[14px] font-body text-[13px] text-ink-soft">
        <NavLink href="/memory">memory</NavLink>
        <Sep />
        <NavLink href="/manuscripts">manuscripts</NavLink>
        <Sep />

        <button
          onClick={() => setSettingsOpen(true)}
          className="text-ink-faint hover:text-ink text-[16px] leading-none px-1 cursor-pointer outline-none focus-visible:text-clay"
          aria-label="设置"
        >
          ⋯
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
