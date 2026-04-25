'use client'
import { useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Play } from 'lucide-react'
import { useStore } from '@/store/useStore'

export function RunButton() {
  const runAll = useStore((s) => s.runAll)
  const isLoading = useStore((s) => s.isLoading)

  const handleRun = useCallback(() => {
    runAll()
  }, [runAll])

  return (
    <Button
      onClick={handleRun}
      disabled={isLoading}
      className="fixed bottom-6 right-6 shadow-lg z-10"
      size="lg"
    >
      {isLoading ? (
        <Spinner data-icon="inline-start" />
      ) : (
        <Play data-icon="inline-start" />
      )}
      {isLoading ? '运行中...' : 'Run'}
    </Button>
  )
}
