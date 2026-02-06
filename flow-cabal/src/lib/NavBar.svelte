<script lang="ts">
  let { activePage = $bindable('flow') } = $props();
</script>

<nav class="nav-bar">
  <div class="nav-brand">FlowCabal</div>
  <div class="nav-links">
    <button 
      class:active={activePage === 'flow'} 
      onclick={() => activePage = 'flow'}
    >
      Flow Editor
    </button>
    <button 
      class:active={activePage === 'api-test'} 
      onclick={() => activePage = 'api-test'}
    >
      LLM API Test
    </button>
  </div>
</nav>

<style>
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  .nav-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    height: 56px;
    padding: 0 24px;
    background: #1a1a2e;
    border-bottom: 1px solid #2d2d44;
  }

  .nav-brand {
    font-size: 18px;
    font-weight: 600;
    color: #e0e0e0;
  }

  .nav-links {
    display: flex;
    gap: 8px;
  }

  button {
    padding: 8px 16px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: #a0a0a0;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
  }

  button:hover {
    color: #e0e0e0;
    background: #2d2d44;
  }

  button.active {
    color: #fff;
    background: #3d3d5c;
  }
</style>
