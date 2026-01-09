/**
 * Texture Pool - GPU texture memory management
 * Reuses WebGL textures to avoid allocation overhead
 */

const DEFAULT_POOL_SIZE = 32;
const DEFAULT_TEXTURE_SIZE = 256;

/**
 * Pooled Texture wrapper
 */
class PooledTexture {
  constructor(gl, width, height) {
    this.gl = gl;
    this.width = width;
    this.height = height;
    this.texture = gl.createTexture();
    this.inUse = false;
    this.lastUsed = 0;

    // Initialize texture
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null
    );

    // Set texture parameters
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  /**
   * Upload image data to texture
   */
  upload(source) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);

    if (source instanceof ImageData) {
      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        0, 0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        source
      );
    } else if (source instanceof HTMLCanvasElement ||
               source instanceof OffscreenCanvas ||
               source instanceof ImageBitmap ||
               source instanceof HTMLImageElement) {
      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        0, 0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        source
      );
    }

    this.lastUsed = performance.now();
  }

  /**
   * Bind texture to a texture unit
   */
  bind(unit = 0) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
  }

  /**
   * Dispose of texture
   */
  dispose() {
    if (this.texture) {
      this.gl.deleteTexture(this.texture);
      this.texture = null;
    }
  }
}

/**
 * Texture Pool - Manages reusable textures
 */
export class TexturePool {
  constructor(gl, options = {}) {
    this.gl = gl;
    this.pools = new Map();  // Map<string, PooledTexture[]>
    this.maxPoolSize = options.maxPoolSize || DEFAULT_POOL_SIZE;
    this.defaultSize = options.defaultSize || DEFAULT_TEXTURE_SIZE;
    this.allocated = 0;
    this.reused = 0;
  }

  /**
   * Get pool key for dimensions
   */
  getPoolKey(width, height) {
    return `${width}x${height}`;
  }

  /**
   * Acquire a texture from the pool
   */
  acquire(width = this.defaultSize, height = this.defaultSize) {
    const key = this.getPoolKey(width, height);
    let pool = this.pools.get(key);

    if (!pool) {
      pool = [];
      this.pools.set(key, pool);
    }

    // Find available texture in pool
    for (const texture of pool) {
      if (!texture.inUse) {
        texture.inUse = true;
        texture.lastUsed = performance.now();
        this.reused++;
        return texture;
      }
    }

    // Create new texture if pool not full
    if (pool.length < this.maxPoolSize) {
      const texture = new PooledTexture(this.gl, width, height);
      texture.inUse = true;
      pool.push(texture);
      this.allocated++;
      return texture;
    }

    // Pool full, find least recently used
    let oldest = pool[0];
    for (const texture of pool) {
      if (texture.lastUsed < oldest.lastUsed) {
        oldest = texture;
      }
    }

    oldest.inUse = true;
    oldest.lastUsed = performance.now();
    return oldest;
  }

  /**
   * Release a texture back to the pool
   */
  release(texture) {
    if (texture) {
      texture.inUse = false;
    }
  }

  /**
   * Get or create a texture with specific source
   */
  getTextureForSource(source) {
    let width, height;

    if (source instanceof ImageData) {
      width = source.width;
      height = source.height;
    } else if (source.width && source.height) {
      width = source.width;
      height = source.height;
    } else {
      width = this.defaultSize;
      height = this.defaultSize;
    }

    const texture = this.acquire(width, height);
    texture.upload(source);
    return texture;
  }

  /**
   * Trim unused textures from pools
   */
  trim() {
    const cutoff = performance.now() - 30000; // 30 seconds

    for (const [key, pool] of this.pools) {
      const toRemove = [];

      for (let i = 0; i < pool.length; i++) {
        const texture = pool[i];
        if (!texture.inUse && texture.lastUsed < cutoff) {
          texture.dispose();
          toRemove.push(i);
        }
      }

      // Remove in reverse order to maintain indices
      for (let i = toRemove.length - 1; i >= 0; i--) {
        pool.splice(toRemove[i], 1);
      }

      // Remove empty pools
      if (pool.length === 0) {
        this.pools.delete(key);
      }
    }
  }

  /**
   * Clear all pools
   */
  clear() {
    for (const pool of this.pools.values()) {
      for (const texture of pool) {
        texture.dispose();
      }
    }
    this.pools.clear();
    this.allocated = 0;
    this.reused = 0;
  }

  /**
   * Get pool statistics
   */
  getStats() {
    let total = 0;
    let inUse = 0;
    let memoryBytes = 0;

    for (const pool of this.pools.values()) {
      for (const texture of pool) {
        total++;
        if (texture.inUse) inUse++;
        memoryBytes += texture.width * texture.height * 4;
      }
    }

    return {
      pools: this.pools.size,
      totalTextures: total,
      inUse,
      available: total - inUse,
      allocated: this.allocated,
      reused: this.reused,
      reuseRate: this.allocated > 0
        ? ((this.reused / (this.allocated + this.reused)) * 100).toFixed(1) + '%'
        : '0%',
      memoryMB: (memoryBytes / (1024 * 1024)).toFixed(2)
    };
  }
}

// Singleton instance
let poolInstance = null;

/**
 * Initialize texture pool with WebGL context
 */
export function initTexturePool(gl, options = {}) {
  if (poolInstance) {
    poolInstance.clear();
  }
  poolInstance = new TexturePool(gl, options);
  return poolInstance;
}

/**
 * Get the global texture pool instance
 */
export function getTexturePool() {
  return poolInstance;
}

/**
 * Dispose of the texture pool
 */
export function disposeTexturePool() {
  if (poolInstance) {
    poolInstance.clear();
    poolInstance = null;
  }
}
