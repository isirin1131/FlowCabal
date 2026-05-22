/**
 * Memory 聊天记录持久化（IndexedDB）
 *
 * Schema: 见 docs/plan 中的 `# IndexedDB schema`
 *
 * 所有操作：
 *   - SSR 安全：在 server 调用直接返回空 / no-op
 *   - 失败时静默退化（隐私模式 / 浏览器禁用 IDB）—— 调用方仍能正常工作，
 *     页面退化为内存态，刷新即丢
 */
import type { MemoryStreamChunk } from '@flowcabal/engine'

const DB_NAME = 'flowcabal-memory'
const DB_VERSION = 1
const STORE_CONVERSATIONS = 'conversations'
const STORE_MESSAGES = 'messages'
const INDEX_MSG_BY_CONV = 'by_conversation'

export type Conversation = {
  id: string
  title: string
  createdAt: number
  updatedAt: number
}

export type PersistedMessage = {
  id: string
  conversationId: string
  role: 'user' | 'assistant'
  content: string                    // user 时是文本；assistant 时空
  parts: MemoryStreamChunk[]         // assistant 时填，user 时空数组
  done: boolean                      // assistant 时有意义；user 永远 true
  createdAt: number
}

// ─── 内部 ───────────────────────────────────────────────────────

let dbPromise: Promise<IDBDatabase | null> | null = null

function isAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined'
}

function openDB(): Promise<IDBDatabase | null> {
  if (!isAvailable()) return Promise.resolve(null)
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve) => {
    const req = window.indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_CONVERSATIONS)) {
        db.createObjectStore(STORE_CONVERSATIONS, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE_MESSAGES)) {
        const msgStore = db.createObjectStore(STORE_MESSAGES, { keyPath: 'id' })
        msgStore.createIndex(INDEX_MSG_BY_CONV, 'conversationId', { unique: false })
      }
    }

    req.onsuccess = () => resolve(req.result)
    req.onerror = () => {
      // 静默退化
      resolve(null)
    }
    req.onblocked = () => resolve(null)
  })

  return dbPromise
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// ─── 公开 API ───────────────────────────────────────────────────

/** IDB 是否可用（用于 UI 兜底提示） */
export function isPersistenceAvailable(): boolean {
  return isAvailable()
}

export async function listConversations(): Promise<Conversation[]> {
  const db = await openDB()
  if (!db) return []
  try {
    const tx = db.transaction(STORE_CONVERSATIONS, 'readonly')
    const store = tx.objectStore(STORE_CONVERSATIONS)
    const all = await wrap(store.getAll())
    return (all as Conversation[]).sort((a, b) => b.updatedAt - a.updatedAt)
  } catch {
    return []
  }
}

export async function createConversation(title: string): Promise<Conversation | null> {
  const db = await openDB()
  if (!db) return null
  const now = Date.now()
  const conv: Conversation = {
    id: `c-${now}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    createdAt: now,
    updatedAt: now,
  }
  try {
    const tx = db.transaction(STORE_CONVERSATIONS, 'readwrite')
    await wrap(tx.objectStore(STORE_CONVERSATIONS).put(conv))
    return conv
  } catch {
    return null
  }
}

export async function renameConversation(id: string, title: string): Promise<void> {
  const db = await openDB()
  if (!db) return
  try {
    const tx = db.transaction(STORE_CONVERSATIONS, 'readwrite')
    const store = tx.objectStore(STORE_CONVERSATIONS)
    const existing = (await wrap(store.get(id))) as Conversation | undefined
    if (!existing) return
    await wrap(store.put({ ...existing, title, updatedAt: Date.now() }))
  } catch {
    // ignore
  }
}

export async function touchConversation(id: string): Promise<void> {
  const db = await openDB()
  if (!db) return
  try {
    const tx = db.transaction(STORE_CONVERSATIONS, 'readwrite')
    const store = tx.objectStore(STORE_CONVERSATIONS)
    const existing = (await wrap(store.get(id))) as Conversation | undefined
    if (!existing) return
    await wrap(store.put({ ...existing, updatedAt: Date.now() }))
  } catch {
    // ignore
  }
}

export async function deleteConversation(id: string): Promise<void> {
  const db = await openDB()
  if (!db) return
  try {
    // 同事务删 conv + 其所有 messages
    const tx = db.transaction([STORE_CONVERSATIONS, STORE_MESSAGES], 'readwrite')
    tx.objectStore(STORE_CONVERSATIONS).delete(id)
    const msgStore = tx.objectStore(STORE_MESSAGES)
    const idx = msgStore.index(INDEX_MSG_BY_CONV)
    const cursorReq = idx.openKeyCursor(IDBKeyRange.only(id))
    await new Promise<void>((resolve, reject) => {
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result
        if (cursor) {
          msgStore.delete(cursor.primaryKey)
          cursor.continue()
        } else {
          resolve()
        }
      }
      cursorReq.onerror = () => reject(cursorReq.error)
    })
  } catch {
    // ignore
  }
}

export async function loadMessages(conversationId: string): Promise<PersistedMessage[]> {
  const db = await openDB()
  if (!db) return []
  try {
    const tx = db.transaction(STORE_MESSAGES, 'readonly')
    const idx = tx.objectStore(STORE_MESSAGES).index(INDEX_MSG_BY_CONV)
    const all = await wrap(idx.getAll(IDBKeyRange.only(conversationId)))
    return (all as PersistedMessage[]).sort((a, b) => a.createdAt - b.createdAt)
  } catch {
    return []
  }
}

export async function appendMessage(msg: PersistedMessage): Promise<void> {
  const db = await openDB()
  if (!db) return
  try {
    const tx = db.transaction(STORE_MESSAGES, 'readwrite')
    await wrap(tx.objectStore(STORE_MESSAGES).put(msg))
  } catch {
    // ignore
  }
}

export async function updateMessage(
  id: string,
  patch: Partial<Pick<PersistedMessage, 'parts' | 'done' | 'content'>>,
): Promise<void> {
  const db = await openDB()
  if (!db) return
  try {
    const tx = db.transaction(STORE_MESSAGES, 'readwrite')
    const store = tx.objectStore(STORE_MESSAGES)
    const existing = (await wrap(store.get(id))) as PersistedMessage | undefined
    if (!existing) return
    await wrap(store.put({ ...existing, ...patch }))
  } catch {
    // ignore
  }
}
