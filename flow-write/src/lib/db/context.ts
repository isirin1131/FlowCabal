/**
 * Database Context
 *
 * Svelte context for database session injection.
 */

import { getContext, setContext } from 'svelte';
import type { DbSession } from './types';

const DB_SESSION_KEY = Symbol('db-session');

export function setDbSession(session: DbSession): void {
  setContext(DB_SESSION_KEY, session);
}

export function getDbSession(): DbSession {
  const session = getContext<DbSession>(DB_SESSION_KEY);
  if (!session) {
    throw new Error('DbSession not found in context. Did you forget to call setDbSession()?');
  }
  return session;
}
