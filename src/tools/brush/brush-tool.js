/**
 * Brush Tool - Pressure-sensitive painting tool
 */

import { BaseTool } from '../base-tool.js';
import { BrushEngine } from './brush-engine.js';
import { getStore } from '../../core/store.js';
import { getEventBus, Events } from '../../core/event-bus.js';
import { Command, executeCommand, getHistory } from '../../core/commands.js';

/**
 * Command for brush strokes (for undo/redo)
 */
class BrushStrokeCommand extends Command {
  constructor(layerId, beforeImageData, afterImageData, bounds) {
    super('Brush Stroke');
    this.layerId = layerId;
    this.beforeImageData = beforeImageData;
    this.afterImageData = afterImageData;
    this.bounds = bounds;
  }

  execute() {
    const app = window.photoEditorApp;
    if (!app || !app.document) return false;

    const layer = app.document.getLayer(this.layerId);
    if (!layer || !layer.ctx) return false;

    layer.ctx.putImageData(this.afterImageData, this.bounds.x, this.bounds.y);
    layer.dirty = true;
    layer.updateThumbnail();

    getEventBus().emit(Events.RENDER_REQUEST);
    return true;
  }

  undo() {
    const app = window.photoEditorApp;
    if (!app || !app.document) return false;

    const layer = app.document.getLayer(this.layerId);
    if (!layer || !layer.ctx) return false;

    layer.ctx.putImageData(this.beforeImageData, this.bounds.x, this.bounds.y);
    layer.dirty = true;
    layer.updateThumbnail();

    getEventBus().emit(Events.RENDER_REQUEST);
    return true;
  }

  canMergeWith(other) {
    // Merge rapid strokes on same layer within 300ms
    return other instanceof BrushStrokeCommand &&
           other.layerId === this.layerId &&
           (this.timestamp - other.timestamp) < 300;
  }

  merge(other) {
    // Keep the original before state, update after state
    this.afterImageData = other.afterImageData;

    // Expand bounds to include both strokes
    const minX = Math.min(this.bounds.x, other.bounds.x);
    const minY = Math.min(this.bounds.y, other.bounds.y);
    const maxX = Math.max(
      this.bounds.x + this.bounds.width,
      other.bounds.x + other.bounds.width
    );
    const maxY = Math.max(
      this.bounds.y + this.bounds.height,
      other.bounds.y + other.bounds.height
    );

    this.bounds = {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }
}

export class BrushTool extends BaseTool {
  constructor() {
    super('brush');

    this.engine = new BrushEngine();
    this.store = null;
    this.eventBus = null;

    // Stroke state
    this.isDrawing = false;
    this.lastPoint = null;
    this.strokePoints = [];

    // For undo
    this.strokeLayerId = null;
    this.beforeImageData = null;
    this.strokeBounds = null;
  }

  onActivate() {
    super.onActivate();
    this.store = getStore();
    this.eventBus = getEventBus();

    // Load options from store
    this.options = { ...this.store.state.tools.options.brush };
  }

  onPointerDown(event) {
    const app = window.photoEditorApp;
    if (!app || !app.document) return;

    const layer = app.document.getActiveLayer();
    if (!layer || !layer.ctx || layer.locked) return;

    this.isDrawing = true;
    this.strokePoints = [];
    this.strokeLayerId = layer.id;

    // Store before state for undo
    this.beforeImageData = layer.ctx.getImageData(0, 0, layer.width, layer.height);

    // Initialize stroke bounds
    this.strokeBounds = {
      x: Math.floor(event.x - this.options.size),
      y: Math.floor(event.y - this.options.size),
      width: Math.ceil(this.options.size * 2),
      height: Math.ceil(this.options.size * 2)
    };

    // Process first point
    const point = this.engine.processPoint(event);
    this.strokePoints.push(point);
    this.lastPoint = point;

    // Draw initial dab
    this.drawDab(layer, point);

    layer.dirty = true;
    this.eventBus.emit(Events.RENDER_REQUEST);
  }

