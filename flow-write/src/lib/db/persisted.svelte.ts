/**
 * Persisted State Primitive
 *
 * Reactive state that automatically loads from and saves to the database.
 */

import { onMount } from 'svelte';
import { getDbSession } from './context';

export interface PersistedOptions<T> {
  key: string;
  defaultValue: T;
}

/**
 * Creates a reactive state that persists to the database.
 *
 * Usage:
 * ```svelte
 * <script>
 *   const endpoint = persisted({ key: 'apiTest:endpoint', defaultValue: 'https://api.openai.com/v1' });
 * </script>
 *
 * <input bind:value={endpoint.value} />
 * ```
 */
export function persisted<T>(options: PersistedOptions<T>): {
  get value(): T;
  set value(v: T);
  get loaded(): boolean;
} {
  const { key, defaultValue } = options;

  let _value = $state(defaultValue);
  let _loaded = $state(false);

  const db = getDbSession();

  onMount(async () => {
    _value = await db.settings.load(key, defaultValue);
    _loaded = true;
  });

  $effect(() => {
    if (!_loaded) return;
    db.settings.save(key, _value);
  });

  return {
    get value() {
      return _value;
    },
    set value(v: T) {
      _value = v;
    },
    get loaded() {
      return _loaded;
    }
  };
}
