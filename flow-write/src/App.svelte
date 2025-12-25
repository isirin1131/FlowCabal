<script>
  import { SvelteFlow } from '@xyflow/svelte';
 
  import '@xyflow/svelte/dist/style.css';
 
  let nodes = $state.raw([
    { id: '1', position: { x: 0, y: 0 }, data: { label: '1' } },
    { id: '2', position: { x: 0, y: 100 }, data: { label: '2' } },
  ]);
 
  let edges = $state.raw([
    { id: 'e1-2', source: '1', target: '2' },
  ]);
</script>
 
<div style:width="100vw" style:height="100vh">
  <SvelteFlow bind:nodes bind:edges />
</div>