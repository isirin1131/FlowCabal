<!--
  Toast Component
  
  A notification toast with auto-dismiss and glass morphism styling.
  
  @example
  <Toast type="success" message="Workflow saved!" />
-->

<script lang="ts">
  import { Icon } from '$lib/components/icons';
  
  type ToastType = 'info' | 'success' | 'warning' | 'error';
  
  interface Props {
    /** Toast ID for management */
    id?: string;
    /** Toast type determines icon and color */
    type?: ToastType;
    /** Toast message */
    message: string;
    /** Auto-dismiss handler */
    ondismiss?: () => void;
  }
  
  let {
    id,
    type = 'info',
    message,
    ondismiss,
  }: Props = $props();
  
  const iconMap: Record<ToastType, string> = {
    info: 'info',
    success: 'check-circle',
    warning: 'alert-triangle',
    error: 'x-circle',
  };
</script>

<div class="toast toast-{type}" role="alert" aria-live="polite" data-id={id}>
  <span class="toast-icon">
    <Icon name={iconMap[type] as any} size={18} />
  </span>
  <span class="toast-message">{message}</span>
  {#if ondismiss}
    <button
      class="toast-close"
      onclick={ondismiss}
      aria-label="Dismiss notification"
    >
      <Icon name="x" size={14} />
    </button>
  {/if}
</div>

<style>
  .toast {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    background: var(--glass-bg);
    backdrop-filter: blur(var(--glass-blur));
    border: 1px solid var(--border-default);
    border-radius: var(--radius-lg);
    padding: var(--space-3) var(--space-4);
    box-shadow: var(--shadow-xl);
    animation: slide-in-right var(--duration-normal) var(--ease-bounce);
    max-width: 400px;
    min-width: 280px;
  }
  
  .toast-info {
    border-color: var(--border-accent);
  }
  
  .toast-success {
    border-color: rgba(0, 255, 148, 0.3);
  }
  
  .toast-warning {
    border-color: rgba(255, 184, 0, 0.3);
  }
  
  .toast-error {
    border-color: rgba(255, 42, 109, 0.3);
  }
  
  .toast-icon {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .toast-info .toast-icon {
    color: var(--accent-neural);
  }
  
  .toast-success .toast-icon {
    color: var(--accent-success);
  }
  
  .toast-warning .toast-icon {
    color: var(--accent-warning);
  }
  
  .toast-error .toast-icon {
    color: var(--accent-error);
  }
  
  .toast-message {
    flex: 1;
    font-size: 0.875rem;
    color: var(--text-primary);
    line-height: 1.4;
  }
  
  .toast-close {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    color: var(--text-tertiary);
    cursor: pointer;
    transition: all var(--duration-fast) var(--ease-default);
  }
  
  .toast-close:hover {
    background: var(--bg-elevated);
    color: var(--text-primary);
  }
  
  @keyframes slide-in-right {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
</style>
