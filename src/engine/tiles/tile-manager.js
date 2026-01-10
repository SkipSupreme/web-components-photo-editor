/**
 * Tile Manager - Tile-based rendering for large images
 * Breaks images into tiles for efficient rendering and memory management
 */

import { getEventBus, Events } from '../../core/event-bus.js';

// Default tile size (256x256 is optimal for GPU texture uploads)
const DEFAULT_TILE_SIZE = 256;

/**
 * Tile class representing a single tile
 */
export class Tile {
  constructor(x, y, width, height, tileX, tileY) {
    this.x = x;           // Pixel position in document
    this.y = y;
    this.width = width;   // Tile dimensions
    this.height = height;
    this.tileX = tileX;   // Tile grid position
    this.tileY = tileY;
    this.dirty = true;    // Needs re-render
    this.canvas = null;   // Tile canvas (created on demand)
    this.texture = null;  // WebGL texture
    this.lastUsed = 0;    // For LRU cache
  }

  /**
   * Get or create tile canvas
   */
  getCanvas() {
    if (!this.canvas) {
      this.canvas = new OffscreenCanvas(this.width, this.height);
    }
    return this.canvas;
  }

  /**
   * Get 2D context
   */
  getContext() {
    return this.getCanvas().getContext('2d');
  }

  /**
   * Mark tile as dirty (needs re-render)
   */
  invalidate() {
    this.dirty = true;
  }

  /**
   * Mark tile as clean (rendered)
   */
  validate() {
    this.dirty = false;
    this.lastUsed = performance.now();
  }

  /**
   * Dispose of tile resources
   */
  dispose() {
    if (this.canvas) {
      // Clear canvas memory
      this.canvas.width = 0;
      this.canvas.height = 0;
      this.canvas = null;
    }
    this.texture = null;
  }
}

/**
 * Tile Manager - Manages tiles for a document
 */
export class TileManager {
  constructor(options = {}) {
    this.tileSize = options.tileSize || DEFAULT_TILE_SIZE;
    this.tiles = new Map();  // Map<string, Tile>
    this.documentWidth = 0;
    this.documentHeight = 0;
    this.tilesX = 0;
    this.tilesY = 0;
    this.eventBus = getEventBus();
  }

  /**
   * Initialize tiles for document dimensions
   */
  init(width, height) {
    this.documentWidth = width;
    this.documentHeight = height;
    this.tilesX = Math.ceil(width / this.tileSize);
    this.tilesY = Math.ceil(height / this.tileSize);

    // Clear existing tiles
    this.dispose();

    // Create tile grid
    for (let ty = 0; ty < this.tilesY; ty++) {
      for (let tx = 0; tx < this.tilesX; tx++) {
        const x = tx * this.tileSize;
        const y = ty * this.tileSize;
        const tileWidth = Math.min(this.tileSize, width - x);
        const tileHeight = Math.min(this.tileSize, height - y);

        const tile = new Tile(x, y, tileWidth, tileHeight, tx, ty);
        this.tiles.set(this.getTileKey(tx, ty), tile);
      }
    }

    console.log(`TileManager: Created ${this.tiles.size} tiles (${this.tilesX}x${this.tilesY})`);
  }

  /**
   * Get tile key from grid coordinates
   */
  getTileKey(tx, ty) {
    return `${tx},${ty}`;
  }

  /**
   * Get tile at grid position
   */
  getTile(tx, ty) {
    return this.tiles.get(this.getTileKey(tx, ty));
  }

  /**
   * Get tile at pixel position
   */
  getTileAtPixel(x, y) {
    const tx = Math.floor(x / this.tileSize);
    const ty = Math.floor(y / this.tileSize);
    return this.getTile(tx, ty);
  }

  /**
   * Get tiles intersecting a rectangle
   */
  getTilesInRect(x, y, width, height) {
    const tiles = [];
    const startTX = Math.max(0, Math.floor(x / this.tileSize));
    const startTY = Math.max(0, Math.floor(y / this.tileSize));
    const endTX = Math.min(this.tilesX - 1, Math.floor((x + width) / this.tileSize));
    const endTY = Math.min(this.tilesY - 1, Math.floor((y + height) / this.tileSize));

    for (let ty = startTY; ty <= endTY; ty++) {
      for (let tx = startTX; tx <= endTX; tx++) {
        const tile = this.getTile(tx, ty);
        if (tile) {
          tiles.push(tile);
        }
      }
    }

    return tiles;
  }

  /**
   * Get visible tiles based on viewport
   */
  getVisibleTiles(viewport) {
    return this.getTilesInRect(
      viewport.x,
      viewport.y,
      viewport.width,
      viewport.height
    );
  }

  /**
   * Invalidate tiles in a rectangle
   */
  invalidateRect(x, y, width, height) {
    const tiles = this.getTilesInRect(x, y, width, height);
    for (const tile of tiles) {
      tile.invalidate();
    }
    return tiles;
  }

  /**
   * Invalidate all tiles
   */
  invalidateAll() {
    for (const tile of this.tiles.values()) {
      tile.invalidate();
    }
  }

  /**
   * Get all dirty tiles
   */
  getDirtyTiles() {
    const dirty = [];
    for (const tile of this.tiles.values()) {
      if (tile.dirty) {
        dirty.push(tile);
      }
    }
    return dirty;
  }

  /**
   * Render dirty tiles from source canvas
   */
  renderDirtyTiles(sourceCanvas) {
    const dirtyTiles = this.getDirtyTiles();

    for (const tile of dirtyTiles) {
      const ctx = tile.getContext();

      // Clear tile
      ctx.clearRect(0, 0, tile.width, tile.height);

      // Draw portion of source canvas to tile
      ctx.drawImage(
        sourceCanvas,
        tile.x, tile.y, tile.width, tile.height,  // Source rect
        0, 0, tile.width, tile.height              // Dest rect
      );

      tile.validate();
    }

    return dirtyTiles.length;
  }

  /**
   * Composite tiles to target canvas
   */
  compositeToCanvas(targetCanvas, viewport) {
    const ctx = targetCanvas.getContext('2d');
    const visibleTiles = this.getVisibleTiles(viewport);

    for (const tile of visibleTiles) {
      if (tile.canvas) {
        // Calculate position relative to viewport
        const dx = tile.x - viewport.x;
        const dy = tile.y - viewport.y;

        ctx.drawImage(tile.canvas, dx, dy);
      }
    }
  }

  /**
   * Get memory usage estimate
   */
  getMemoryUsage() {
    let bytes = 0;
    for (const tile of this.tiles.values()) {
      if (tile.canvas) {
        // 4 bytes per pixel (RGBA)
        bytes += tile.width * tile.height * 4;
      }
    }
    return bytes;
  }

  /**
   * Dispose of tile resources
   */
  dispose() {
    for (const tile of this.tiles.values()) {
      tile.dispose();
    }
    this.tiles.clear();
  }
}

/**
 * Create a tile manager for a document
 */
export function createTileManager(width, height, options = {}) {
  const manager = new TileManager(options);
  manager.init(width, height);
  return manager;
}
