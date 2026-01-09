<script>
  import NavBar from './lib/NavBar.svelte';
  import FlowEditor from './lib/FlowEditor.svelte';
  import ApiTest from './lib/ApiTest.svelte';
  import FloatingBall from './lib/FloatingBall.svelte';

  let activePage = $state('flow');
</script>

<div class="app">
  <div class="navbar">
    <NavBar bind:activePage />
  </div>
  <div class="content">
    {#if activePage === 'flow'}
      <FlowEditor />
    {:else}
      <ApiTest />
    {/if}
  </div>
</div>

<FloatingBall />

<style>
  :global(html) {
    margin: 0;
    padding: 0;
  }

  :global(body) {
    margin: 0;
    padding: 0;
    overflow: hidden;
  }

  .app {
    display: flex;
    flex-direction: column;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
  }

  .navbar {
    flex: 0 0 auto;
  }

  .content {
    flex: 1 1 auto;
    overflow: hidden;
  }
</style>
