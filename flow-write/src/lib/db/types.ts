/**
 * Database Repository Interfaces
 *
 * Abstract interfaces for database operations, enabling testability
 * and potential alternative implementations.
 */

import type { WorkflowDefinition } from '../core';

// ============================================================================
// Record Types
// ============================================================================

export interface WorkflowSummary {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// Repository Interfaces
// ============================================================================

export interface SettingsRepository {
  load<T>(key: string, defaultValue: T): Promise<T>;
  save<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  loadBatch<T extends Record<string, unknown>>(defaults: T): Promise<T>;
  saveBatch(settings: Record<string, unknown>): Promise<void>;
}

export interface WorkflowRepository {
  save(workflow: WorkflowDefinition): Promise<void>;
  load(id: string): Promise<WorkflowDefinition | null>;
  list(): Promise<WorkflowSummary[]>;
  delete(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;
}

export interface DbSession {
  readonly settings: SettingsRepository;
  readonly workflows: WorkflowRepository;
}
