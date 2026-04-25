'use client'
import dynamic from 'next/dynamic'
import { useStore } from '@/store/useStore'
import { FloatingPanel } from '@/components/FloatingPanel'
import { RunButton } from '@/components/RunButton'
import { Skeleton } from '@/components/ui/skeleton'

const Canvas = dynamic(() => import('@/components/Canvas'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center">
      <Skeleton className="w-full h-full" />
    </div>
  ),
})

export default function Home() {
  const selectedNodeId = useStore((s) => s.selectedNodeId)
  const floatingPanelOpen = useStore((s) => s.floatingPanelOpen)
  const selectNode = useStore((s) => s.selectNode)

  return (
    <>
      <Canvas />
      <RunButton />
      <FloatingPanel
        nodeId={selectedNodeId}
        open={floatingPanelOpen}
        onOpenChange={(open) => selectNode(open ? selectedNodeId : null)}
      />
    </>
  )
}
