/**
 * Transform Tool - Scale, rotate, skew layers
 */

import { BaseTool } from './base-tool.js';
import { getStore } from '../core/store.js';
import { getEventBus, Events } from '../core/event-bus.js';
import { Command, getHistory } from '../core/commands.js';

/**
 * Transform handle types
 */
const HandleType = {
  NONE: 'none',
  TOP_LEFT: 'top-left',
  TOP: 'top',
  TOP_RIGHT: 'top-right',
  RIGHT: 'right',
  BOTTOM_RIGHT: 'bottom-right',
  BOTTOM: 'bottom',
  BOTTOM_LEFT: 'bottom-left',
  LEFT: 'left',
  ROTATE: 'rotate',
  MOVE: 'move'
};

/**
 * Command for layer transforms (undo/redo)
 */
class TransformCommand extends Command {
  constructor(layerId, beforeState, afterState) {
    super('Transform');
    this.layerId = layerId;
    this.beforeState = beforeState;
    this.afterState = afterState;
  }

  execute() {
    const app = window.photoEditorApp;
    if (!app || !app.document) return false;

    const layer = app.document.getLayer(this.layerId);
    if (!layer) return false;

    this.applyState(layer, this.afterState);
    return true;
  }

  undo() {
    const app = window.photoEditorApp;
    if (!app || !app.document) return false;

    const layer = app.document.getLayer(this.layerId);
    if (!layer) return false;

    this.applyState(layer, this.beforeState);
    return true;
  }

  applyState(layer, state) {
    layer.x = state.x;
    layer.y = state.y;
    layer.width = state.width;
    layer.height = state.height;
    layer.rotation = state.rotation;
    layer.scaleX = state.scaleX;
    layer.scaleY = state.scaleY;
    layer.dirty = true;

    getEventBus().emit(Events.LAYER_UPDATED, { layer });
    getEventBus().emit(Events.RENDER_REQUEST);
  }
}

export class TransformTool extends BaseTool {
  constructor() {
    super('transform');

    this.store = null;
    this.eventBus = null;

    // Transform state
    this.isTransforming = false;
    this.activeHandle = HandleType.NONE;
    this.startPoint = null;
    this.startBounds = null;
    this.currentBounds = null;

    // Target layer
    this.targetLayerId = null;
    this.beforeState = null;

    // Handle size for hit testing
    this.handleSize = 8;
    this.rotateHandleDistance = 30;
  }

  onActivate() {
    super.onActivate();
    this.store = getStore();
    this.eventBus = getEventBus();

    // Start transform on active layer
    const app = window.photoEditorApp;
    if (app?.document) {
      const layer = app.document.getActiveLayer();
      if (layer) {
        this.startTransform(layer);
      }
    }
  }

  onDeactivate() {
    super.onDeactivate();
    this.cancelTransform();
  }

  startTransform(layer) {
    this.targetLayerId = layer.id;
    this.beforeState = {
      x: layer.x,
      y: layer.y,
      width: layer.width,
      height: layer.height,
      rotation: layer.rotation || 0,
      scaleX: layer.scaleX || 1,
      scaleY: layer.scaleY || 1
    };

    this.currentBounds = {
      x: layer.x,
      y: layer.y,
      width: layer.width,
      height: layer.height,
      rotation: layer.rotation || 0
    };

    // Show transform handles
    this.eventBus.emit(Events.TRANSFORM_START, {
      bounds: this.currentBounds,
      showRotation: true
    });
  }

  onPointerDown(event) {
    if (!this.targetLayerId) return;

    const app = window.photoEditorApp;
    if (!app || !app.document) return;

    // Hit test handles
    this.activeHandle = this.hitTestHandle(event.x, event.y);
    this.startPoint = { x: event.x, y: event.y };
    this.startBounds = { ...this.currentBounds };

    if (this.activeHandle === HandleType.NONE) {
      // Click outside - apply transform
      this.applyTransform();
      return;
    }

    this.isTransforming = true;
  }

