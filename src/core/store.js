/**
 * Reactive state store using JavaScript Proxy
 * Provides fine-grained subscriptions and automatic UI updates
 */

let storeInstance = null;

export class Store {
  constructor(initialState = {}) {
    if (storeInstance) {
      return storeInstance;
    }

    this.listeners = new Map(); // path string -> Set<callback>
    this.batchedUpdates = new Set();
    this.isBatching = false;
    this.state = this.createProxy(initialState, []);

    storeInstance = this;
  }

  /**
   * Create a reactive proxy for an object
   */
  createProxy(obj, path) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    // Handle arrays
    if (Array.isArray(obj)) {
      return new Proxy(obj, {
        set: (target, key, value) => {
          const oldValue = target[key];
          target[key] = value;
          if (oldValue !== value) {
            this.notify([...path]);
          }
          return true;
        },
        get: (target, key) => {
          const value = target[key];
          if (typeof key === 'string' && !isNaN(parseInt(key))) {
            if (value && typeof value === 'object') {
              return this.createProxy(value, [...path, key]);
            }
          }
          return value;
        }
      });
    }

    // Handle objects
    return new Proxy(obj, {
      set: (target, key, value) => {
        const oldValue = target[key];
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          target[key] = this.createProxy(value, [...path, key]);
        } else {
          target[key] = value;
        }
        if (oldValue !== value) {
          this.notify([...path, key]);
        }
        return true;
      },
      get: (target, key) => {
        const value = target[key];
        if (value && typeof value === 'object') {
          return this.createProxy(value, [...path, key]);
        }
        return value;
      },
      deleteProperty: (target, key) => {
        delete target[key];
        this.notify([...path, key]);
        return true;
      }
    });
  }

  /**
   * Subscribe to state changes at a specific path
   * @param {string|string[]} path - Path to watch (e.g., 'document.layers' or ['document', 'layers'])
   * @param {Function} callback - Called with new state when path changes
   * @returns {Function} Unsubscribe function
   */
  subscribe(path, callback) {
    const pathStr = Array.isArray(path) ? path.join('.') : path;

    if (!this.listeners.has(pathStr)) {
      this.listeners.set(pathStr, new Set());
    }

    this.listeners.get(pathStr).add(callback);

    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(pathStr);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.listeners.delete(pathStr);
        }
      }
    };
  }

  /**
   * Subscribe to all state changes
   */
  subscribeAll(callback) {
    return this.subscribe('*', callback);
  }

  /**
   * Notify listeners of a state change
   */
  notify(changedPath) {
    const changedPathStr = changedPath.join('.');

    if (this.isBatching) {
      this.batchedUpdates.add(changedPathStr);
      return;
    }

    this.notifyPath(changedPathStr);
  }

  notifyPath(changedPathStr) {
    // Notify exact path listeners
    const exactListeners = this.listeners.get(changedPathStr);
    if (exactListeners) {
      exactListeners.forEach(cb => cb(this.get(changedPathStr)));
    }

    // Notify parent path listeners (e.g., 'document' when 'document.layers' changes)
    const pathParts = changedPathStr.split('.');
    for (let i = pathParts.length - 1; i > 0; i--) {
      const parentPath = pathParts.slice(0, i).join('.');
      const parentListeners = this.listeners.get(parentPath);
      if (parentListeners) {
        parentListeners.forEach(cb => cb(this.get(parentPath)));
      }
    }

    // Notify wildcard listeners
    const wildcardListeners = this.listeners.get('*');
    if (wildcardListeners) {
      wildcardListeners.forEach(cb => cb(this.state));
    }
  }

  /**
   * Get a value from state by path
   */
  get(path) {
    const pathParts = typeof path === 'string' ? path.split('.') : path;
    let value = this.state;

    for (const part of pathParts) {
      if (value === undefined || value === null) {
        return undefined;
      }
      value = value[part];
    }

    return value;
  }

  /**
   * Set a value in state by path
   */
  set(path, value) {
    const pathParts = typeof path === 'string' ? path.split('.') : path;
    let target = this.state;

    for (let i = 0; i < pathParts.length - 1; i++) {
      const part = pathParts[i];
      if (target[part] === undefined) {
        target[part] = {};
      }
      target = target[part];
    }

    target[pathParts[pathParts.length - 1]] = value;
  }

  /**
   * Batch multiple updates into a single notification
   */
  batch(updateFn) {
    this.isBatching = true;
    this.batchedUpdates.clear();

    try {
      updateFn();
    } finally {
      this.isBatching = false;

      // Notify all batched paths
      this.batchedUpdates.forEach(path => {
        this.notifyPath(path);
      });

      this.batchedUpdates.clear();
    }
  }

  /**
   * Reset store to initial state
   */
  reset(newState = {}) {
    this.state = this.createProxy(newState, []);
    this.notify([]);
  }
}

/**
 * Get the singleton store instance
 */
export function getStore() {
  if (!storeInstance) {
    throw new Error('Store not initialized. Create a Store instance first.');
  }
  return storeInstance;
}

/**
 * Create initial application state
 */
export function createInitialState() {
  return {
    // Current document
    document: {
      id: null,
      name: 'Untitled',
      width: 1920,
      height: 1080,
      layers: [],
      activeLayerId: null,
      selection: null,
      guides: [],
      rulers: { visible: true },
      background: { color: '#ffffff', transparent: false }
    },

    // Viewport state
    viewport: {
      zoom: 1,
      panX: 0,
      panY: 0,
      rotation: 0
    },

    // Tool state
    tools: {
      active: 'brush',
      previous: null,
      options: {
        brush: {
          size: 20,
          hardness: 100,
          opacity: 100,
          flow: 100,
          spacing: 25,
          pressureSize: true,
          pressureOpacity: false
        },
        eraser: {
          size: 20,
          hardness: 100,
          opacity: 100
        },
        marquee: {
          type: 'rectangle', // rectangle, ellipse
          feather: 0
        },
        magicWand: {
          tolerance: 32,
          contiguous: true,
          antiAlias: true
        }
      }
    },

    // Color state
    colors: {
      foreground: '#000000',
      background: '#ffffff'
    },

    // UI state
    ui: {
      theme: 'dark',
      panels: {
        layers: { visible: true, collapsed: false },
        properties: { visible: true, collapsed: false },
        brushes: { visible: false, collapsed: false },
        history: { visible: true, collapsed: false },
        colors: { visible: true, collapsed: false }
      },
      dialogs: {
        newDocument: false,
        export: false,
        preferences: false
      }
    },

    // History state
    history: {
      undoStack: [],
      redoStack: [],
      maxSize: 50
    },

    // Application state
    app: {
      isLoading: false,
      isDirty: false,
      lastSaved: null,
      recentFiles: []
    }
  };
}
