/**
 * Event Bus - PubSub pattern for decoupled component communication
 * Enables components to communicate without direct references
 */

let eventBusInstance = null;

export class EventBus {
  constructor() {
    if (eventBusInstance) {
      return eventBusInstance;
    }

    this.listeners = new Map();
    this.onceListeners = new Map();

    eventBusInstance = this;
  }

  /**
   * Subscribe to an event
   * @param {string} event - Event name
   * @param {Function} callback - Handler function
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    this.listeners.get(event).add(callback);

    return () => this.off(event, callback);
  }

  /**
   * Subscribe to an event once
   */
  once(event, callback) {
    if (!this.onceListeners.has(event)) {
      this.onceListeners.set(event, new Set());
    }

    this.onceListeners.get(event).add(callback);

    return () => {
      const listeners = this.onceListeners.get(event);
      if (listeners) {
        listeners.delete(callback);
      }
    };
  }

  /**
   * Unsubscribe from an event
   */
  off(event, callback) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(callback);
      if (listeners.size === 0) {
        this.listeners.delete(event);
      }
    }

    const onceListeners = this.onceListeners.get(event);
    if (onceListeners) {
      onceListeners.delete(callback);
      if (onceListeners.size === 0) {
        this.onceListeners.delete(event);
      }
    }
  }

  /**
   * Emit an event
   * @param {string} event - Event name
   * @param {*} data - Data to pass to handlers
   */
  emit(event, data) {
    // Regular listeners
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event handler for "${event}":`, error);
        }
      });
    }

    // Once listeners
    const onceListeners = this.onceListeners.get(event);
    if (onceListeners) {
      onceListeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in once handler for "${event}":`, error);
        }
      });
      this.onceListeners.delete(event);
    }
  }

  /**
   * Remove all listeners for an event (or all events)
   */
  clear(event = null) {
    if (event) {
      this.listeners.delete(event);
      this.onceListeners.delete(event);
    } else {
      this.listeners.clear();
      this.onceListeners.clear();
    }
  }

  /**
   * Get count of listeners for an event
   */
  listenerCount(event) {
    const regular = this.listeners.get(event)?.size || 0;
    const once = this.onceListeners.get(event)?.size || 0;
    return regular + once;
  }
}

/**
 * Get singleton event bus instance
 */
export function getEventBus() {
  if (!eventBusInstance) {
    eventBusInstance = new EventBus();
  }
  return eventBusInstance;
}

/**
 * Standard application events
 */
export const Events = {
  // Document events
  DOCUMENT_CREATED: 'document:created',
  DOCUMENT_OPENED: 'document:opened',
  DOCUMENT_SAVED: 'document:saved',
  DOCUMENT_CLOSED: 'document:closed',
  DOCUMENT_MODIFIED: 'document:modified',

  // Layer events
  LAYER_ADDED: 'layer:added',
  LAYER_REMOVED: 'layer:removed',
  LAYER_SELECTED: 'layer:selected',
  LAYER_UPDATED: 'layer:updated',
  LAYER_REORDERED: 'layer:reordered',
  LAYER_VISIBILITY_CHANGED: 'layer:visibility',

  // Adjustment layer events
  ADJUSTMENT_LAYER_CREATED: 'adjustment:created',
  ADJUSTMENT_LAYER_UPDATED: 'adjustment:updated',

  // Tool events
  TOOL_CHANGED: 'tool:changed',
  TOOL_OPTIONS_CHANGED: 'tool:options',

  // Viewport events
  VIEWPORT_CHANGED: 'viewport:changed',
  VIEWPORT_ZOOM: 'viewport:zoom',
  VIEWPORT_PAN: 'viewport:pan',

  // Selection events
  SELECTION_CHANGED: 'selection:changed',
  SELECTION_CLEARED: 'selection:cleared',
  SELECTION_INVERTED: 'selection:inverted',
  SELECTION_PREVIEW_START: 'selection:preview:start',
  SELECTION_PREVIEW_UPDATE: 'selection:preview:update',
  SELECTION_PREVIEW_END: 'selection:preview:end',

  // Transform events
  TRANSFORM_START: 'transform:start',
  TRANSFORM_UPDATE: 'transform:update',
  TRANSFORM_END: 'transform:end',

  // History events
  HISTORY_PUSH: 'history:push',
  HISTORY_UNDO: 'history:undo',
  HISTORY_REDO: 'history:redo',

  // Color events
  COLOR_FOREGROUND_CHANGED: 'color:foreground',
  COLOR_BACKGROUND_CHANGED: 'color:background',
  COLOR_SWAPPED: 'color:swapped',

  // Render events
  RENDER_REQUEST: 'render:request',
  RENDER_COMPLETE: 'render:complete',
  RENDER_LAYER: 'render:layer',

  // UI events
  PANEL_TOGGLED: 'ui:panel:toggled',
  DIALOG_OPENED: 'ui:dialog:opened',
  DIALOG_CLOSED: 'ui:dialog:closed',
  THEME_CHANGED: 'ui:theme:changed',

  // File events
  FILE_IMPORT_START: 'file:import:start',
  FILE_IMPORT_PROGRESS: 'file:import:progress',
  FILE_IMPORT_COMPLETE: 'file:import:complete',
  FILE_IMPORT_ERROR: 'file:import:error',
  FILE_EXPORT_START: 'file:export:start',
  FILE_EXPORT_COMPLETE: 'file:export:complete',
  FILE_EXPORT_ERROR: 'file:export:error',

  // Canvas events
  CANVAS_POINTER_DOWN: 'canvas:pointer:down',
  CANVAS_POINTER_MOVE: 'canvas:pointer:move',
  CANVAS_POINTER_UP: 'canvas:pointer:up',

  // Keyboard events
  SHORTCUT_TRIGGERED: 'shortcut:triggered'
};
