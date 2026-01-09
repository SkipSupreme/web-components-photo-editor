/**
 * Command pattern implementation for undo/redo support
 * All user actions that modify the document should be commands
 */

import { getEventBus, Events } from './event-bus.js';
import { getStore } from './store.js';

/**
 * Base Command class - all commands inherit from this
 */
export class Command {
  constructor(name) {
    this.name = name;
    this.timestamp = Date.now();
  }

  /**
   * Execute the command
   * @returns {boolean} Success status
   */
  execute() {
    throw new Error('Command.execute() must be implemented');
  }

  /**
   * Undo the command
   * @returns {boolean} Success status
   */
  undo() {
    throw new Error('Command.undo() must be implemented');
  }

  /**
   * Get a description for the history panel
   */
  getDescription() {
    return this.name;
  }

  /**
   * Check if this command can be merged with another
   * Used for coalescing rapid brush strokes, etc.
   */
  canMergeWith(other) {
    return false;
  }

  /**
   * Merge another command into this one
   */
  merge(other) {
    // Override in subclasses that support merging
  }
}

/**
 * Command that stores a snapshot of state for undo
 */
export class SnapshotCommand extends Command {
  constructor(name, statePath, newValue) {
    super(name);
    this.statePath = statePath;
    this.newValue = newValue;
    this.oldValue = null;
  }

  execute() {
    const store = getStore();
    this.oldValue = structuredClone(store.get(this.statePath));
    store.set(this.statePath, this.newValue);
    return true;
  }

  undo() {
    const store = getStore();
    store.set(this.statePath, this.oldValue);
    return true;
  }
}

/**
 * History manager - manages command history for undo/redo
 */
class HistoryManager {
  constructor() {
    this.undoStack = [];
    this.redoStack = [];
    this.maxSize = 100;
    this.isExecuting = false;
    this.eventBus = null;
  }

  init() {
    this.eventBus = getEventBus();
  }

  /**
   * Execute a command and add it to history
   */
  execute(command) {
    if (this.isExecuting) {
      console.warn('Nested command execution detected');
      return false;
    }

    this.isExecuting = true;

    try {
      const success = command.execute();

      if (success) {
        // Check if we can merge with the last command
        const lastCommand = this.undoStack[this.undoStack.length - 1];
        if (lastCommand && command.canMergeWith(lastCommand)) {
          lastCommand.merge(command);
        } else {
          this.undoStack.push(command);

          // Trim history if needed
          if (this.undoStack.length > this.maxSize) {
            this.undoStack.shift();
          }
        }

        // Clear redo stack when new command is executed
        this.redoStack = [];

        // Mark document as dirty
        const store = getStore();
        store.state.app.isDirty = true;

        this.eventBus?.emit(Events.HISTORY_PUSH, { command });
        this.eventBus?.emit(Events.DOCUMENT_MODIFIED, {});
      }

      return success;
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Undo the last command
   */
  undo() {
    if (this.undoStack.length === 0) {
      return false;
    }

    const command = this.undoStack.pop();

    this.isExecuting = true;
    try {
      const success = command.undo();

      if (success) {
        this.redoStack.push(command);
        this.eventBus?.emit(Events.HISTORY_UNDO, { command });
        this.eventBus?.emit(Events.DOCUMENT_MODIFIED, {});
      } else {
        // Put it back if undo failed
        this.undoStack.push(command);
      }

      return success;
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Redo the last undone command
   */
  redo() {
    if (this.redoStack.length === 0) {
      return false;
    }

    const command = this.redoStack.pop();

    this.isExecuting = true;
    try {
      const success = command.execute();

      if (success) {
        this.undoStack.push(command);
        this.eventBus?.emit(Events.HISTORY_REDO, { command });
        this.eventBus?.emit(Events.DOCUMENT_MODIFIED, {});
      } else {
        // Put it back if redo failed
        this.redoStack.push(command);
      }

      return success;
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Check if undo is available
   */
  canUndo() {
    return this.undoStack.length > 0;
  }

  /**
   * Check if redo is available
   */
  canRedo() {
    return this.redoStack.length > 0;
  }

  /**
   * Get undo stack for history panel
   */
  getUndoStack() {
    return this.undoStack.map((cmd, index) => ({
      index,
      name: cmd.getDescription(),
      timestamp: cmd.timestamp
    }));
  }

  /**
   * Go to a specific point in history
   */
  goTo(index) {
    while (this.undoStack.length > index + 1) {
      this.undo();
    }
    while (this.undoStack.length < index + 1 && this.redoStack.length > 0) {
      this.redo();
    }
  }

  /**
   * Clear all history
   */
  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }
}

// Singleton instance
let historyManager = null;

export function getHistory() {
  if (!historyManager) {
    historyManager = new HistoryManager();
  }
  return historyManager;
}

/**
 * Execute a command (convenience function)
 */
export function executeCommand(command) {
  return getHistory().execute(command);
}

/**
 * Undo (convenience function)
 */
export function undo() {
  return getHistory().undo();
}

/**
 * Redo (convenience function)
 */
export function redo() {
  return getHistory().redo();
}