  onPointerMove(event) {
    if (!this.isTransforming || !this.startPoint) return;

    const dx = event.x - this.startPoint.x;
    const dy = event.y - this.startPoint.y;

    // Apply transform based on handle type
    switch (this.activeHandle) {
      case HandleType.MOVE:
        this.currentBounds.x = this.startBounds.x + dx;
        this.currentBounds.y = this.startBounds.y + dy;
        break;

      case HandleType.TOP_LEFT:
        this.resizeFromCorner('top-left', dx, dy, event.shiftKey, event.altKey);
        break;

      case HandleType.TOP_RIGHT:
        this.resizeFromCorner('top-right', dx, dy, event.shiftKey, event.altKey);
        break;

      case HandleType.BOTTOM_RIGHT:
        this.resizeFromCorner('bottom-right', dx, dy, event.shiftKey, event.altKey);
        break;

      case HandleType.BOTTOM_LEFT:
        this.resizeFromCorner('bottom-left', dx, dy, event.shiftKey, event.altKey);
        break;

      case HandleType.TOP:
        this.resizeFromEdge('top', dy, event.altKey);
        break;

      case HandleType.BOTTOM:
        this.resizeFromEdge('bottom', dy, event.altKey);
        break;

      case HandleType.LEFT:
        this.resizeFromEdge('left', dx, event.altKey);
        break;

      case HandleType.RIGHT:
        this.resizeFromEdge('right', dx, event.altKey);
        break;

      case HandleType.ROTATE:
        this.rotateAround(event.x, event.y);
        break;
    }

    // Update layer preview
    this.updateLayerPreview();

    // Update handles display
    this.eventBus.emit(Events.TRANSFORM_UPDATE, {
      bounds: this.currentBounds,
      showRotation: true
    });
  }

  onPointerUp(event) {
    this.isTransforming = false;
    this.activeHandle = HandleType.NONE;
    this.startPoint = null;
    this.startBounds = null;
  }

  onKeyDown(event) {
    if (event.key === 'Escape') {
      this.cancelTransform();
    } else if (event.key === 'Enter') {
      this.applyTransform();
    } else if (event.key === 'ArrowUp') {
      this.nudge(0, event.shiftKey ? -10 : -1);
    } else if (event.key === 'ArrowDown') {
      this.nudge(0, event.shiftKey ? 10 : 1);
    } else if (event.key === 'ArrowLeft') {
      this.nudge(event.shiftKey ? -10 : -1, 0);
    } else if (event.key === 'ArrowRight') {
      this.nudge(event.shiftKey ? 10 : 1, 0);
    }
  }

  nudge(dx, dy) {
    if (!this.currentBounds) return;

    this.currentBounds.x += dx;
    this.currentBounds.y += dy;

    this.updateLayerPreview();
    this.eventBus.emit(Events.TRANSFORM_UPDATE, {
      bounds: this.currentBounds,
      showRotation: true
    });
  }

  resizeFromCorner(corner, dx, dy, constrain, fromCenter) {
    let newX = this.startBounds.x;
    let newY = this.startBounds.y;
    let newWidth = this.startBounds.width;
    let newHeight = this.startBounds.height;

    switch (corner) {
      case 'top-left':
        newX = this.startBounds.x + dx;
        newY = this.startBounds.y + dy;
        newWidth = this.startBounds.width - dx;
        newHeight = this.startBounds.height - dy;
        break;
      case 'top-right':
        newY = this.startBounds.y + dy;
        newWidth = this.startBounds.width + dx;
        newHeight = this.startBounds.height - dy;
        break;
      case 'bottom-right':
        newWidth = this.startBounds.width + dx;
        newHeight = this.startBounds.height + dy;
        break;
      case 'bottom-left':
        newX = this.startBounds.x + dx;
        newWidth = this.startBounds.width - dx;
        newHeight = this.startBounds.height + dy;
        break;
    }

    // Constrain proportions
    if (constrain) {
      const ratio = this.startBounds.width / this.startBounds.height;
      if (Math.abs(newWidth / newHeight) > ratio) {
        newWidth = newHeight * ratio;
      } else {
        newHeight = newWidth / ratio;
      }
    }

    // Resize from center
    if (fromCenter) {
      const centerX = this.startBounds.x + this.startBounds.width / 2;
      const centerY = this.startBounds.y + this.startBounds.height / 2;
      newX = centerX - newWidth / 2;
      newY = centerY - newHeight / 2;
    }

    // Prevent negative dimensions
    if (newWidth > 0 && newHeight > 0) {
      this.currentBounds.x = newX;
      this.currentBounds.y = newY;
      this.currentBounds.width = newWidth;
      this.currentBounds.height = newHeight;
    }
  }

