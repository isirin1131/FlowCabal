<!--
  Badge Component
  
  Status indicator badges with semantic colors.
  
  @example
  <Badge variant="success">Completed</Badge>
  <Badge variant="running" pulse>Processing</Badge>
-->

<script lang="ts">
  import type { Snippet } from 'svelte';
  
  type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'error' | 'pending' | 'running';
  type BadgeSize = 'sm' | 'md';
  
  interface Props {
    /** Badge style variant */
    variant?: BadgeVariant;
    /** Badge size */
    size?: BadgeSize;
    /** Show pulse animation */
    pulse?: boolean;
    /** Additional CSS classes */
    class?: string;
    /** Badge content */
    children: Snippet;
  }
  
  let {
    variant = 'default',
    size = 'sm',
    pulse = false,
    class: className = '',
    children,
  }: Props = $props();
</script>

<span
  class="badge badge-{variant} badge-{size} {className}"
  class:pulse
>
  {@render children()}
</span>

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-code);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-radius: var(--radius-full);
    white-space: nowrap;
  }
  
  /* Sizes */
  .badge-sm {
    height: 20px;
    padding: 0 var(--space-2);
    font-size: 0.625rem;
  }
  
  .badge-md {
    height: 24px;
    padding: 0 var(--space-3);
    font-size: 0.75rem;
  }
  
  /* Variants */
  .badge-default {
    background: var(--bg-elevated);
    color: var(--text-tertiary);
  }
  
  .badge-primary {
    background: rgba(0, 255, 213, 0.15);
    color: var(--accent-neural);
  }
  
  .badge-success {
    background: var(--node-completed-bg);
    color: var(--accent-success);
  }
  
  .badge-warning {
    background: rgba(255, 184, 0, 0.15);
    color: var(--accent-warning);
  }
  
  .badge-error {
    background: var(--node-error-bg);
    color: var(--accent-error);
  }
  
  .badge-pending {
    background: var(--node-pending-bg);
    color: var(--accent-thinking);
  }
  
  .badge-running {
    background: var(--node-running-bg);
    color: var(--accent-thinking);
  }
  
  /* Pulse animation */
  .badge.pulse {
    animation: pulse-thinking 1.5s ease-in-out infinite;
  }
</style>
