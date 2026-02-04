/**
 * Dexie Implementation
 *
 * IndexedDB persistence using Dexie.js with a document-oriented schema.
 */

import Dexie, { type Table } from 'dexie';
import type { WorkflowDefinition, NodeDefinition, NodeId } from '../core';
import type { SettingsRepository, WorkflowRepository, WorkflowSummary, DbSession } from './types';

// ============================================================================
// Record Types
// ============================================================================

interface WorkflowRecord {
  id: string;
  name: string;
  data: string;
  createdAt: number;
  updatedAt: number;
}

interface SettingsRecord {
  key: string;
  value: string;
  updatedAt: number;
}

// ============================================================================
// Serialization
// ============================================================================

interface SerializedWorkflow {
  id: string;
  name: string;
  nodes: [NodeId, NodeDefinition][];
}

function serializeWorkflow(workflow: WorkflowDefinition): string {
  const serializable: SerializedWorkflow = {
    id: workflow.id,
    name: workflow.name,
    nodes: Array.from(workflow.nodes.entries())
  };
  return JSON.stringify(serializable);
}

function deserializeWorkflow(data: string): WorkflowDefinition {
  const parsed = JSON.parse(data) as SerializedWorkflow;
  return {
    id: parsed.id,
    name: parsed.name,
    nodes: new Map(parsed.nodes)
  };
}

// ============================================================================
// Database Definition
// ============================================================================

class FlowWriteDB extends Dexie {
  workflows!: Table<WorkflowRecord>;
  settings!: Table<SettingsRecord>;

  constructor() {
    super('FlowWriteDB');

    this.version(1).stores({
      workflows: 'id, name, updatedAt',
      settings: 'key'
    });
  }
}

const db = new FlowWriteDB();

// ============================================================================
// Settings Repository Implementation
// ============================================================================

class DexieSettingsRepository implements SettingsRepository {
  async load<T>(key: string, defaultValue: T): Promise<T> {
    const record = await db.settings.get(key);
    if (!record) return defaultValue;

    try {
      return JSON.parse(record.value) as T;
    } catch {
      return defaultValue;
    }
  }

  async save<T>(key: string, value: T): Promise<void> {
    const record: SettingsRecord = {
      key,
      value: JSON.stringify(value),
      updatedAt: Date.now()
    };
    await db.settings.put(record);
  }

  async delete(key: string): Promise<void> {
    await db.settings.delete(key);
  }

  async loadBatch<T extends Record<string, unknown>>(defaults: T): Promise<T> {
    const keys = Object.keys(defaults);
    const records = await db.settings.bulkGet(keys);

    const result = { ...defaults };
    for (let i = 0; i < keys.length; i++) {
      const record = records[i];
      if (record) {
        try {
          (result as Record<string, unknown>)[keys[i]] = JSON.parse(record.value);
        } catch {
          // Keep default value
        }
      }
    }
    return result;
  }

  async saveBatch(settings: Record<string, unknown>): Promise<void> {
    const now = Date.now();
    const records: SettingsRecord[] = Object.entries(settings).map(([key, value]) => ({
      key,
      value: JSON.stringify(value),
      updatedAt: now
    }));
    await db.settings.bulkPut(records);
  }
}

// ============================================================================
// Workflow Repository Implementation
// ============================================================================

class DexieWorkflowRepository implements WorkflowRepository {
  async save(workflow: WorkflowDefinition): Promise<void> {
    const now = Date.now();
    const existing = await db.workflows.get(workflow.id);

    const record: WorkflowRecord = {
      id: workflow.id,
      name: workflow.name,
      data: serializeWorkflow(workflow),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };

    await db.workflows.put(record);
  }

  async load(id: string): Promise<WorkflowDefinition | null> {
    const record = await db.workflows.get(id);
    if (!record) return null;

    return deserializeWorkflow(record.data);
  }

  async list(): Promise<WorkflowSummary[]> {
    const records = await db.workflows.orderBy('updatedAt').reverse().toArray();

    return records.map(({ id, name, createdAt, updatedAt }) => ({
      id,
      name,
      createdAt,
      updatedAt
    }));
  }

  async delete(id: string): Promise<void> {
    await db.workflows.delete(id);
  }

  async exists(id: string): Promise<boolean> {
    const count = await db.workflows.where('id').equals(id).count();
    return count > 0;
  }
}

// ============================================================================
// Session Factory
// ============================================================================

export function createDexieDbSession(): DbSession {
  return {
    settings: new DexieSettingsRepository(),
    workflows: new DexieWorkflowRepository()
  };
}
