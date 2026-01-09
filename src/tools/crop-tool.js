/**
 * Crop Tool - Crop the canvas to a selected region
 */

import { BaseTool } from './base-tool.js';
import { getStore } from '../core/store.js';
import { getEventBus, Events } from '../core/event-bus.js';

export class CropTool extends BaseTool {
  constructor() {
    super('crop');

    this.store = null;
    this.eventBus = null;

    // Crop state
    this.isDefining = false;
    this.cropBounds = null;
    this.startPoint = null;
    this.activeHandle = null;

    // Options
    this.aspectRatio = null; // null = free, or { width: 16, height: 9 }
    this.fixedSize = null;   // null = free, or { width: 800, height: 600 }

    // Handle size for hit testing
    this.handleSize = 10;
  }

  onActivate() {
    super.onActivate();
    this.store = getStore();
    this.eventBus = getEventBus();

    // Initialize crop bounds to full canvas
    const app = window.photoEditorApp;
    if (app?.document) {
      this.cropBounds = {
        x: 0,
        y: 0,
        width: app.document.width,
        height: app.document.height
      };
      this.showCropOverlay();
    }
  }

  onDeactivate() {
    super.onDeactivate();
    this.hideCropOverlay();
    this.cropBounds = null;
  }

  onPointerDown(event) {
    if (!this.cropBounds) return;

    // Check if clicking a handle
    this.activeHandle = this.hitTestHandle(event.x, event.y);
    this.startPoint = { x: event.x, y: event.y };
    this.startBounds = { ...this.cropBounds };

    if (this.activeHandle === 'inside') {
      // Start dragging the crop area
      this.isDefining = false;
    } else if (this.activeHandle) {
      // Resizing from a handle
      this.isDefining = false;
    } else {
      // Define new crop area
      this.isDefining = true;
      this.cropBounds = {
        x: event.x,
        y: event.y,
        width: 0,
        height: 0
      };
    }
  }

  onPointerMove(event) {
    if (!this.startPoint) {
      // Just hovering - update cursor
      const handle = this.hitTestHandle(event.x, event.y);
      this.updateCursor(handle);
      return;
    }

    const dx = event.x - this.startPoint.x;
    const dy = event.y - this.startPoint.y;

    if (this.isDefining) {
      // Defining new crop area
      this.cropBounds.width = Math.abs(dx);
      this.cropBounds.height = Math.abs(dy);

      if (dx < 0) this.cropBounds.x = event.x;
      if (dy < 0) this.cropBounds.y = event.y;

      // Apply aspect ratio constraint
      if (event.shiftKey || this.aspectRatio) {
        const ratio = this.aspectRatio?.width / this.aspectRatio?.height || 1;
        if (this.cropBounds.width / this.cropBounds.height > ratio) {
          this.cropBounds.width = this.cropBounds.height * ratio;
        } else {
          this.cropBounds.height = this.cropBounds.width / ratio;
        }
      }

    } else if (this.activeHandle === 'inside') {
      // Moving the crop area
      this.cropBounds.x = this.startBounds.x + dx;
      this.cropBounds.y = this.startBounds.y + dy;

    } else if (this.activeHandle) {
      // Resizing from handle
      this.resizeFromHandle(this.activeHandle, dx, dy, event.shiftKey);
    }

    // Clamp to document bounds
    this.clampBounds();

    // Update overlay
    this.updateCropOverlay();
  }

  onPointerUp(event) {
    this.startPoint = null;
    this.activeHandle = null;
    this.isDefining = false;

    // Ensure minimum size
    if (this.cropBounds.width < 10 || this.cropBounds.height < 10) {
      const app = window.photoEditorApp;
      if (app?.document) {
        this.cropBounds = {
          x: 0,
          y: 0,
          width: app.document.width,
          height: app.document.height
        };
      }
    }

    this.updateCropOverlay();
  }

  onKeyDown(event) {
    if (event.key === 'Enter') {
      this.applyCrop();
    } else if (event.key === 'Escape') {
      this.cancelCrop();
    }
  }

  hitTestHandle(x, y) {
    if (!this.cropBounds) return null;

    const { x: bx, y: by, width, height } = this.cropBounds;
    const hs = this.handleSize;

    // Corner handles
    const corners = {
      'nw': { x: bx, y: by },
      'ne': { x: bx + width, y: by },
      'se': { x: bx + width, y: by + height },
      'sw': { x: bx, y: by + height }
    };

    for (const [name, pos] of Object.entries(corners)) {
      if (Math.abs(x - pos.x) <= hs && Math.abs(y - pos.y) <= hs) {
        return name;
      }
    }

    // Edge handles
    const edges = {
      'n': { x: bx + width / 2, y: by },
      'e': { x: bx + width, y: by + height / 2 },
      's': { x: bx + width / 2, y: by + height },
      'w': { x: bx, y: by + height / 2 }
    };

    for (const [name, pos] of Object.entries(edges)) {
      if (Math.abs(x - pos.x) <= hs && Math.abs(y - pos.y) <= hs) {
        return name;
      }
    }

    // Inside the crop area?
    if (x >= bx && x <= bx + width && y >= by && y <= by + height) {
      return 'inside';
    }

    return null;
  }

