/**
 * Offline message queue backed by IndexedDB.
 * When the API is unreachable, messages are stored here and
 * retried automatically when connectivity is restored.
 */

const DB_NAME = 'hearth-offline'
const DB_VERSION = 1
const STORE_NAME = 'queue'

let db = null

async function openDb() {
  if (db) return db
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const d = e.target.result
      if (!d.objectStoreNames.contains(STORE_NAME)) {
        const store = d.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
        store.createIndex('conversationId', 'conversationId', { unique: false })
        store.createIndex('status', 'status', { unique: false })
      }
    }
    req.onsuccess = (e) => { db = e.target.result; resolve(db) }
    req.onerror = () => reject(req.error)
  })
}

/**
 * Add a message to the offline queue.
 * @param {{ conversationId: number, content: string, attachments: string[], profileId: number }} item
 * @returns {Promise<number>} queue entry id
 */
export async function enqueueMessage(item) {
  const d = await openDb()
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE_NAME, 'readwrite')
    const req = tx.objectStore(STORE_NAME).add({
      conversationId: item.conversationId,
      content: item.content,
      attachments: item.attachments || [],
      profileId: item.profileId,
      status: 'pending',
      createdAt: Date.now(),
      retries: 0,
    })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/**
 * Get all pending queued messages, oldest first.
 */
export async function getPendingMessages() {
  const d = await openDb()
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).index('status').getAll('pending')
    req.onsuccess = () => resolve((req.result || []).sort((a, b) => a.createdAt - b.createdAt))
    req.onerror = () => reject(req.error)
  })
}

/**
 * Mark a queued message as sent and remove it.
 */
export async function removeQueuedMessage(id) {
  const d = await openDb()
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE_NAME, 'readwrite')
    const req = tx.objectStore(STORE_NAME).delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

/**
 * Increment retry count. If > 3, mark as failed.
 */
export async function incrementRetry(id) {
  const d = await openDb()
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const getReq = store.get(id)
    getReq.onsuccess = () => {
      const entry = getReq.result
      if (!entry) { resolve(); return }
      entry.retries = (entry.retries || 0) + 1
      if (entry.retries >= 3) entry.status = 'failed'
      const putReq = store.put(entry)
      putReq.onsuccess = () => resolve(entry)
      putReq.onerror = () => reject(putReq.error)
    }
    getReq.onerror = () => reject(getReq.error)
  })
}

/**
 * Count pending messages for a conversation.
 */
export async function getPendingCountForConversation(conversationId) {
  const all = await getPendingMessages()
  return all.filter((m) => m.conversationId === conversationId).length
}

// Online/offline event tracking
let isOnline = navigator.onLine
const onlineListeners = []

window.addEventListener('online', () => {
  isOnline = true
  onlineListeners.forEach((fn) => fn())
})
window.addEventListener('offline', () => { isOnline = false })

export function getIsOnline() { return isOnline }

/**
 * Register a callback to be called when connectivity is restored.
 */
export function onOnline(fn) {
  onlineListeners.push(fn)
  return () => {
    const idx = onlineListeners.indexOf(fn)
    if (idx >= 0) onlineListeners.splice(idx, 1)
  }
}
