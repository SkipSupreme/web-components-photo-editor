/**
 * Lasso Selection Tool - Freeform selection
 */

import { BaseTool } from '../base-tool.js';
import { getStore } from '../../core/store.js';
import { getEventBus, Events } from '../../core/event-bus.js';
import { Selection, SelectionMode } from '../../document/selection.js';

export class LassoTool extends BaseTool {
  constructor() {
    super('lasso');

    this.store = null;
    this.eventBus = null;

    // Selection in progress
    this.isSelecting = false;
    this.points = [];

    // Options
    this.feather = 0;
    this.antiAlias = true;
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
    this.points = [{ x: event.x, y: event.y }];

    // Emit start event for overlay drawing
    this.eventBus.emit(Events.SELECTION_PREVIEW_START, {
      shape: 'path',
      points: this.points
    });
  }

  onPointerMove(event) {
    if (!this.isSelecting) return;

    const lastPoint = this.points[this.points.length - 1];
    const dx = event.x - lastPoint.x;
    const dy = event.y - lastPoint.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Only add point if moved enough (reduces point count)
    if (distance >= 3) {
      this.points.push({ x: event.x, y: event.y });

      // Emit update event for overlay drawing
      this.eventBus.emit(Events.SELECTION_PREVIEW_UPDATE, {
        shape: 'path',
        points: this.points
      });
    }
  }

  onPointerUp(event) {
    if (!this.isSelecting) return;

    const app = window.photoEditorApp;
    if (!app || !app.document) return;

    this.isSelecting = false;

    // Add final point
    this.points.push({ x: event.x, y: event.y });

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

    // Need at least 3 points for a valid path
    if (this.points.length >= 3) {
      app.selection.fromPath(this.points, mode);

      // Apply feather if set
      if (this.feather > 0) {
        app.selection.featherSelection(this.feather);
      }
    } else if (mode === SelectionMode.REPLACE) {
      // Too few points = deselect
      app.selection.clear();
    }

    // Clear preview
    this.eventBus.emit(Events.SELECTION_PREVIEW_END);

    // Request render for marching ants
    this.eventBus.emit(Events.RENDER_REQUEST);

    this.points = [];
  }

  onKeyDown(event) {
    if (event.key === 'Escape') {
      this.cancelSelection();
    }
  }

  cancelSelection() {
    if (this.isSelecting) {
      this.isSelecting = false;
      this.points = [];
      this.eventBus?.emit(Events.SELECTION_PREVIEW_END);
    }
  }

  getCursor() {
    return 'crosshair';
  }
}

/**
 * Polygonal Lasso Tool - Click to add vertices
 */
export class PolygonalLassoTool extends BaseTool {
  constructor() {
    super('polygonalLasso');

    this.store = null;
    this.eventBus = null;

    // Selection in progress
    this.isSelecting = false;
    this.points = [];
    this.currentPoint = null;

    // Options
    this.feather = 0;
    this.antiAlias = true;
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

    if (!this.isSelecting) {
      // Start new selection
      this.isSelecting = true;
      this.points = [{ x: event.x, y: event.y }];
      this.currentPoint = { x: event.x, y: event.y };

      this.eventBus.emit(Events.SELECTION_PREVIEW_START, {
        shape: 'polygon',
        points: this.points,
        currentPoint: this.currentPoint
      });
    } else {
      // Add new vertex
      const newPoint = { x: event.x, y: event.y };

      // Check if closing the polygon (clicking near start)
      const startPoint = this.points[0];
      const dx = newPoint.x - startPoint.x;
      const dy = newPoint.y - startPoint.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 10 && this.points.length >= 3) {
        // Close the polygon
        this.finishSelection(event);
      } else {
        // Add vertex
        this.points.push(newPoint);

        this.eventBus.emit(Events.SELECTION_PREVIEW_UPDATE, {
          shape: 'polygon',
          points: this.points,
          currentPoint: this.currentPoint
        });
      }
    }
  }

  onPointerMove(event) {
    if (!this.isSelecting) return;

    this.currentPoint = { x: event.x, y: event.y };

    this.eventBus.emit(Events.SELECTION_PREVIEW_UPDATE, {
      shape: 'polygon',
      points: this.points,
      currentPoint: this.currentPoint
    });
  }

  onPointerUp(event) {
    // Polygonal lasso uses clicks, not drag
  }

  onKeyDown(event) {
    if (event.key === 'Escape') {
      this.cancelSelection();
    } else if (event.key === 'Enter' && this.points.length >= 3) {
      this.finishSelection(event);
    } else if (event.key === 'Backspace' && this.points.length > 1) {
      // Remove last point
      this.points.pop();
      this.eventBus.emit(Events.SELECTION_PREVIEW_UPDATE, {
        shape: 'polygon',
        points: this.points,
        currentPoint: this.currentPoint
      });
    }
  }

  finishSelection(event) {
    const app = window.photoEditorApp;
    if (!app || !app.document) return;

    this.isSelecting = false;

    // Determine selection mode
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

    if (this.points.length >= 3) {
      app.selection.fromPath(this.points, mode);

      if (this.feather > 0) {
        app.selection.featherSelection(this.feather);
      }
    }

    this.eventBus.emit(Events.SELECTION_PREVIEW_END);
    this.eventBus.emit(Events.RENDER_REQUEST);

    this.points = [];
    this.currentPoint = null;
  }

  cancelSelection() {
    if (this.isSelecting) {
      this.isSelecting = false;
      this.points = [];
      this.currentPoint = null;
      this.eventBus?.emit(Events.SELECTION_PREVIEW_END);
    }
  }

  getCursor() {
    return 'crosshair';
  }
}
