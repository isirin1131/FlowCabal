/**
 * FlowWrite EventBus Implementation
 *
 * A type-safe event bus for cross-component communication.
 *
 * Features:
 * - Full TypeScript support with auto-completion
 * - Automatic unsubscribe on component destroy
 * - Development mode logging
 * - Event history for debugging
 *
 * Usage:
 * ```typescript
 * import { bus } from '$lib/bus';
 *
 * // Subscribe
 * const unsubscribe = bus.on('node:state', (payload) => {
 *   console.log(payload.nodeId, payload.state);
 * });
 *
 * // Emit
 * bus.emit('workflow:run', { workflowId: 'xxx' });
 *
 * // Unsubscribe (call in onDestroy)
 * unsubscribe();
 * ```
 */

import type { BusEvents, EventHandler } from './events';

/**
 * Event history entry for debugging
 */
interface EventHistoryEntry {
  event: keyof BusEvents;
  payload: unknown;
  timestamp: number;
}

/**
 * EventBus configuration options
 */
interface EventBusOptions {
  /** Enable console logging in development */
  debug?: boolean;
  /** Maximum history entries to keep */
  maxHistory?: number;
}

/**
 * Type-safe EventBus class
 */
class EventBus {
  private listeners = new Map<keyof BusEvents, Set<EventHandler<keyof BusEvents>>>();
  private history: EventHistoryEntry[] = [];
  private options: Required<EventBusOptions>;

  constructor(options: EventBusOptions = {}) {
    this.options = {
      debug: import.meta.env.DEV,
      maxHistory: 100,
      ...options,
    };
  }

  /**
   * Subscribe to an event
   *
   * @param event - Event name to listen for
   * @param callback - Handler function called when event is emitted
   * @returns Unsubscribe function - call this in onDestroy to prevent memory leaks
   *
   * @example
   * ```typescript
   * onMount(() => {
   *   const unsubscribes = [
   *     bus.on('ui:lock', () => { isLocked = true; }),
   *     bus.on('ui:unlock', () => { isLocked = false; }),
   *   ];
   *
   *   return () => unsubscribes.forEach(fn => fn());
   * });
   * ```
   */
  on<K extends keyof BusEvents>(
    event: K,
    callback: EventHandler<K>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    const handlers = this.listeners.get(event)!;
    handlers.add(callback as EventHandler<keyof BusEvents>);

    // Return unsubscribe function
    return () => {
      handlers.delete(callback as EventHandler<keyof BusEvents>);
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
    };
  }

  /**
   * Subscribe to an event for one-time execution
   *
   * @param event - Event name to listen for
   * @param callback - Handler function called once when event is emitted
   * @returns Unsubscribe function
   */
  once<K extends keyof BusEvents>(
    event: K,
    callback: EventHandler<K>
  ): () => void {
    const unsubscribe = this.on(event, (payload) => {
      unsubscribe();
      callback(payload);
    });
    return unsubscribe;
  }

  /**
   * Emit an event to all subscribers
   *
   * @param event - Event name to emit
   * @param payload - Event data
   *
   * @example
   * ```typescript
   * bus.emit('workflow:run', { workflowId: 'my-workflow' });
   * bus.emit('ui:unlock', undefined);
   * ```
   */
  emit<K extends keyof BusEvents>(
    event: K,
    payload: BusEvents[K]
  ): void {
    // Log in development mode
    if (this.options.debug) {
      console.log(`[EventBus] ${event}`, payload);
    }

    // Add to history
    this.addToHistory(event, payload);

    // Call all handlers
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach((callback) => {
        try {
          callback(payload);
        } catch (error) {
          console.error(`[EventBus] Error in handler for "${event}":`, error);
        }
      });
    }
  }

  /**
   * Remove a specific handler from an event
   *
   * @param event - Event name
   * @param callback - Handler function to remove
   */
  off<K extends keyof BusEvents>(
    event: K,
    callback: EventHandler<K>
  ): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(callback as EventHandler<keyof BusEvents>);
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Remove all handlers for an event
   *
   * @param event - Event name to clear
   */
  clear(event: keyof BusEvents): void {
    this.listeners.delete(event);
  }

  /**
   * Remove all handlers for all events
   */
  clearAll(): void {
    this.listeners.clear();
  }

  /**
   * Get the number of listeners for an event
   *
   * @param event - Event name
   * @returns Number of registered handlers
   */
  listenerCount(event: keyof BusEvents): number {
    return this.listeners.get(event)?.size ?? 0;
  }

  /**
   * Get event history (for debugging)
   *
   * @param event - Optional filter by event name
   * @returns Array of event history entries
   */
  getHistory(event?: keyof BusEvents): EventHistoryEntry[] {
    if (event) {
      return this.history.filter((entry) => entry.event === event);
    }
    return [...this.history];
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Set debug mode
   *
   * @param enabled - Enable or disable debug logging
   */
  setDebug(enabled: boolean): void {
    this.options.debug = enabled;
  }

  /**
   * Add event to history
   */
  private addToHistory(event: keyof BusEvents, payload: unknown): void {
    this.history.push({
      event,
      payload,
      timestamp: Date.now(),
    });

    // Trim history if needed
    if (this.history.length > this.options.maxHistory) {
      this.history = this.history.slice(-this.options.maxHistory);
    }
  }
}

/**
 * Singleton EventBus instance
 *
 * Use this instance throughout the application for consistent event handling.
 */
export const bus = new EventBus();

/**
 * Export EventBus class for testing or creating isolated instances
 */
export { EventBus };
