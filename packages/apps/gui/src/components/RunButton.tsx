'use client'
import { useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Play } from 'lucide-react'
import { useStore } from '@/store/useStore'

export function RunButton() {
  const runAll = useStore((s) => s.runAll)
  const isLoading = useStore((s) => s.isLoading)
  const nodes = useStore((s) => s.nodes)
  const activeWorkspace = useStore((s) => s.activeWorkspace)

  const handleRun = useCallback(() => {
    runAll()
  }, [runAll])

  const hasNodes = nodes.length > 0
  const disabled = isLoading || !activeWorkspace || !hasNodes

  return (
    <Button
      onClick={handleRun}
      disabled={disabled}
      className={`fixed bottom-6 right-6 shadow-lg z-10 transition-all duration-300 ${disabled ? '' : 'animate-pulse-glow'}`}
      size="lg"
    >
      {isLoading ? (
        <>
          <Spinner data-icon="inline-start" />
          运行中...
        </>
      ) : (
        <>
          <Play data-icon="inline-start" className="fill-current" />
          Run
        </>
      )}
    </Button>
  )
}
