/**
 * Icons Module
 *
 * FlowWrite custom icon system with consistent styling.
 *
 * @example
 * ```svelte
 * <script>
 *   import { Icon } from '$lib/components/icons';
 * </script>
 *
 * <Icon name="play" size={20} />
 * <Icon name="llm-bot" class="animate-pulse-thinking" />
 * ```
 */

export { default as Icon } from './Icon.svelte';
export { icons, type IconName } from './icons';
