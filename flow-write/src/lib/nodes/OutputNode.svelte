<script lang="ts">
  import { Handle, Position, type NodeProps } from '@xyflow/svelte';

  type $$Props = NodeProps;

  export let data: $$Props['data'];
  export let selected: $$Props['selected'] = false;

  $: label = data.label || 'Output';
</script>

<div class="custom-node output-node" class:selected>
  <div class="custom-node-header">
    <div class="custom-node-icon" style="background: linear-gradient(135deg, #ec4899, #db2777);">
      📤
    </div>
    <span class="custom-node-title">{label}</span>
  </div>

  <div class="node-content">
    <span class="output-type">{data.outputType || 'text'}</span>
  </div>

  <Handle type="target" position={Position.Left} class="!bg-pink-500" />
</div>

<style>
  .custom-node {
    padding: 12px 16px;
    border-radius: 8px;
    background: var(--flow-bg);
    border: 1px solid var(--flow-border);
    min-width: 140px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    transition: all 0.2s;
  }

  .custom-node:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  }

  .custom-node.selected {
    border-color: #ec4899;
    box-shadow: 0 0 0 2px rgba(236, 72, 153, 0.3);
  }

  .custom-node-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .custom-node-icon {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
  }

  .custom-node-title {
    font-weight: 600;
    font-size: 14px;
    color: var(--flow-text);
  }

  .node-content {
    font-size: 12px;
    color: #64748b;
  }

  .output-type {
    text-transform: capitalize;
  }
</style>
