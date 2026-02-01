<!--
  Icon Component
  
  FlowWrite custom icon system with consistent styling.
  Uses SVG paths for crisp rendering at any size.
  
  @example
  <Icon name="play" size={20} />
  <Icon name="llm-bot" class="animate-pulse-thinking" />
-->

<script lang="ts">
  import { icons, type IconName } from './icons';
  
  interface Props {
    /** Icon name from the icon set */
    name: IconName;
    /** Icon size in pixels */
    size?: number;
    /** Additional CSS classes */
    class?: string;
    /** Accessible label (for screen readers) */
    label?: string;
  }
  
  let {
    name,
    size = 24,
    class: className = '',
    label,
  }: Props = $props();
  
  const icon = $derived(icons[name]);
</script>

<svg
  class="icon {className}"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden={!label}
  role={label ? 'img' : undefined}
  aria-label={label}
>
  {#if icon}
    {@html icon}
  {/if}
</svg>

<style>
  .icon {
    flex-shrink: 0;
    display: inline-block;
    vertical-align: middle;
  }
</style>
