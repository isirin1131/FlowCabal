<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  let {
    selectedNodesCount = 0,
    selectedEdgesCount = 0,
    darkMode = false,
    layoutDirection = 'TB'
  }: {
    selectedNodesCount: number;
    selectedEdgesCount: number;
    darkMode: boolean;
    layoutDirection: 'TB' | 'LR';
  } = $props();

  function handleAction(action: string) {
    dispatch('action', action);
  }
</script>

<div class="toolbar">
  <button
    class="toolbar-button"
    onclick={() => handleAction('layout')}
    title="Auto Layout"
  >
    <span>📐</span>
    <span>Layout</span>
  </button>

  <button
    class="toolbar-button"
    onclick={() => handleAction('layout-tb')}
    class:active={layoutDirection === 'TB'}
    title="Top to Bottom"
  >
    <span>⬇️</span>
  </button>

  <button
    class="toolbar-button"
    onclick={() => handleAction('layout-lr')}
    class:active={layoutDirection === 'LR'}
    title="Left to Right"
  >
    <span>➡️</span>
  </button>

  <div class="toolbar-divider"></div>

  <button
    class="toolbar-button"
    onclick={() => handleAction('execute')}
    title="Execute Workflow"
  >
    <span>▶️</span>
    <span>Run</span>
  </button>

  <button
    class="toolbar-button"
    onclick={() => handleAction('validate')}
    title="Validate Workflow"
  >
    <span>✅</span>
    <span>Validate</span>
  </button>

  <div class="toolbar-divider"></div>

  <button
    class="toolbar-button"
    onclick={() => handleAction('zoom-in')}
    title="Zoom In"
  >
    <span>🔍+</span>
  </button>

  <button
    class="toolbar-button"
    onclick={() => handleAction('zoom-out')}
    title="Zoom Out"
  >
    <span>🔍-</span>
  </button>

  <button
    class="toolbar-button"
    onclick={() => handleAction('fit-view')}
    title="Fit View"
  >
    <span>🎯</span>
  </button>

  <div class="toolbar-divider"></div>

  <button
    class="toolbar-button"
    onclick={() => handleAction('dark-mode')}
    class:active={darkMode}
    title="Toggle Dark Mode"
  >
    <span>{darkMode ? '☀️' : '🌙'}</span>
  </button>

  {#if selectedNodesCount > 0 || selectedEdgesCount > 0}
    <div class="toolbar-divider"></div>
    <div class="selection-info">
      <span>{selectedNodesCount} node{selectedNodesCount !== 1 ? 's' : ''}</span>
      <span>, </span>
      <span>{selectedEdgesCount} edge{selectedEdgesCount !== 1 ? 's' : ''}</span>
    </div>
  {/if}
</div>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--flow-bg);
    border-bottom: 1px solid var(--flow-border);
    flex-wrap: wrap;
  }

  .toolbar-button {
    padding: 6px 10px;
    border-radius: 6px;
    border: 1px solid var(--flow-border);
    background: var(--flow-bg);
    color: var(--flow-text);
    cursor: pointer;
    font-size: 13px;
    transition: all 0.15s;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .toolbar-button:hover {
    background: rgba(14, 165, 233, 0.1);
    border-color: var(--flow-primary);
  }

  .toolbar-button.active {
    background: var(--flow-primary);
    color: white;
    border-color: var(--flow-primary);
  }

  .toolbar-divider {
    width: 1px;
    height: 24px;
    background: var(--flow-border);
    margin: 0 4px;
  }

  .selection-info {
    font-size: 12px;
    color: #64748b;
    display: flex;
    gap: 2px;
  }
</style>
