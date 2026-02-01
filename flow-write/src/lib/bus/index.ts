/**
 * EventBus Module
 *
 * Provides the communication layer for FlowWrite components.
 *
 * @example
 * ```typescript
 * import { bus } from '$lib/bus';
 * import type { NodeState, WorkflowState } from '$lib/bus';
 *
 * // Subscribe to events
 * bus.on('node:state', ({ nodeId, state }) => {
 *   console.log(`Node ${nodeId} is now ${state}`);
 * });
 *
 * // Emit events
 * bus.emit('workflow:run', { workflowId: 'xxx' });
 * ```
 */

// Export singleton instance
export { bus } from './eventbus';

// Export class for testing
export { EventBus } from './eventbus';

// Export all event types
export type {
  BusEvents,
  EventPayload,
  EventHandler,
  NodeState,
  WorkflowState,
  UILockReason,
  StorageExportFormat,
} from './events';
