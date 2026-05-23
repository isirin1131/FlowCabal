import { type EdgeProps, BaseEdge, getStraightPath } from '@xyflow/react'

export function CustomEdge({ sourceX, sourceY, targetX, targetY, id }: EdgeProps) {
  const adjustedSourceY = sourceY + 5
  const adjustedTargetY = targetY - 8
  const [linePath] = getStraightPath({
    sourceX,
    sourceY: adjustedSourceY,
    targetX,
    targetY: adjustedTargetY,
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
      <BaseEdge id={id} path={linePath} style={{ stroke: '#C9BFAA', strokeWidth: 1 }} />
    </>
  )
}