  resizeFromEdge(edge, delta, fromCenter) {
    switch (edge) {
      case 'top':
        if (fromCenter) {
          this.currentBounds.y = this.startBounds.y + delta;
          this.currentBounds.height = this.startBounds.height - delta * 2;
        } else {
          this.currentBounds.y = this.startBounds.y + delta;
          this.currentBounds.height = this.startBounds.height - delta;
        }
        break;
      case 'bottom':
        if (fromCenter) {
          this.currentBounds.y = this.startBounds.y - delta;
          this.currentBounds.height = this.startBounds.height + delta * 2;
        } else {
          this.currentBounds.height = this.startBounds.height + delta;
        }
        break;
      case 'left':
        if (fromCenter) {
          this.currentBounds.x = this.startBounds.x + delta;
          this.currentBounds.width = this.startBounds.width - delta * 2;
        } else {
          this.currentBounds.x = this.startBounds.x + delta;
          this.currentBounds.width = this.startBounds.width - delta;
        }
        break;
      case 'right':
        if (fromCenter) {
          this.currentBounds.x = this.startBounds.x - delta;
          this.currentBounds.width = this.startBounds.width + delta * 2;
        } else {
          this.currentBounds.width = this.startBounds.width + delta;
        }
        break;
    }

    // Prevent negative dimensions
    if (this.currentBounds.width < 1) this.currentBounds.width = 1;
    if (this.currentBounds.height < 1) this.currentBounds.height = 1;
  }

  rotateAround(mouseX, mouseY) {
    const centerX = this.startBounds.x + this.startBounds.width / 2;
    const centerY = this.startBounds.y + this.startBounds.height / 2;

    // Calculate angle from center to mouse
    const angle = Math.atan2(mouseY - centerY, mouseX - centerX);

    // Calculate starting angle
    const startAngle = Math.atan2(
      this.startPoint.y - centerY,
      this.startPoint.x - centerX
    );

    // Rotation delta
    let rotation = (angle - startAngle) * (180 / Math.PI);

    // Add to starting rotation
    this.currentBounds.rotation = (this.startBounds.rotation || 0) + rotation;
  }

