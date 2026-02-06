<script lang="ts">
  import { Handle, Position } from '@xyflow/svelte';

  interface NodeData {
    label?: string;
    inputType?: string;
  }

  let { data, selected = false }: { data: NodeData; selected?: boolean } = $props();

  const label = $derived(data.label || 'Input');
</script>

<div class="custom-node input-node" class:selected>
  <div class="custom-node-header">
    <div class="custom-node-icon" style="background: linear-gradient(135deg, #f59e0b, #d97706);">
      📥
    </div>
    <span class="custom-node-title">{label}</span>
  </div>

  <div class="node-content">
    <span class="input-type">{data.inputType || 'text'}</span>
  </div>

  <Handle type="source" position={Position.Right} />
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
    border-color: var(--flow-warning);
    box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.3);
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

  .input-type {
    text-transform: capitalize;
  }
</style>
