/**
 * FlowWrite EventBus Event Types
 *
 * This file defines all event types for the EventBus communication layer.
 *
 * Communication Patterns:
 * - UI → core-runner: User actions triggering workflow execution
 * - core-runner → UI: State updates during execution
 * - UI ↔ storage: Persistence operations via FloatingBall
 *
 * Design Principle:
 * Messages flow at most 3 layers deep: UI → core-runner → UI
 * No chain reactions: UI → core → UI → core... is prevented by UI locking
 */

import type { NodeId } from '$lib/core/node';
import type { TextBlockId } from '$lib/core/textblock';

/**
 * Node execution states
 */
export type NodeState = 'idle' | 'pending' | 'running' | 'completed' | 'error';

/**
 * Workflow execution states
 */
export type WorkflowState = 'idle' | 'running' | 'completed' | 'error';

/**
 * UI lock reasons
 */
export type UILockReason = 'executing' | 'saving' | 'loading';

/**
 * Storage export formats
 */
export type StorageExportFormat = 'json';

/**
 * All EventBus event definitions
 *
 * Naming Convention:
 * - 'domain:action' format
 * - Domains: workflow, node, ui, storage
 */
export interface BusEvents {
  // ============================================
  // UI → core-runner: Workflow Control
  // ============================================

  /**
   * Request to start workflow execution
   */
  'workflow:run': {
    workflowId: string;
  };

  /**
   * Request to stop workflow execution
   */
  'workflow:stop': undefined;

  /**
   * Request to pause workflow execution (future)
   */
  'workflow:pause': undefined;

  /**
   * Request to resume paused workflow (future)
   */
  'workflow:resume': undefined;

  // ============================================
  // UI → core-runner: Node Control
  // ============================================

  /**
   * Freeze a virtual text block's content
   * Frozen blocks won't update when source node re-executes
   */
  'node:freeze': {
    blockId: TextBlockId;
  };

  /**
   * Unfreeze a virtual text block
   */
  'node:unfreeze': {
    blockId: TextBlockId;
  };

  /**
   * Request to retry a failed node
   */
  'node:retry': {
    nodeId: NodeId;
  };

  /**
   * Manually set a node's output (bypass LLM)
   */
  'node:set-output': {
    nodeId: NodeId;
    content: string;
  };

  /**
   * Skip a node and continue execution
   */
  'node:skip': {
    nodeId: NodeId;
  };

  // ============================================
  // core-runner → UI: State Updates
  // ============================================

  /**
   * Node state changed
   */
  'node:state': {
    nodeId: NodeId;
    state: NodeState;
    errorMessage?: string;
  };

  /**
   * Node output updated (supports streaming)
   */
  'node:output': {
    nodeId: NodeId;
    content: string;
    /** true = incremental update (streaming) */
    streaming: boolean;
    /** true = streaming finished */
    done?: boolean;
  };

  /**
   * Virtual block state changed
   */
  'block:state': {
    blockId: TextBlockId;
    state: 'pending' | 'resolved' | 'error';
    content?: string;
    frozen?: boolean;
  };

  /**
   * Workflow execution completed successfully
   */
  'workflow:done': {
    workflowId: string;
    /** Total execution time in ms */
    duration?: number;
  };

  /**
   * Workflow execution failed
   */
  'workflow:error': {
    error: string;
    /** Node that caused the error (if applicable) */
    nodeId?: NodeId;
  };

  /**
   * Workflow state changed
   */
  'workflow:state': {
    state: WorkflowState;
    /** Current execution progress (0-1) */
    progress?: number;
  };

  // ============================================
  // UI Locking
  // ============================================

  /**
   * Lock UI to prevent edits during execution
   */
  'ui:lock': {
    reason: UILockReason;
  };

  /**
   * Unlock UI after execution
   */
  'ui:unlock': undefined;

  // ============================================
  // Storage Operations (FloatingBall Bridge)
  // ============================================

  /**
   * Request sync with local storage
   */
  'storage:sync': undefined;

  /**
   * Request workflow export
   */
  'storage:export': {
    workflowId: string;
    format: StorageExportFormat;
  };

  /**
   * Request workflow import
   */
  'storage:import': {
    data: string;
    format: StorageExportFormat;
  };

  /**
   * Storage operation completed
   */
  'storage:done': {
    operation: 'sync' | 'export' | 'import';
    success: boolean;
    error?: string;
  };

  // ============================================
  // Toast Notifications
  // ============================================

  /**
   * Show a toast notification
   */
  'toast:show': {
    id?: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    /** Auto-dismiss duration in ms (0 = manual dismiss) */
    duration?: number;
  };

  /**
   * Dismiss a specific toast
   */
  'toast:dismiss': {
    id: string;
  };

  // ============================================
  // Theme
  // ============================================

  /**
   * Theme changed
   */
  'theme:change': {
    theme: 'light' | 'dark' | 'system';
  };
}

/**
 * Helper type to get event payload by event name
 */
export type EventPayload<K extends keyof BusEvents> = BusEvents[K];

/**
 * Helper type for event handler functions
 */
export type EventHandler<K extends keyof BusEvents> = (
  payload: BusEvents[K]
) => void | Promise<void>;
