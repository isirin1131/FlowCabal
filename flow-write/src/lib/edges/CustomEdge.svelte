<script lang="ts">
  import { getBezierPath, BaseEdge, type EdgeProps } from '@xyflow/svelte';

  type $$Props = EdgeProps;

  let {
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = '',
    selected = false
  }: $$Props = $props();

  const path = $derived.by(() => getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })[0]);

  const edgeStyle = $derived(`${style}; ${selected ? 'stroke: var(--flow-primary);' : ''}`);
</script>

<BaseEdge path={path} style={edgeStyle} />
