<script lang="ts">
  import { Handle, Position } from '@xyflow/svelte';

  interface NodeData {
    label?: string;
    status?: string;
    provider?: string;
    model?: string;
  }

  let { data, selected = false }: { data: NodeData; selected?: boolean } = $props();

  const status = $derived(data.status || 'idle');
  const label = $derived(data.label || 'LLM Node');
  const provider = $derived(data.provider || 'OpenAI');
</script>

<div class="custom-node" class:selected>
  <div class="custom-node-header">
    <div class="custom-node-icon" style="background: linear-gradient(135deg, #0ea5e9, #8b5cf6);">
      🤖
    </div>
    <span class="custom-node-title">{label}</span>
    <span class="custom-node-status {status}">{status}</span>
  </div>

  <div class="node-content">
    <div class="node-field">
      <span class="field-label">Provider:</span>
      <span class="field-value">{provider}</span>
    </div>
    {#if data.model}
      <div class="node-field">
        <span class="field-label">Model:</span>
        <span class="field-value">{data.model}</span>
      </div>
    {/if}
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
    border-color: var(--flow-primary);
    box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.3);
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

  .custom-node-status {
    margin-left: auto;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 500;
    text-transform: capitalize;
  }

  .custom-node-status.idle {
    background: #f1f5f9;
    color: #64748b;
  }

  .custom-node-status.pending {
    background: #fef3c7;
    color: #d97706;
  }

  .custom-node-status.running {
    background: #dbeafe;
    color: #2563eb;
    animation: pulse 2s infinite;
  }

  .custom-node-status.completed {
    background: #dcfce7;
    color: #16a34a;
  }

  .custom-node-status.error {
    background: #fee2e2;
    color: #dc2626;
  }

  .node-content {
    font-size: 12px;
    color: #64748b;
  }

  .node-field {
    display: flex;
    justify-content: space-between;
    padding: 2px 0;
  }

  .field-label {
    color: #94a3b8;
  }

  .field-value {
    color: var(--flow-text);
    font-weight: 500;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }
</style>
