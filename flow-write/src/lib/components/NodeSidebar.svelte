<script lang="ts">
  const nodeTypes: Array<{
    type: string;
    label: string;
    icon: string;
    color: string;
    description: string;
  }> = [
    {
      type: 'input',
      label: 'Input',
      icon: '📥',
      color: '#f59e0b',
      description: 'Start workflow with text input'
    },
    {
      type: 'llm',
      label: 'LLM Node',
      icon: '🤖',
      color: '#0ea5e9',
      description: 'Call LLM API with prompts'
    },
    {
      type: 'text',
      label: 'Text',
      icon: '📝',
      color: '#22c55e',
      description: 'Process or transform text'
    },
    {
      type: 'output',
      label: 'Output',
      icon: '📤',
      color: '#ec4899',
      description: 'Final output node'
    }
  ];

  function handleDragStart(event: DragEvent, nodeType: typeof nodeTypes[0]) {
    if (event.dataTransfer) {
      event.dataTransfer.setData('application/node-type', nodeType.type);
      event.dataTransfer.effectAllowed = 'copy';
    }
  }

  function handleDragEnd(event: DragEvent) {
    if (event.dataTransfer) {
      event.dataTransfer.clearData();
    }
  }
</script>

<div class="node-sidebar">
  <h3 class="sidebar-title">Node Types</h3>
  <p class="sidebar-subtitle">Drag to canvas</p>

  <div class="node-list">
    {#each nodeTypes as nodeType}
      <div
        class="node-sidebar-item"
        draggable="true"
        ondragstart={(e) => handleDragStart(e, nodeType)}
        ondragend={handleDragEnd}
        role="button"
        tabindex="0"
      >
        <div class="node-item-header">
          <span class="node-icon" style="background: {nodeType.color}20; color: {nodeType.color};">
            {nodeType.icon}
          </span>
          <span class="node-label">{nodeType.label}</span>
        </div>
        <p class="node-description">{nodeType.description}</p>
      </div>
    {/each}
  </div>

  <div class="sidebar-tips">
    <h4>Tips</h4>
    <ul>
      <li>Click a node to select</li>
      <li>Drag from handles to connect</li>
      <li>Right-click for options</li>
      <li>Scroll to zoom</li>
    </ul>
  </div>
</div>

<style>
  .node-sidebar {
    width: 260px;
    background: var(--flow-bg);
    border-right: 1px solid var(--flow-border);
    padding: 16px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .sidebar-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--flow-text);
    margin: 0;
  }

  .sidebar-subtitle {
    font-size: 12px;
    color: #64748b;
    margin: 0;
  }

  .node-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .node-sidebar-item {
    padding: 12px;
    background: var(--flow-bg);
    border: 1px solid var(--flow-border);
    border-radius: 8px;
    cursor: grab;
    transition: all 0.2s;
  }

  .node-sidebar-item:hover {
    border-color: var(--flow-primary);
    transform: translateX(4px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }

  .node-sidebar-item:active {
    cursor: grabbing;
  }

  .node-item-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 6px;
  }

  .node-icon {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
  }

  .node-label {
    font-weight: 600;
    font-size: 14px;
    color: var(--flow-text);
  }

  .node-description {
    font-size: 12px;
    color: #64748b;
    margin: 0;
    line-height: 1.4;
  }

  .sidebar-tips {
    margin-top: auto;
    padding: 12px;
    background: rgba(14, 165, 233, 0.05);
    border-radius: 8px;
  }

  .sidebar-tips h4 {
    font-size: 13px;
    font-weight: 600;
    color: var(--flow-text);
    margin: 0 0 8px 0;
  }

  .sidebar-tips ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .sidebar-tips li {
    font-size: 12px;
    color: #64748b;
    padding: 2px 0;
  }

  .sidebar-tips li::before {
    content: '•';
    margin-right: 6px;
    color: var(--flow-primary);
  }
</style>
