import { type EdgeProps, BaseEdge, getSmoothStepPath } from '@xyflow/react'

export function CustomEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  id,
}: EdgeProps) {
  const adjustedSourceY = sourceY + 5
  const adjustedTargetY = targetY - 8
  const [linePath] = getSmoothStepPath({
    sourceX,
    sourceY: adjustedSourceY,
    sourcePosition,
    targetX,
    targetY: adjustedTargetY,
    targetPosition,
    borderRadius: 12,
  })
  return (
    <>
      <line
        x1={sourceX - 8}
        y1={sourceY + 3}
        x2={sourceX + 8}
        y2={sourceY + 3}
        stroke="#8A4732"
        strokeWidth={2}
        strokeLinecap="square"
      />
      <BaseEdge id={id} path={linePath} style={{ stroke: '#C9BFAA', strokeWidth: 1, fill: 'none' }} />
    </>
  )
}
