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
    data,
    style = ''
  }: $$Props = $props();

  const centerX = $derived((sourceX + targetX) / 2);
  const centerY = $derived((sourceY + targetY) / 2);

  const path = $derived.by(() => getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })[0]);

  const label = $derived(data?.label || '');
  const labelStyle = $derived(data?.labelStyle || '');
</script>

<BaseEdge {path} {style} />

{#if label}
  <div
    class="edge-label"
    style="transform: translate(-50%, -50%) translate({centerX}px, {centerY}px); {labelStyle}"
  >
    {label}
  </div>
{/if}

<style>
  .edge-label {
    position: absolute;
    pointer-events: all;
    background: var(--flow-bg);
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    color: var(--flow-text);
    border: 1px solid var(--flow-border);
    white-space: nowrap;
  }
</style>