  hitTestHandle(x, y) {
    const bounds = this.currentBounds;
    if (!bounds) return HandleType.NONE;

    const hs = this.handleSize;

    // Calculate handle positions
    const handles = {
      [HandleType.TOP_LEFT]: { x: bounds.x, y: bounds.y },
      [HandleType.TOP]: { x: bounds.x + bounds.width / 2, y: bounds.y },
      [HandleType.TOP_RIGHT]: { x: bounds.x + bounds.width, y: bounds.y },
      [HandleType.RIGHT]: { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 },
      [HandleType.BOTTOM_RIGHT]: { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
      [HandleType.BOTTOM]: { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height },
      [HandleType.BOTTOM_LEFT]: { x: bounds.x, y: bounds.y + bounds.height },
      [HandleType.LEFT]: { x: bounds.x, y: bounds.y + bounds.height / 2 },
      [HandleType.ROTATE]: { x: bounds.x + bounds.width / 2, y: bounds.y - this.rotateHandleDistance }
    };

    // Check each handle
    for (const [type, pos] of Object.entries(handles)) {
      if (Math.abs(x - pos.x) <= hs && Math.abs(y - pos.y) <= hs) {
        return type;
      }
    }

    // Check if inside bounds (move)
    if (x >= bounds.x && x <= bounds.x + bounds.width &&
        y >= bounds.y && y <= bounds.y + bounds.height) {
      return HandleType.MOVE;
    }

    return HandleType.NONE;
  }

  updateLayerPreview() {
    const app = window.photoEditorApp;
    if (!app || !app.document) return;

    const layer = app.document.getLayer(this.targetLayerId);
    if (!layer) return;

    // Update layer position and size
    layer.x = this.currentBounds.x;
    layer.y = this.currentBounds.y;

    // Note: actual resizing of layer canvas would require resampling
    // For now, just update the transform properties
    layer.scaleX = this.currentBounds.width / this.beforeState.width;
    layer.scaleY = this.currentBounds.height / this.beforeState.height;
    layer.rotation = this.currentBounds.rotation;

    layer.dirty = true;
    this.eventBus.emit(Events.RENDER_REQUEST);
  }

  applyTransform() {
    const app = window.photoEditorApp;
    if (!app || !app.document || !this.targetLayerId) return;

    const layer = app.document.getLayer(this.targetLayerId);
    if (!layer) return;

    // Create after state
    const afterState = {
      x: this.currentBounds.x,
      y: this.currentBounds.y,
      width: this.currentBounds.width,
      height: this.currentBounds.height,
      rotation: this.currentBounds.rotation || 0,
      scaleX: this.currentBounds.width / this.beforeState.width,
      scaleY: this.currentBounds.height / this.beforeState.height
    };

    // Add to history
    const command = new TransformCommand(this.targetLayerId, this.beforeState, afterState);
    const history = getHistory();
    history.undoStack.push(command);
    history.redoStack = [];

    this.eventBus.emit(Events.HISTORY_PUSH, { command });
    this.eventBus.emit(Events.DOCUMENT_MODIFIED);

    // Hide transform handles
    this.eventBus.emit(Events.TRANSFORM_END);

    // Reset state
    this.targetLayerId = null;
    this.beforeState = null;
    this.currentBounds = null;

    // Switch to move tool
    app.setTool('move');
  }

  cancelTransform() {
    if (!this.beforeState || !this.targetLayerId) return;

    const app = window.photoEditorApp;
    if (!app || !app.document) return;

    const layer = app.document.getLayer(this.targetLayerId);
    if (layer) {
      // Restore original state
      layer.x = this.beforeState.x;
      layer.y = this.beforeState.y;
      layer.scaleX = this.beforeState.scaleX;
      layer.scaleY = this.beforeState.scaleY;
      layer.rotation = this.beforeState.rotation;
      layer.dirty = true;

      this.eventBus.emit(Events.RENDER_REQUEST);
    }

    // Hide transform handles
    this.eventBus.emit(Events.TRANSFORM_END);

    // Reset state
    this.targetLayerId = null;
    this.beforeState = null;
    this.currentBounds = null;
  }

  getCursor() {
    switch (this.activeHandle) {
      case HandleType.TOP_LEFT:
      case HandleType.BOTTOM_RIGHT:
        return 'nwse-resize';
      case HandleType.TOP_RIGHT:
      case HandleType.BOTTOM_LEFT:
        return 'nesw-resize';
      case HandleType.TOP:
      case HandleType.BOTTOM:
        return 'ns-resize';
      case HandleType.LEFT:
      case HandleType.RIGHT:
        return 'ew-resize';
      case HandleType.ROTATE:
        return 'grab';
      case HandleType.MOVE:
        return 'move';
      default:
        return 'default';
    }
  }
}
