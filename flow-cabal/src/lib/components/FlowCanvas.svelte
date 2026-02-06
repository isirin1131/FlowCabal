<script lang="ts">
  import {
    SvelteFlow,
    Background,
    Controls,
    MiniMap,
    Panel,
    BackgroundVariant,
    type Node,
    type Edge
  } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';

  let {
    nodes = $bindable(),
    edges = $bindable(),
    nodeTypes,
    handleContextMenu
  }: {
    nodes: Node[];
    edges: Edge[];
    nodeTypes: Record<string, any>;
    handleContextMenu: (event: MouseEvent, item: { type: 'node' | 'edge'; id: string }) => void;
  } = $props();

  function onconnect(connection: any) {
    const newEdge: Edge = {
      id: `e-${connection.source}-${connection.target}`,
      source: connection.source,
      target: connection.target,
      type: 'smoothstep',
      data: { label: '' }
    };
    edges = [...edges, newEdge];
  }

  function handleNodeContextMenu(event: any) {
    handleContextMenu(event.originalEvent, { type: 'node', id: event.detail.id });
  }

  function handleEdgeContextMenu(event: any) {
    handleContextMenu(event.originalEvent, { type: 'edge', id: event.detail.id });
  }

  const onnodecontextmenu = handleNodeContextMenu;
  const onedgecontextmenu = handleEdgeContextMenu;
</script>

<SvelteFlow
  bind:nodes={nodes}
  bind:edges={edges}
  {nodeTypes}
  {onconnect}
  {onnodecontextmenu}
  {onedgecontextmenu}
  fitView
  snapToGrid
  snapGrid={[15, 15]}
  defaultEdgeOptions={{ type: 'smoothstep', animated: true }}
>
  <Background variant={BackgroundVariant.Lines} gap={20} />
  <Controls />
  <MiniMap />
  <Panel position="top-right">
    <div class="info-panel">
      <span>{nodes.length} nodes</span>
    </div>
  </Panel>
</SvelteFlow>

<style>
  :global(.svelte-flow) {
    width: 100%;
    height: 100%;
  }

  .info-panel {
    padding: 6px 12px;
    background: var(--flow-bg);
    border: 1px solid var(--flow-border);
    border-radius: 6px;
    font-size: 12px;
  }
</style>