  onPointerMove(event) {
    if (!this.isDrawing) return;

    const app = window.photoEditorApp;
    if (!app || !app.document) return;

    const layer = app.document.getLayer(this.strokeLayerId);
    if (!layer || !layer.ctx) return;

    // Process point with pressure
    const point = this.engine.processPoint(event);

    // Interpolate between last point and current point
    const interpolatedPoints = this.engine.interpolate(this.lastPoint, point);

    for (const p of interpolatedPoints) {
      this.drawDab(layer, p);
      this.expandBounds(p);
    }

    this.strokePoints.push(point);
    this.lastPoint = point;

    layer.dirty = true;
    this.eventBus.emit(Events.RENDER_REQUEST);
  }

  onPointerUp(event) {
    if (!this.isDrawing) return;

    this.isDrawing = false;

    const app = window.photoEditorApp;
    if (!app || !app.document) return;

    const layer = app.document.getLayer(this.strokeLayerId);
    if (!layer || !layer.ctx) return;

    // Clamp bounds to layer size
    this.strokeBounds.x = Math.max(0, this.strokeBounds.x);
    this.strokeBounds.y = Math.max(0, this.strokeBounds.y);
    this.strokeBounds.width = Math.min(
      layer.width - this.strokeBounds.x,
      this.strokeBounds.width
    );
    this.strokeBounds.height = Math.min(
      layer.height - this.strokeBounds.y,
      this.strokeBounds.height
    );

    // Get after state for undo
    const afterImageData = layer.ctx.getImageData(0, 0, layer.width, layer.height);

    // Create and execute command (for undo support)
    const command = new BrushStrokeCommand(
      this.strokeLayerId,
      this.beforeImageData,
      afterImageData,
      this.strokeBounds
    );

    // Note: we already drew, so just push to history without re-executing
    const history = getHistory();
    history.undoStack.push(command);
    history.redoStack = [];

    this.eventBus.emit(Events.HISTORY_PUSH, { command });
    this.eventBus.emit(Events.DOCUMENT_MODIFIED);

    // Update thumbnail
    layer.updateThumbnail();
    this.eventBus.emit(Events.LAYER_UPDATED, { layer });

    // Reset state
    this.strokePoints = [];
    this.lastPoint = null;
    this.beforeImageData = null;
  }

  drawDab(layer, point) {
    const ctx = layer.ctx;
    const color = this.store.state.colors.foreground;
    const size = this.options.size * (this.options.pressureSize ? point.pressure : 1);
    const opacity = (this.options.opacity / 100) *
                   (this.options.pressureOpacity ? point.pressure : 1);
    const hardness = this.options.hardness / 100;

    const radius = size / 2;

    ctx.save();

    if (hardness >= 0.99) {
      // Hard brush
      ctx.globalAlpha = opacity;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Soft brush with radial gradient
      const gradient = ctx.createRadialGradient(
        point.x, point.y, 0,
        point.x, point.y, radius
      );

      // Parse color to RGB
      const rgb = this.hexToRgb(color);
      const innerColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
      const midColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity * hardness})`;
      const outerColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`;

      gradient.addColorStop(0, innerColor);
      gradient.addColorStop(hardness, midColor);
      gradient.addColorStop(1, outerColor);

      ctx.fillStyle = gradient;
      ctx.fillRect(point.x - radius, point.y - radius, size, size);
    }

    ctx.restore();
  }

  expandBounds(point) {
    const padding = this.options.size;
    const minX = Math.floor(point.x - padding);
    const minY = Math.floor(point.y - padding);
    const maxX = Math.ceil(point.x + padding);
    const maxY = Math.ceil(point.y + padding);

    if (minX < this.strokeBounds.x) {
      this.strokeBounds.width += this.strokeBounds.x - minX;
      this.strokeBounds.x = minX;
    }
    if (minY < this.strokeBounds.y) {
      this.strokeBounds.height += this.strokeBounds.y - minY;
      this.strokeBounds.y = minY;
    }
    if (maxX > this.strokeBounds.x + this.strokeBounds.width) {
      this.strokeBounds.width = maxX - this.strokeBounds.x;
    }
    if (maxY > this.strokeBounds.y + this.strokeBounds.height) {
      this.strokeBounds.height = maxY - this.strokeBounds.y;
    }
  }

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  }

  getCursor() {
    // Return a brush cursor based on size
    return 'crosshair';
  }
}
