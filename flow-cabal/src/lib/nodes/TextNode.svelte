<script lang="ts">
  import { Handle, Position } from '@xyflow/svelte';

  interface NodeData {
    label?: string;
    text?: string;
  }

  let { data, selected = false }: { data: NodeData; selected?: boolean } = $props();

  const label = $derived(data.label || 'Text Node');
  const text = $derived(data.text || '');
  const preview = $derived(text.length > 50 ? text.substring(0, 50) + '...' : text || 'Empty text');
</script>

<div class="custom-node" class:selected>
  <div class="custom-node-header">
    <div class="custom-node-icon" style="background: linear-gradient(135deg, #22c55e, #16a34a);">
      📝
    </div>
    <span class="custom-node-title">{label}</span>
  </div>

  <div class="node-content">
    <p class="text-preview">{preview}</p>
  </div>

  <Handle type="target" position={Position.Left} />
  <Handle type="source" position={Position.Right} />
</div>

<style>
  .custom-node {
    padding: 12px 16px;
    border-radius: 8px;
    background: var(--flow-bg);
    border: 1px solid var(--flow-border);
    min-width: 180px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    transition: all 0.2s;
  }

  .custom-node:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  }

  .custom-node.selected {
    border-color: var(--flow-success);
    box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.3);
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

  .text-preview {
    margin: 0;
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
