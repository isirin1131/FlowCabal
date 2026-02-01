<!--
  Button Component
  
  A versatile button component with multiple variants and sizes.
  Follows the FlowWrite design system with neural accent colors.
  
  @example
  <Button variant="primary" onclick={handleClick}>Execute</Button>
  <Button variant="ghost" size="sm"><Icon name="play" /></Button>
-->

<script lang="ts">
  import type { Snippet } from 'svelte';
  
  type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';
  
  interface Props {
    /** Button style variant */
    variant?: ButtonVariant;
    /** Button size */
    size?: ButtonSize;
    /** Disabled state */
    disabled?: boolean;
    /** Loading state - shows spinner and disables */
    loading?: boolean;
    /** Full width button */
    fullWidth?: boolean;
    /** HTML button type */
    type?: 'button' | 'submit' | 'reset';
    /** Additional CSS classes */
    class?: string;
    /** Click handler */
    onclick?: (event: MouseEvent) => void;
    /** Button content */
    children: Snippet;
  }
  
  let {
    variant = 'secondary',
    size = 'md',
    disabled = false,
    loading = false,
    fullWidth = false,
    type = 'button',
    class: className = '',
    onclick,
    children,
  }: Props = $props();
  
  const isDisabled = $derived(disabled || loading);
</script>

<button
  {type}
  class="btn btn-{variant} btn-{size} {fullWidth ? 'btn-full' : ''} {className}"
  class:loading
  disabled={isDisabled}
  {onclick}
>
  {#if loading}
    <span class="btn-spinner" aria-hidden="true"></span>
  {/if}
  <span class="btn-content" class:invisible={loading}>
    {@render children()}
  </span>
</button>

<style>
  .btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    font-family: var(--font-body);
    font-weight: 500;
    white-space: nowrap;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--duration-fast) var(--ease-default);
    outline: none;
  }
  
  .btn:focus-visible {
    box-shadow: 0 0 0 2px var(--bg-deep), 0 0 0 4px var(--accent-neural);
  }
  
  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }
  
  .btn:active:not(:disabled) {
    transform: scale(0.98);
  }
  
  /* Variants */
  .btn-primary {
    background: var(--accent-neural);
    color: var(--bg-deep);
    border: 1px solid var(--accent-neural);
  }
  
  .btn-primary:hover:not(:disabled) {
    background: var(--accent-neural-dim);
    border-color: var(--accent-neural-dim);
  }
  
  .btn-secondary {
    background: var(--bg-surface);
    color: var(--text-primary);
    border: 1px solid var(--border-default);
  }
  
  .btn-secondary:hover:not(:disabled) {
    background: var(--bg-elevated);
    border-color: var(--border-accent);
    color: var(--accent-neural);
  }
  
  .btn-ghost {
    background: transparent;
    color: var(--text-secondary);
    border: 1px solid transparent;
  }
  
  .btn-ghost:hover:not(:disabled) {
    background: var(--bg-surface);
    color: var(--text-primary);
  }
  
  .btn-outline {
    background: transparent;
    color: var(--accent-neural);
    border: 1px solid var(--border-accent-strong);
  }
  
  .btn-outline:hover:not(:disabled) {
    background: rgba(0, 255, 213, 0.1);
    border-color: var(--accent-neural);
  }
  
  .btn-danger {
    background: var(--accent-error);
    color: white;
    border: 1px solid var(--accent-error);
  }
  
  .btn-danger:hover:not(:disabled) {
    background: color-mix(in srgb, var(--accent-error) 90%, black);
  }
  
  /* Sizes */
  .btn-sm {
    height: 32px;
    padding: 0 var(--space-3);
    font-size: 0.8125rem;
  }
  
  .btn-md {
    height: 40px;
    padding: 0 var(--space-4);
    font-size: 0.875rem;
  }
  
  .btn-lg {
    height: 48px;
    padding: 0 var(--space-6);
    font-size: 1rem;
  }
  
  .btn-icon {
    width: 40px;
    height: 40px;
    padding: 0;
  }
  
  .btn-icon.btn-sm {
    width: 32px;
    height: 32px;
  }
  
  .btn-icon.btn-lg {
    width: 48px;
    height: 48px;
  }
  
  /* Full width */
  .btn-full {
    width: 100%;
  }
  
  /* Content */
  .btn-content {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }
  
  .btn-content.invisible {
    visibility: hidden;
  }
  
  /* Spinner */
  .btn-spinner {
    position: absolute;
    width: 16px;
    height: 16px;
    border: 2px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }
  
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
