/**
 * FlowWrite Database
 *
 * Public API for database operations.
 */

// Types
export type {
  SettingsRepository,
  WorkflowRepository,
  WorkflowSummary,
  DbSession
} from './types';

// Context
export { setDbSession, getDbSession } from './context';

// Dexie implementation
export { createDexieDbSession } from './dexie';

// Settings keys
export { SETTINGS_KEYS, type SettingsKey } from './settings-keys';

// Persisted state primitive
export { persisted, type PersistedOptions } from './persisted.svelte';
