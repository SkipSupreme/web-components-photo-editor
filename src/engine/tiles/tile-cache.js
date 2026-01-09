/**
 * Tile Cache - LRU cache for rendered tiles
 * Manages GPU memory and texture resources efficiently
 */

const DEFAULT_MAX_TILES = 256;  // ~64MB at 256x256 RGBA
const DEFAULT_MAX_MEMORY = 256 * 1024 * 1024;  // 256MB

/**
 * LRU Cache for tiles
 */
export class TileCache {
  constructor(options = {}) {
    this.maxTiles = options.maxTiles || DEFAULT_MAX_TILES;
    this.maxMemory = options.maxMemory || DEFAULT_MAX_MEMORY;
    this.cache = new Map();  // Map<string, CacheEntry>
    this.accessOrder = [];   // LRU order tracking
    this.currentMemory = 0;
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Generate cache key for a tile
   */
  getKey(layerId, tileX, tileY) {
    return `${layerId}:${tileX},${tileY}`;
  }

  /**
   * Get a tile from cache
   */
  get(layerId, tileX, tileY) {
    const key = this.getKey(layerId, tileX, tileY);
    const entry = this.cache.get(key);

    if (entry) {
      // Update access order (move to end)
      this.updateAccessOrder(key);
      entry.lastAccess = performance.now();
      this.hits++;
      return entry.data;
    }

    this.misses++;
    return null;
  }

  /**
   * Put a tile in cache
   */
  put(layerId, tileX, tileY, data, memorySize) {
    const key = this.getKey(layerId, tileX, tileY);

    // Remove existing entry if present
    if (this.cache.has(key)) {
      this.remove(key);
    }

    // Evict if necessary
    while (this.shouldEvict(memorySize)) {
      this.evictOldest();
    }

    // Add new entry
    const entry = {
      key,
      layerId,
      tileX,
      tileY,
      data,
      memorySize,
      lastAccess: performance.now(),
      created: performance.now()
    };

    this.cache.set(key, entry);
    this.accessOrder.push(key);
    this.currentMemory += memorySize;
  }

  /**
   * Check if tile exists in cache
   */
  has(layerId, tileX, tileY) {
    return this.cache.has(this.getKey(layerId, tileX, tileY));
  }

  /**
   * Remove a specific tile from cache
   */
  remove(key) {
    const entry = this.cache.get(key);
    if (entry) {
      this.cache.delete(key);
      this.currentMemory -= entry.memorySize;

      // Remove from access order
      const idx = this.accessOrder.indexOf(key);
      if (idx > -1) {
        this.accessOrder.splice(idx, 1);
      }

      // Dispose data if possible
      if (entry.data && entry.data.dispose) {
        entry.data.dispose();
      }
    }
  }

  /**
   * Invalidate all tiles for a layer
   */
  invalidateLayer(layerId) {
    const keysToRemove = [];

    for (const [key, entry] of this.cache) {
      if (entry.layerId === layerId) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      this.remove(key);
    }

    return keysToRemove.length;
  }

  /**
   * Invalidate tiles in a region for a layer
   */
  invalidateRegion(layerId, x, y, width, height, tileSize) {
    const startTX = Math.floor(x / tileSize);
    const startTY = Math.floor(y / tileSize);
    const endTX = Math.ceil((x + width) / tileSize);
    const endTY = Math.ceil((y + height) / tileSize);

    let count = 0;
    for (let ty = startTY; ty <= endTY; ty++) {
      for (let tx = startTX; tx <= endTX; tx++) {
        const key = this.getKey(layerId, tx, ty);
        if (this.cache.has(key)) {
          this.remove(key);
          count++;
        }
      }
    }

    return count;
  }

  /**
   * Update access order for LRU
   */
  updateAccessOrder(key) {
    const idx = this.accessOrder.indexOf(key);
    if (idx > -1) {
      this.accessOrder.splice(idx, 1);
    }
    this.accessOrder.push(key);
  }

  /**
   * Check if eviction is needed
   */
  shouldEvict(newSize) {
    return (
      this.cache.size >= this.maxTiles ||
      this.currentMemory + newSize > this.maxMemory
    );
  }

  /**
   * Evict oldest (least recently used) entry
   */
  evictOldest() {
    if (this.accessOrder.length === 0) return;

    const oldestKey = this.accessOrder[0];
    this.remove(oldestKey);
  }

  /**
   * Clear entire cache
   */
  clear() {
    for (const entry of this.cache.values()) {
      if (entry.data && entry.data.dispose) {
        entry.data.dispose();
      }
    }
    this.cache.clear();
    this.accessOrder = [];
    this.currentMemory = 0;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.hits + this.misses > 0
      ? (this.hits / (this.hits + this.misses) * 100).toFixed(1)
      : 0;

    return {
      entries: this.cache.size,
      maxEntries: this.maxTiles,
      memoryUsed: this.currentMemory,
      memoryMax: this.maxMemory,
      memoryUsedMB: (this.currentMemory / (1024 * 1024)).toFixed(2),
      memoryMaxMB: (this.maxMemory / (1024 * 1024)).toFixed(2),
      hits: this.hits,
      misses: this.misses,
      hitRate: `${hitRate}%`
    };
  }

  /**
   * Trim cache to a percentage of max
   */
  trim(targetPercent = 0.5) {
    const targetSize = Math.floor(this.maxTiles * targetPercent);
    const targetMemory = Math.floor(this.maxMemory * targetPercent);

    while (this.cache.size > targetSize || this.currentMemory > targetMemory) {
      if (this.accessOrder.length === 0) break;
      this.evictOldest();
    }
  }
}

// Singleton instance
let cacheInstance = null;

/**
 * Get the global tile cache instance
 */
export function getTileCache(options = {}) {
  if (!cacheInstance) {
    cacheInstance = new TileCache(options);
  }
  return cacheInstance;
}

/**
 * Reset the tile cache
 */
export function resetTileCache() {
  if (cacheInstance) {
    cacheInstance.clear();
    cacheInstance = null;
  }
}
