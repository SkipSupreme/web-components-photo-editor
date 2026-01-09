/**
 * Keyboard shortcut manager with context-aware priority
 * Handles shortcuts that work across Shadow DOM boundaries
 */

import { getEventBus, Events } from './event-bus.js';

/**
 * Shortcut context priorities (higher = more important)
 */
export const ShortcutContext = {
  GLOBAL: 0,
  EDITOR: 10,
  PANEL: 20,
  DIALOG: 30,
  MODAL: 40
};

class ShortcutManager {
  constructor() {
    this.shortcuts = new Map(); // key combo -> array of {handler, context, options}
    this.activeContexts = new Set([ShortcutContext.GLOBAL, ShortcutContext.EDITOR]);
    this.enabled = true;
    this.eventBus = null;
  }

  init() {
    this.eventBus = getEventBus();

    // Listen for keyboard events on document
    document.addEventListener('keydown', this.handleKeyDown.bind(this), true);
  }

  /**
   * Register a keyboard shortcut
   * @param {string} shortcut - Key combination (e.g., 'ctrl+s', 'shift+b', 'delete')
   * @param {Function} handler - Handler function
   * @param {Object} options - Options
   * @param {number} options.context - Context priority
   * @param {boolean} options.allowInInput - Allow in input/textarea
   * @param {string} options.description - Description for help
   */
  register(shortcut, handler, options = {}) {
    const key = this.normalizeShortcut(shortcut);
    const registration = {
      handler,
      context: options.context ?? ShortcutContext.GLOBAL,
      allowInInput: options.allowInInput ?? false,
      description: options.description ?? '',
      shortcut: shortcut
    };

    if (!this.shortcuts.has(key)) {
      this.shortcuts.set(key, []);
    }

    this.shortcuts.get(key).push(registration);

    // Sort by context priority (descending)
    this.shortcuts.get(key).sort((a, b) => b.context - a.context);

    // Return unregister function
    return () => this.unregister(key, handler);
  }

  /**
   * Unregister a shortcut
   */
  unregister(shortcut, handler) {
    const key = this.normalizeShortcut(shortcut);
    const registrations = this.shortcuts.get(key);

    if (registrations) {
      const index = registrations.findIndex(r => r.handler === handler);
      if (index !== -1) {
        registrations.splice(index, 1);
      }
      if (registrations.length === 0) {
        this.shortcuts.delete(key);
      }
    }
  }

  /**
   * Set active context
   */
  pushContext(context) {
    this.activeContexts.add(context);
  }

  /**
   * Remove context
   */
  popContext(context) {
    this.activeContexts.delete(context);
  }

  /**
   * Handle keydown event
   */
  handleKeyDown(event) {
    if (!this.enabled) return;

    // Build key string
    const key = this.getKeyString(event);
    const registrations = this.shortcuts.get(key);

    if (!registrations || registrations.length === 0) return;

    // Check if we're in an input element
    const isInput = this.isInputElement(event.target);

    // Find the highest priority handler that matches active context
    for (const registration of registrations) {
      if (!this.activeContexts.has(registration.context)) continue;
      if (isInput && !registration.allowInInput) continue;

      // Found a match - execute it
      event.preventDefault();
      event.stopPropagation();

      try {
        registration.handler(event);
        this.eventBus?.emit(Events.SHORTCUT_TRIGGERED, {
          shortcut: registration.shortcut,
          description: registration.description
        });
      } catch (error) {
        console.error(`Error in shortcut handler for "${key}":`, error);
      }

      return;
    }
  }

  /**
   * Convert event to key string
   */
  getKeyString(event) {
    const parts = [];

    if (event.ctrlKey || event.metaKey) parts.push('ctrl');
    if (event.altKey) parts.push('alt');
    if (event.shiftKey) parts.push('shift');

    // Get key name
    let key = event.key.toLowerCase();

    // Normalize special keys
    const keyMap = {
      ' ': 'space',
      'arrowup': 'up',
      'arrowdown': 'down',
      'arrowleft': 'left',
      'arrowright': 'right',
      'escape': 'esc',
      '+': 'plus',
      '-': 'minus',
      '=': 'equals',
      '[': 'bracketleft',
      ']': 'bracketright'
    };

    key = keyMap[key] || key;

    // Don't add modifier keys as the main key
    if (!['control', 'alt', 'shift', 'meta'].includes(key)) {
      parts.push(key);
    }

    return parts.join('+');
  }

  /**
   * Normalize shortcut string for consistent lookup
   */
  normalizeShortcut(shortcut) {
    const parts = shortcut.toLowerCase().split('+').map(p => p.trim());
    const modifiers = [];
    let key = '';

    for (const part of parts) {
      if (['ctrl', 'cmd', 'meta', 'control'].includes(part)) {
        modifiers.push('ctrl');
      } else if (part === 'alt' || part === 'option') {
        modifiers.push('alt');
      } else if (part === 'shift') {
        modifiers.push('shift');
      } else {
        key = part;
      }
    }

    // Sort modifiers for consistent order
    modifiers.sort();
    if (key) modifiers.push(key);

    return modifiers.join('+');
  }

  /**
   * Check if element is an input
   */
  isInputElement(element) {
    if (!element) return false;

    const tagName = element.tagName?.toLowerCase();
    if (['input', 'textarea', 'select'].includes(tagName)) {
      return true;
    }

    if (element.isContentEditable) {
      return true;
    }

    // Check shadow DOM
    const root = element.getRootNode();
    if (root instanceof ShadowRoot) {
      return this.isInputElement(root.activeElement);
    }

    return false;
  }

  /**
   * Enable/disable shortcuts
   */
  setEnabled(enabled) {
    this.enabled = enabled;
  }

