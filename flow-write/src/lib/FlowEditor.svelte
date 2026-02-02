<script lang="ts">
  import { SvelteFlowProvider, type Node, type Edge } from '@xyflow/svelte';
  import { LLMNode, TextNode, InputNode, OutputNode } from './nodes';
  import { ContextMenu, NodeSidebar, Toolbar, FlowCanvas } from './components';
  import {
    validateWorkflow,
    topologicalSort,
    layoutGraph,
    type LayoutOptions
  } from './utils';

  const nodeTypes = {
    llm: LLMNode,
    text: TextNode,
    input: InputNode,
    output: OutputNode
  };

  let nodes = $state.raw<Node[]>([
    {
      id: 'input-1',
      type: 'input',
      position: { x: 100, y: 200 },
      data: { label: 'User Input', inputType: 'text', isInput: true }
    },
    {
      id: 'llm-1',
      type: 'llm',
      position: { x: 400, y: 200 },
      data: { label: 'Generate Content', provider: 'OpenAI', model: 'gpt-4', status: 'idle' }
    },
    {
      id: 'text-1',
      type: 'text',
      position: { x: 700, y: 200 },
      data: { label: 'Format Output', text: '', status: 'idle' }
    },
    {
      id: 'output-1',
      type: 'output',
      position: { x: 1000, y: 200 },
      data: { label: 'Final Result', outputType: 'text', isOutput: true }
    }
  ]);

  let edges = $state.raw<Edge[]>([
    { id: 'e1-2', source: 'input-1', target: 'llm-1', type: 'smoothstep', data: { label: 'input' } },
    { id: 'e2-3', source: 'llm-1', target: 'text-1', type: 'smoothstep', data: { label: 'content' } },
    { id: 'e3-4', source: 'text-1', target: 'output-1', type: 'smoothstep', data: { label: 'formatted' } }
  ]);

  let darkMode = $state(false);
  let layoutDirection = $state<'TB' | 'LR'>('TB');

  let contextMenu = $state({ x: 0, y: 0, visible: false, type: 'node' as 'node' | 'edge', id: '' });

  let validationResult = $state<{ valid: boolean; errors: string[]; warnings: string[] } | null>(null);
  let executionOrder = $state<string[]>([]);

  function handleContextMenu(event: MouseEvent, item: { type: 'node' | 'edge'; id: string }) {
    event.preventDefault();
    contextMenu = {
      x: event.clientX,
      y: event.clientY,
      visible: true,
      type: item.type,
      id: item.id
    };
  }

  function handleContextMenuAction(event: CustomEvent<{ action: string; type: 'node' | 'edge'; id: string }>) {
    const { action, type, id } = event.detail;

    switch (action) {
      case 'delete':
        if (type === 'node') {
          nodes = nodes.filter(n => n.id !== id);
          edges = edges.filter(e => e.source !== id && e.target !== id);
        } else {
          edges = edges.filter(e => e.id !== id);
        }
        break;
      case 'copy':
      case 'duplicate':
        if (type === 'node') {
          const node = nodes.find(n => n.id === id);
          if (node) {
            const newNode: Node = {
              ...node,
              id: `${node.id}-copy-${Date.now()}`,
              position: { x: node.position.x + 50, y: node.position.y + 50 },
              data: { ...node.data }
            };
            nodes = [...nodes, newNode];
          }
        }
        break;
    }
    validateAndAnalyze();
  }

  async function handleDrop(event: DragEvent) {
    event.preventDefault();

    const nodeType = event.dataTransfer?.getData('application/node-type');
    if (!nodeType) return;

    const reactFlowBounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const position = {
      x: event.clientX - reactFlowBounds.left,
      y: event.clientY - reactFlowBounds.top
    };

    const newNode: Node = {
      id: `${nodeType}-${Date.now()}`,
      type: nodeType,
      position,
      data: getDefaultNodeData(nodeType)
    };

    nodes = [...nodes, newNode];
    validateAndAnalyze();
  }

  function getDefaultNodeData(nodeType: string): Record<string, unknown> {
    switch (nodeType) {
      case 'input':
        return { label: 'Input', inputType: 'text', isInput: true, status: 'idle' };
      case 'llm':
        return { label: 'LLM Node', provider: 'OpenAI', model: 'gpt-4', status: 'idle' };
      case 'text':
        return { label: 'Text Node', text: '', status: 'idle' };
      case 'output':
        return { label: 'Output', outputType: 'text', isOutput: true, status: 'idle' };
      default:
        return { label: 'Node', status: 'idle' };
    }
  }

  function handleToolbarAction(action: string) {
    switch (action) {
      case 'layout':
        autoLayout({ algorithm: 'dagre', direction: layoutDirection });
        break;
      case 'layout-tb':
        layoutDirection = 'TB';
        break;
      case 'layout-lr':
        layoutDirection = 'LR';
        break;
      case 'execute':
        executeWorkflow();
        break;
      case 'validate':
        validateAndAnalyze();
        alert(validationResult?.valid ? 'Workflow is valid!' : `Issues: ${validationResult?.errors.join(', ')}`);
        break;
    }
  }

  async function autoLayout(options: LayoutOptions) {
    nodes = await layoutGraph(nodes, edges, options);
  }

  function executeWorkflow() {
    const result = topologicalSort(nodes, edges);
    if (result.error) {
      alert(`Cannot execute: ${result.error}`);
      return;
    }
    executionOrder = result.executionOrder;
    alert(`Execution order: ${executionOrder.join(' → ')}`);
  }

  function validateAndAnalyze() {
    validationResult = validateWorkflow(nodes, edges);

    const sortResult = topologicalSort(nodes, edges);
    if (!sortResult.error) {
      executionOrder = sortResult.executionOrder;
    }
  }

  $effect(() => {
    document.addEventListener('contextmenu', (e) => {
      if (!(e.target as HTMLElement).closest('.svelte-flow__node') &&
          !(e.target as HTMLElement).closest('.svelte-flow__edge')) {
        contextMenu.visible = false;
      }
    });
    validateAndAnalyze();
  });
</script>

<div class="flow-container" class:darkMode>
  <NodeSidebar />

  <div class="flow-main">
    <Toolbar
      {darkMode}
      {layoutDirection}
      onaction={(e: CustomEvent<string>) => handleToolbarAction(e.detail)}
    />

    <div class="flow-canvas" ondrop={handleDrop} ondragover={(e: DragEvent) => e.preventDefault()} role="application">
      <SvelteFlowProvider>
        <FlowCanvas
          bind:nodes={nodes}
          bind:edges={edges}
          {nodeTypes}
          {handleContextMenu}
        />
      </SvelteFlowProvider>
    </div>
  </div>

  <ContextMenu
    x={contextMenu.x}
    y={contextMenu.y}
    visible={contextMenu.visible}
    type={contextMenu.type}
    id={contextMenu.id}
    onaction={handleContextMenuAction}
  />
</div>

<style>
  .flow-container {
    display: flex;
    height: 100%;
    width: 100%;
    background: var(--flow-bg);
    transition: background-color 0.3s;
    overflow: hidden;
  }

  .flow-container.darkMode {
    --flow-bg: #1a1a2e;
    --flow-text: #e2e8f0;
    --flow-border: #334155;
  }

  .flow-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .flow-canvas {
    flex: 1;
    position: relative;
  }

  :global(.svelte-flow) {
    width: 100%;
    height: 100%;
  }
</style>
