<script lang="ts">
  interface MenuItem {
    label: string;
    icon: string;
    action: string;
    danger?: boolean;
  }

  interface Divider {
    type: 'divider';
  }

  let {
    x = 0,
    y = 0,
    visible = $bindable(false),
    type = 'node',
    id = '',
    onaction
  }: {
    x: number;
    y: number;
    visible: boolean;
    type: 'node' | 'edge';
    id: string;
    onaction?: (detail: { action: string; type: 'node' | 'edge'; id: string }) => void;
  } = $props();

  const menuItems: (MenuItem | Divider)[] = [
    { label: 'Copy', icon: '📋', action: 'copy' },
    { label: 'Duplicate', icon: '📄', action: 'duplicate' },
    { type: 'divider' },
    { label: 'Delete', icon: '🗑️', action: 'delete', danger: true },
  ];

  function handleAction(action: string) {
    onaction?.({ action, type, id });
    visible = false;
  }

  function handleClickOutside() {
    if (visible) {
      visible = false;
    }
  }

  $effect(() => {
    if (visible) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  });
</script>

{#if visible}
  <div class="context-menu" style="left: {x}px; top: {y}px;">
    {#each menuItems as item}
      {#if 'type' in item && item.type === 'divider'}
        <div class="context-menu-divider"></div>
      {:else if 'action' in item}
        <button
          class="context-menu-item"
          class:danger={item.danger}
          onclick={() => handleAction(item.action)}
        >
          <span class="menu-icon">{item.icon}</span>
          <span>{item.label}</span>
        </button>
      {/if}
    {/each}
  </div>
{/if}

<style>
  .context-menu {
    position: fixed;
    background: var(--flow-bg);
    border: 1px solid var(--flow-border);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    padding: 4px 0;
    min-width: 160px;
    z-index: 1000;
  }

  .context-menu-divider {
    height: 1px;
    background: var(--flow-border);
    margin: 4px 0;
  }

  .context-menu-item {
    width: 100%;
    padding: 8px 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: var(--flow-text);
    background: transparent;
    border: none;
    text-align: left;
    transition: background-color 0.15s;
  }

  .context-menu-item:hover {
    background: rgba(14, 165, 233, 0.1);
  }

  .context-menu-item.danger {
    color: var(--flow-error);
  }

  .context-menu-item.danger:hover {
    background: rgba(239, 68, 68, 0.1);
  }

  .menu-icon {
    font-size: 14px;
  }
</style>
