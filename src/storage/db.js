/**
 * IndexedDB Setup - Database schema and operations for project storage
 * Handles offline storage of projects, layers, and application state
 */

const DB_NAME = 'photo-editor-db';
const DB_VERSION = 1;

let dbInstance = null;

/**
 * Object store names
 */
export const Stores = {
  PROJECTS: 'projects',
  LAYERS: 'layers',
  THUMBNAILS: 'thumbnails',
  SETTINGS: 'settings',
  RECENT: 'recent'
};

/**
 * Open the database connection
 * @returns {Promise<IDBDatabase>}
 */
export function openDatabase() {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Failed to open database:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;

      // Handle connection errors
      dbInstance.onerror = (event) => {
        console.error('Database error:', event.target.error);
      };

      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      createObjectStores(db);
    };
  });
}

/**
 * Create object stores during database upgrade
 */
function createObjectStores(db) {
  // Projects store - main project metadata
  if (!db.objectStoreNames.contains(Stores.PROJECTS)) {
    const projectsStore = db.createObjectStore(Stores.PROJECTS, { keyPath: 'id' });
    projectsStore.createIndex('name', 'name', { unique: false });
    projectsStore.createIndex('updatedAt', 'updatedAt', { unique: false });
    projectsStore.createIndex('createdAt', 'createdAt', { unique: false });
  }

  // Layers store - layer data (large blobs stored separately)
  if (!db.objectStoreNames.contains(Stores.LAYERS)) {
    const layersStore = db.createObjectStore(Stores.LAYERS, { keyPath: 'id' });
    layersStore.createIndex('projectId', 'projectId', { unique: false });
    layersStore.createIndex('order', 'order', { unique: false });
  }

  // Thumbnails store - project and layer thumbnails
  if (!db.objectStoreNames.contains(Stores.THUMBNAILS)) {
    const thumbnailsStore = db.createObjectStore(Stores.THUMBNAILS, { keyPath: 'id' });
    thumbnailsStore.createIndex('type', 'type', { unique: false });
  }

  // Settings store - app settings and preferences
  if (!db.objectStoreNames.contains(Stores.SETTINGS)) {
    db.createObjectStore(Stores.SETTINGS, { keyPath: 'key' });
  }

  // Recent documents store
  if (!db.objectStoreNames.contains(Stores.RECENT)) {
    const recentStore = db.createObjectStore(Stores.RECENT, { keyPath: 'id' });
    recentStore.createIndex('openedAt', 'openedAt', { unique: false });
  }
}

/**
 * Get a transaction for the specified stores
 * @param {string|string[]} storeNames - Store name(s)
 * @param {string} mode - 'readonly' or 'readwrite'
 * @returns {Promise<IDBTransaction>}
 */
export async function getTransaction(storeNames, mode = 'readonly') {
  const db = await openDatabase();
  const stores = Array.isArray(storeNames) ? storeNames : [storeNames];
  return db.transaction(stores, mode);
}

/**
 * Get an object store
 * @param {string} storeName - Store name
 * @param {string} mode - 'readonly' or 'readwrite'
 * @returns {Promise<IDBObjectStore>}
 */
export async function getStore(storeName, mode = 'readonly') {
  const tx = await getTransaction(storeName, mode);
  return tx.objectStore(storeName);
}

/**
 * Wrap an IDBRequest in a Promise
 * @param {IDBRequest} request
 * @returns {Promise<any>}
 */
export function promisifyRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Wrap a transaction completion in a Promise
 * @param {IDBTransaction} transaction
 * @returns {Promise<void>}
 */
export function promisifyTransaction(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(new Error('Transaction aborted'));
  });
}

// ============ Generic CRUD Operations ============

/**
 * Get a record by key
 * @param {string} storeName
 * @param {string} key
 * @returns {Promise<any>}
 */
export async function get(storeName, key) {
  const store = await getStore(storeName, 'readonly');
  return promisifyRequest(store.get(key));
}

/**
 * Get all records from a store
 * @param {string} storeName
 * @returns {Promise<any[]>}
 */
export async function getAll(storeName) {
  const store = await getStore(storeName, 'readonly');
  return promisifyRequest(store.getAll());
}

/**
 * Get all records by index
 * @param {string} storeName
 * @param {string} indexName
 * @param {IDBKeyRange|any} query
 * @returns {Promise<any[]>}
 */
export async function getAllByIndex(storeName, indexName, query) {
  const store = await getStore(storeName, 'readonly');
  const index = store.index(indexName);
  return promisifyRequest(index.getAll(query));
}

/**
 * Put a record (insert or update)
 * @param {string} storeName
 * @param {any} value
 * @returns {Promise<string>}
 */
export async function put(storeName, value) {
  const store = await getStore(storeName, 'readwrite');
  return promisifyRequest(store.put(value));
}

/**
 * Put multiple records
 * @param {string} storeName
 * @param {any[]} values
 * @returns {Promise<void>}
 */
export async function putAll(storeName, values) {
  const db = await openDatabase();
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);

  for (const value of values) {
    store.put(value);
  }

  return promisifyTransaction(tx);
}

/**
 * Delete a record by key
 * @param {string} storeName
 * @param {string} key
 * @returns {Promise<void>}
 */
export async function remove(storeName, key) {
  const store = await getStore(storeName, 'readwrite');
  return promisifyRequest(store.delete(key));
}

/**
 * Delete multiple records
 * @param {string} storeName
 * @param {string[]} keys
 * @returns {Promise<void>}
 */
export async function removeAll(storeName, keys) {
  const db = await openDatabase();
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);

  for (const key of keys) {
    store.delete(key);
  }

  return promisifyTransaction(tx);
}

/**
 * Clear all records from a store
 * @param {string} storeName
 * @returns {Promise<void>}
 */
export async function clear(storeName) {
  const store = await getStore(storeName, 'readwrite');
  return promisifyRequest(store.clear());
}

/**
 * Count records in a store
 * @param {string} storeName
 * @returns {Promise<number>}
 */
export async function count(storeName) {
  const store = await getStore(storeName, 'readonly');
  return promisifyRequest(store.count());
}

/**
 * Check if a record exists
 * @param {string} storeName
 * @param {string} key
 * @returns {Promise<boolean>}
 */
export async function exists(storeName, key) {
  const result = await get(storeName, key);
  return result !== undefined;
}

// ============ Utility Functions ============

/**
 * Generate a unique ID
 * @returns {string}
 */
export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Close the database connection
 */
export function closeDatabase() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Delete the entire database
 * @returns {Promise<void>}
 */
export function deleteDatabase() {
  closeDatabase();

  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get database size estimate
 * @returns {Promise<{usage: number, quota: number}>}
 */
export async function getStorageEstimate() {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    return {
      usage: estimate.usage || 0,
      quota: estimate.quota || 0,
      usageFormatted: formatBytes(estimate.usage || 0),
      quotaFormatted: formatBytes(estimate.quota || 0),
      percentUsed: ((estimate.usage || 0) / (estimate.quota || 1) * 100).toFixed(1)
    };
  }
  return { usage: 0, quota: 0 };
}

/**
 * Request persistent storage
 * @returns {Promise<boolean>}
 */
export async function requestPersistentStorage() {
  if (navigator.storage && navigator.storage.persist) {
    return await navigator.storage.persist();
  }
  return false;
}

/**
 * Check if storage is persistent
 * @returns {Promise<boolean>}
 */
export async function isStoragePersistent() {
  if (navigator.storage && navigator.storage.persisted) {
    return await navigator.storage.persisted();
  }
  return false;
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
