<script lang="ts">
  import { SvelteFlow, Background } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';

  let nodes = $state.raw([
    { id: '1', position: { x: 0, y: 0 }, data: { label: '1' } },
    { id: '2', position: { x: 0, y: 100 }, data: { label: '2' } },
  ]);

  let edges = $state.raw([
    { id: 'e1-2', source: '1', target: '2', animated: true },
  ]);
</script>

<div class="flow-editor">
  <SvelteFlow bind:nodes bind:edges>
    <Background />
  </SvelteFlow>
</div>

<style>
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  .flow-editor {
    width: 100%;
    height: 100%;
  }

  :global(.svelte-flow) {
    width: 100% !important;
    height: 100% !important;
  }

  :global(.svelte-flow__container) {
    width: 100% !important;
    height: 100% !important;
  }
</style>
