/**
 * Marquee Selection Tools - Rectangular and Elliptical
 */

import { BaseTool } from '../base-tool.js';
import { getStore } from '../../core/store.js';
import { getEventBus, Events } from '../../core/event-bus.js';
import { Selection, SelectionMode } from '../../document/selection.js';

/**
 * Base class for marquee selection tools
 */
class BaseMarqueeTool extends BaseTool {
  constructor(name, shape) {
    super(name);
    this.shape = shape; // 'rectangle' or 'ellipse'

    this.store = null;
    this.eventBus = null;

    // Selection in progress
    this.isSelecting = false;
    this.startPoint = null;
    this.currentPoint = null;

    // Options
    this.feather = 0;
    this.antiAlias = true;
    this.fixedRatio = false;
    this.fixedSize = false;
    this.ratioWidth = 1;
    this.ratioHeight = 1;
    this.sizeWidth = 100;
    this.sizeHeight = 100;
  }

  onActivate() {
    super.onActivate();
    this.store = getStore();
    this.eventBus = getEventBus();
  }

  onDeactivate() {
    super.onDeactivate();
    this.cancelSelection();
  }

  onPointerDown(event) {
    const app = window.photoEditorApp;
    if (!app || !app.document) return;

    this.isSelecting = true;
    this.startPoint = { x: event.x, y: event.y };
    this.currentPoint = { x: event.x, y: event.y };

    // Emit start event for overlay drawing
    this.eventBus.emit(Events.SELECTION_PREVIEW_START, {
      shape: this.shape,
      start: this.startPoint,
      current: this.currentPoint
    });
  }

  onPointerMove(event) {
    if (!this.isSelecting) return;

    this.currentPoint = { x: event.x, y: event.y };

    // Apply constraints
    const bounds = this.calculateBounds(event.shiftKey, event.altKey);

    // Emit update event for overlay drawing
    this.eventBus.emit(Events.SELECTION_PREVIEW_UPDATE, {
      shape: this.shape,
      bounds: bounds
    });
  }

  onPointerUp(event) {
    if (!this.isSelecting) return;

    const app = window.photoEditorApp;
    if (!app || !app.document) return;

    this.isSelecting = false;
    this.currentPoint = { x: event.x, y: event.y };

    const bounds = this.calculateBounds(event.shiftKey, event.altKey);

    // Determine selection mode based on modifiers
    let mode = SelectionMode.REPLACE;
    if (event.shiftKey && !event.altKey) {
      mode = SelectionMode.ADD;
    } else if (event.altKey && !event.shiftKey) {
      mode = SelectionMode.SUBTRACT;
    } else if (event.shiftKey && event.altKey) {
      mode = SelectionMode.INTERSECT;
    }

    // Create or update selection
    if (!app.selection) {
      app.selection = new Selection(app.document.width, app.document.height);
    }

    // Check for minimum size
    if (bounds.width > 2 && bounds.height > 2) {
      if (this.shape === 'rectangle') {
        app.selection.fromRectangle(bounds.x, bounds.y, bounds.width, bounds.height, mode);
      } else {
        // Ellipse: calculate center and radii from bounds
        const cx = bounds.x + bounds.width / 2;
        const cy = bounds.y + bounds.height / 2;
        const rx = bounds.width / 2;
        const ry = bounds.height / 2;
        app.selection.fromEllipse(cx, cy, rx, ry, mode);
      }

      // Apply feather if set
      if (this.feather > 0) {
        app.selection.featherSelection(this.feather);
      }
    } else if (mode === SelectionMode.REPLACE) {
      // Click without drag = deselect
      app.selection.clear();
    }

    // Clear preview
    this.eventBus.emit(Events.SELECTION_PREVIEW_END);

    // Request render for marching ants
    this.eventBus.emit(Events.RENDER_REQUEST);

    this.startPoint = null;
    this.currentPoint = null;
  }

  onKeyDown(event) {
    if (event.key === 'Escape') {
      this.cancelSelection();
    }
  }

  cancelSelection() {
    if (this.isSelecting) {
      this.isSelecting = false;
      this.startPoint = null;
      this.currentPoint = null;
      this.eventBus?.emit(Events.SELECTION_PREVIEW_END);
    }
  }

  /**
   * Calculate selection bounds from start and current points
   * @param {boolean} constrain - Shift key: constrain to square/circle
   * @param {boolean} fromCenter - Alt key: draw from center
   */
  calculateBounds(constrain, fromCenter) {
    let x1 = this.startPoint.x;
    let y1 = this.startPoint.y;
    let x2 = this.currentPoint.x;
    let y2 = this.currentPoint.y;

    let width = x2 - x1;
    let height = y2 - y1;

    // Constrain to square/circle
    if (constrain && !this.fixedRatio) {
      const size = Math.max(Math.abs(width), Math.abs(height));
      width = Math.sign(width) * size || size;
      height = Math.sign(height) * size || size;
      x2 = x1 + width;
      y2 = y1 + height;
    }

    // Fixed ratio
    if (this.fixedRatio) {
      const ratio = this.ratioWidth / this.ratioHeight;
      if (Math.abs(width) / Math.abs(height) > ratio) {
        width = Math.sign(width) * Math.abs(height) * ratio;
      } else {
        height = Math.sign(height) * Math.abs(width) / ratio;
      }
      x2 = x1 + width;
      y2 = y1 + height;
    }

    // Fixed size
    if (this.fixedSize) {
      width = this.sizeWidth;
      height = this.sizeHeight;
      x2 = x1 + width;
      y2 = y1 + height;
    }

    // Draw from center
    if (fromCenter) {
      x1 = this.startPoint.x - Math.abs(width);
      y1 = this.startPoint.y - Math.abs(height);
      x2 = this.startPoint.x + Math.abs(width);
      y2 = this.startPoint.y + Math.abs(height);
    }

    // Normalize bounds
    return {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1)
    };
  }

  getCursor() {
    return 'crosshair';
  }
}

/**
 * Rectangular Marquee Tool
 */
export class RectangularMarqueeTool extends BaseMarqueeTool {
  constructor() {
    super('rectangularMarquee', 'rectangle');
  }
}

/**
 * Elliptical Marquee Tool
 */
export class EllipticalMarqueeTool extends BaseMarqueeTool {
  constructor() {
    super('ellipticalMarquee', 'ellipse');
  }
}