  /**
   * Get all registered shortcuts for help display
   */
  getShortcutList() {
    const list = [];

    for (const [key, registrations] of this.shortcuts) {
      for (const reg of registrations) {
        list.push({
          shortcut: reg.shortcut,
          description: reg.description,
          context: reg.context
        });
      }
    }

    return list.sort((a, b) => a.shortcut.localeCompare(b.shortcut));
  }
}

// Singleton instance
let shortcutManager = null;

export function getShortcuts() {
  if (!shortcutManager) {
    shortcutManager = new ShortcutManager();
  }
  return shortcutManager;
}

/**
 * Register default application shortcuts
 */
export function registerDefaultShortcuts(app) {
  const shortcuts = getShortcuts();
  const { undo, redo } = app;

  // File operations
  shortcuts.register('ctrl+n', () => app.newDocument(), {
    description: 'New Document',
    context: ShortcutContext.GLOBAL
  });

  shortcuts.register('ctrl+o', () => app.openFile(), {
    description: 'Open File',
    context: ShortcutContext.GLOBAL
  });

  shortcuts.register('ctrl+s', () => app.save(), {
    description: 'Save',
    context: ShortcutContext.GLOBAL
  });

  shortcuts.register('ctrl+shift+s', () => app.saveAs(), {
    description: 'Save As',
    context: ShortcutContext.GLOBAL
  });

  shortcuts.register('ctrl+shift+e', () => app.export(), {
    description: 'Export',
    context: ShortcutContext.GLOBAL
  });

  // Edit operations
  shortcuts.register('ctrl+z', () => undo(), {
    description: 'Undo',
    context: ShortcutContext.EDITOR
  });

  shortcuts.register('ctrl+shift+z', () => redo(), {
    description: 'Redo',
    context: ShortcutContext.EDITOR
  });

  shortcuts.register('ctrl+y', () => redo(), {
    description: 'Redo (Alt)',
    context: ShortcutContext.EDITOR
  });

  // Selection
  shortcuts.register('ctrl+a', () => app.selectAll(), {
    description: 'Select All',
    context: ShortcutContext.EDITOR
  });

  shortcuts.register('ctrl+d', () => app.deselect(), {
    description: 'Deselect',
    context: ShortcutContext.EDITOR
  });

  shortcuts.register('ctrl+shift+i', () => app.invertSelection(), {
    description: 'Invert Selection',
    context: ShortcutContext.EDITOR
  });

  // Tools
  shortcuts.register('v', () => app.setTool('move'), {
    description: 'Move Tool',
    context: ShortcutContext.EDITOR
  });

  shortcuts.register('m', () => app.setTool('marquee'), {
    description: 'Marquee Tool',
    context: ShortcutContext.EDITOR
  });

  shortcuts.register('l', () => app.setTool('lasso'), {
    description: 'Lasso Tool',
    context: ShortcutContext.EDITOR
  });

  shortcuts.register('w', () => app.setTool('magicWand'), {
    description: 'Magic Wand Tool',
    context: ShortcutContext.EDITOR
  });

  shortcuts.register('b', () => app.setTool('brush'), {
    description: 'Brush Tool',
    context: ShortcutContext.EDITOR
  });

  shortcuts.register('e', () => app.setTool('eraser'), {
    description: 'Eraser Tool',
    context: ShortcutContext.EDITOR
  });

  shortcuts.register('g', () => app.setTool('fill'), {
    description: 'Fill Tool',
    context: ShortcutContext.EDITOR
  });

  shortcuts.register('i', () => app.setTool('eyedropper'), {
    description: 'Eyedropper Tool',
    context: ShortcutContext.EDITOR
  });

  // Brush size
  shortcuts.register('bracketleft', () => app.decreaseBrushSize(), {
    description: 'Decrease Brush Size',
    context: ShortcutContext.EDITOR
  });

  shortcuts.register('bracketright', () => app.increaseBrushSize(), {
    description: 'Increase Brush Size',
    context: ShortcutContext.EDITOR
  });

  // View
  shortcuts.register('ctrl+plus', () => app.zoomIn(), {
    description: 'Zoom In',
    context: ShortcutContext.EDITOR
  });

  shortcuts.register('ctrl+equals', () => app.zoomIn(), {
    description: 'Zoom In (Alt)',
    context: ShortcutContext.EDITOR
  });

  shortcuts.register('ctrl+minus', () => app.zoomOut(), {
    description: 'Zoom Out',
    context: ShortcutContext.EDITOR
  });

  shortcuts.register('ctrl+0', () => app.fitToScreen(), {
    description: 'Fit to Screen',
    context: ShortcutContext.EDITOR
  });

  shortcuts.register('ctrl+1', () => app.actualSize(), {
    description: 'Actual Size (100%)',
    context: ShortcutContext.EDITOR
  });

  // Transform
  shortcuts.register('ctrl+t', () => app.startTransform(), {
    description: 'Free Transform',
    context: ShortcutContext.EDITOR
  });

  // Color
  shortcuts.register('x', () => app.swapColors(), {
    description: 'Swap Foreground/Background',
    context: ShortcutContext.EDITOR
  });

  shortcuts.register('d', () => app.resetColors(), {
    description: 'Reset Colors to Default',
    context: ShortcutContext.EDITOR
  });

  // Escape
  shortcuts.register('esc', () => app.cancelOperation(), {
    description: 'Cancel/Deselect',
    context: ShortcutContext.EDITOR
  });

  // Delete
  shortcuts.register('delete', () => app.deleteSelected(), {
    description: 'Delete Selected',
    context: ShortcutContext.EDITOR
  });

  shortcuts.register('backspace', () => app.deleteSelected(), {
    description: 'Delete Selected (Alt)',
    context: ShortcutContext.EDITOR
  });
}