  resizeFromHandle(handle, dx, dy, constrain) {
    const b = this.startBounds;

    switch (handle) {
      case 'nw':
        this.cropBounds.x = b.x + dx;
        this.cropBounds.y = b.y + dy;
        this.cropBounds.width = b.width - dx;
        this.cropBounds.height = b.height - dy;
        break;
      case 'ne':
        this.cropBounds.y = b.y + dy;
        this.cropBounds.width = b.width + dx;
        this.cropBounds.height = b.height - dy;
        break;
      case 'se':
        this.cropBounds.width = b.width + dx;
        this.cropBounds.height = b.height + dy;
        break;
      case 'sw':
        this.cropBounds.x = b.x + dx;
        this.cropBounds.width = b.width - dx;
        this.cropBounds.height = b.height + dy;
        break;
      case 'n':
        this.cropBounds.y = b.y + dy;
        this.cropBounds.height = b.height - dy;
        break;
      case 's':
        this.cropBounds.height = b.height + dy;
        break;
      case 'w':
        this.cropBounds.x = b.x + dx;
        this.cropBounds.width = b.width - dx;
        break;
      case 'e':
        this.cropBounds.width = b.width + dx;
        break;
    }

    // Constrain aspect ratio
    if (constrain || this.aspectRatio) {
      const ratio = this.aspectRatio?.width / this.aspectRatio?.height || b.width / b.height;
      if (['n', 's', 'ne', 'nw', 'se', 'sw'].includes(handle)) {
        this.cropBounds.width = this.cropBounds.height * ratio;
      } else {
        this.cropBounds.height = this.cropBounds.width / ratio;
      }
    }

    // Prevent negative dimensions
    if (this.cropBounds.width < 1) {
      this.cropBounds.width = 1;
    }
    if (this.cropBounds.height < 1) {
      this.cropBounds.height = 1;
    }
  }

  clampBounds() {
    const app = window.photoEditorApp;
    if (!app?.document) return;

    const doc = app.document;

    this.cropBounds.x = Math.max(0, Math.min(this.cropBounds.x, doc.width - 1));
    this.cropBounds.y = Math.max(0, Math.min(this.cropBounds.y, doc.height - 1));
    this.cropBounds.width = Math.min(this.cropBounds.width, doc.width - this.cropBounds.x);
    this.cropBounds.height = Math.min(this.cropBounds.height, doc.height - this.cropBounds.y);
  }

  updateCursor(handle) {
    const cursors = {
      'nw': 'nwse-resize',
      'ne': 'nesw-resize',
      'se': 'nwse-resize',
      'sw': 'nesw-resize',
      'n': 'ns-resize',
      's': 'ns-resize',
      'e': 'ew-resize',
      'w': 'ew-resize',
      'inside': 'move'
    };

    // Update canvas cursor
    const canvas = document.querySelector('editor-canvas');
    if (canvas) {
      canvas.style.cursor = cursors[handle] || 'crosshair';
    }
  }

  showCropOverlay() {
    this.eventBus.emit('crop:show', { bounds: this.cropBounds });
  }

  updateCropOverlay() {
    this.eventBus.emit('crop:update', { bounds: this.cropBounds });
  }

  hideCropOverlay() {
    this.eventBus.emit('crop:hide');
  }

  applyCrop() {
    const app = window.photoEditorApp;
    if (!app?.document || !this.cropBounds) return;

    const doc = app.document;
    const { x, y, width, height } = this.cropBounds;

    // Round values
    const cropX = Math.round(x);
    const cropY = Math.round(y);
    const cropWidth = Math.round(width);
    const cropHeight = Math.round(height);

    if (cropWidth <= 0 || cropHeight <= 0) return;

    // Crop each layer
    for (const layer of doc.layers) {
      if (!layer.canvas || !layer.ctx) continue;

      // Get the cropped region
      const imageData = layer.ctx.getImageData(cropX, cropY, cropWidth, cropHeight);

      // Resize layer canvas
      layer.width = cropWidth;
      layer.height = cropHeight;
      layer.canvas.width = cropWidth;
      layer.canvas.height = cropHeight;

      // Put the cropped data
      layer.ctx.putImageData(imageData, 0, 0);

      // Update layer position
      layer.x = Math.max(0, layer.x - cropX);
      layer.y = Math.max(0, layer.y - cropY);

      layer.dirty = true;
      layer.updateThumbnail();
    }

    // Update document size
    doc.width = cropWidth;
    doc.height = cropHeight;

    // Sync to store
    doc.syncToStore();

    this.eventBus.emit(Events.DOCUMENT_MODIFIED);
    this.eventBus.emit(Events.RENDER_REQUEST);

    // Switch back to move tool
    app.setTool('move');
  }

  cancelCrop() {
    this.hideCropOverlay();

    const app = window.photoEditorApp;
    if (app) {
      app.setTool('move');
    }
  }

  getCursor() {
    return 'crosshair';
  }
}
