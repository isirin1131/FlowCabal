<script>
  import NavBar from './lib/NavBar.svelte';
  import FlowEditor from './lib/FlowEditor.svelte';
  import FloatingBall from './lib/FloatingBall.svelte';
</script>

<div class="app">
  <div class="navbar">
    <NavBar />
  </div>
  <div class="content">
    <FlowEditor />
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
