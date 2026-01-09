/**
 * Gradient Tool - Draw linear, radial, and angular gradients
 */

import { BaseTool } from './base-tool.js';
import { getStore } from '../core/store.js';
import { getEventBus, Events } from '../core/event-bus.js';
import { Command, getHistory } from '../core/commands.js';

/**
 * Gradient types
 */
export const GradientType = {
  LINEAR: 'linear',
  RADIAL: 'radial',
  ANGULAR: 'angular',
  REFLECTED: 'reflected',
  DIAMOND: 'diamond'
};

/**
 * Command for gradient fills (undo/redo)
 */
class GradientCommand extends Command {
  constructor(layerId, beforeImageData, afterImageData) {
    super('Gradient Fill');
    this.layerId = layerId;
    this.beforeImageData = beforeImageData;
    this.afterImageData = afterImageData;
  }

  execute() {
    const app = window.photoEditorApp;
    if (!app || !app.document) return false;

    const layer = app.document.getLayer(this.layerId);
    if (!layer || !layer.ctx) return false;

    layer.ctx.putImageData(this.afterImageData, 0, 0);
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

    layer.ctx.putImageData(this.beforeImageData, 0, 0);
    layer.dirty = true;
    layer.updateThumbnail();

    getEventBus().emit(Events.RENDER_REQUEST);
    return true;
  }
}

export class GradientTool extends BaseTool {
  constructor() {
    super('gradient');

    this.store = null;
    this.eventBus = null;

    // Gradient state
    this.isDrawing = false;
    this.startPoint = null;
    this.endPoint = null;
    this.layerId = null;
    this.beforeImageData = null;

    // Options
    this.gradientType = GradientType.LINEAR;
    this.opacity = 1;
    this.reverse = false;
    this.dither = true;

    // Gradient stops (foreground to background by default)
    this.stops = null; // Will be set from colors
  }

  onActivate() {
    super.onActivate();
    this.store = getStore();
    this.eventBus = getEventBus();

    // Load options
    const options = this.store.state.tools.options.gradient;
    if (options) {
      this.gradientType = options.type ?? GradientType.LINEAR;
      this.opacity = options.opacity ?? 1;
      this.reverse = options.reverse ?? false;
    }
  }

  onPointerDown(event) {
    const app = window.photoEditorApp;
    if (!app || !app.document) return;

    const layer = app.document.getActiveLayer();
    if (!layer || !layer.ctx || layer.locked) return;

    this.isDrawing = true;
    this.startPoint = { x: event.x, y: event.y };
    this.endPoint = { x: event.x, y: event.y };
    this.layerId = layer.id;

    // Store before state
    this.beforeImageData = layer.ctx.getImageData(0, 0, layer.width, layer.height);

    // Set up gradient colors
    this.updateGradientStops();
  }

  onPointerMove(event) {
    if (!this.isDrawing) return;

    this.endPoint = { x: event.x, y: event.y };

    // Live preview
    this.drawGradient(true);

    // Emit preview event
    this.eventBus.emit('gradient:preview', {
      start: this.startPoint,
      end: this.endPoint,
      type: this.gradientType
    });
  }

  onPointerUp(event) {
    if (!this.isDrawing) return;

    const app = window.photoEditorApp;
    if (!app || !app.document) return;

    this.isDrawing = false;
    this.endPoint = { x: event.x, y: event.y };

    // Draw final gradient
    this.drawGradient(false);

    const layer = app.document.getLayer(this.layerId);
    if (!layer) return;

    // Get after state
    const afterImageData = layer.ctx.getImageData(0, 0, layer.width, layer.height);

    // Add to history
    const command = new GradientCommand(this.layerId, this.beforeImageData, afterImageData);
    const history = getHistory();
    history.undoStack.push(command);
    history.redoStack = [];

    this.eventBus.emit(Events.HISTORY_PUSH, { command });
    this.eventBus.emit(Events.DOCUMENT_MODIFIED);

    layer.dirty = true;
    layer.updateThumbnail();
    this.eventBus.emit(Events.LAYER_UPDATED, { layer });
    this.eventBus.emit(Events.RENDER_REQUEST);

    // Clear state
    this.startPoint = null;
    this.endPoint = null;
    this.beforeImageData = null;
  }

  updateGradientStops() {
    const fg = this.store.state.colors.foreground;
    const bg = this.store.state.colors.background;

    if (this.reverse) {
      this.stops = [
        { offset: 0, color: bg },
        { offset: 1, color: fg }
      ];
    } else {
      this.stops = [
        { offset: 0, color: fg },
        { offset: 1, color: bg }
      ];
    }
  }

  drawGradient(isPreview) {
    const app = window.photoEditorApp;
    if (!app || !app.document) return;

    const layer = app.document.getLayer(this.layerId);
    if (!layer || !layer.ctx) return;

    const ctx = layer.ctx;
    const { startPoint, endPoint } = this;

    // Restore before state for preview
    if (isPreview && this.beforeImageData) {
      ctx.putImageData(this.beforeImageData, 0, 0);
    }

    // Create gradient based on type
    let gradient;

    switch (this.gradientType) {
      case GradientType.LINEAR:
        gradient = ctx.createLinearGradient(
          startPoint.x, startPoint.y,
          endPoint.x, endPoint.y
        );
        break;

      case GradientType.RADIAL:
        const dx = endPoint.x - startPoint.x;
        const dy = endPoint.y - startPoint.y;
        const radius = Math.sqrt(dx * dx + dy * dy);
        gradient = ctx.createRadialGradient(
          startPoint.x, startPoint.y, 0,
          startPoint.x, startPoint.y, radius
        );
        break;

      case GradientType.ANGULAR:
        // Angular gradient needs custom implementation
        this.drawAngularGradient(ctx);
        return;

      case GradientType.REFLECTED:
        // Reflected = linear that mirrors at the end
        gradient = ctx.createLinearGradient(
          startPoint.x, startPoint.y,
          endPoint.x, endPoint.y
        );
        // Add mirrored stops
        this.stops.forEach(stop => {
          gradient.addColorStop(stop.offset * 0.5, stop.color);
        });
        [...this.stops].reverse().forEach(stop => {
          gradient.addColorStop(0.5 + (1 - stop.offset) * 0.5, stop.color);
        });

        ctx.globalAlpha = this.opacity;
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, layer.width, layer.height);
        ctx.globalAlpha = 1;

        if (!isPreview) {
          layer.dirty = true;
        }
        return;

      case GradientType.DIAMOND:
        // Diamond gradient needs custom implementation
        this.drawDiamondGradient(ctx);
        return;

      default:
        gradient = ctx.createLinearGradient(
          startPoint.x, startPoint.y,
          endPoint.x, endPoint.y
        );
    }

    // Add color stops
    this.stops.forEach(stop => {
      gradient.addColorStop(stop.offset, stop.color);
    });

    // Apply gradient
    ctx.globalAlpha = this.opacity;
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, layer.width, layer.height);
    ctx.globalAlpha = 1;

    if (!isPreview) {
      layer.dirty = true;
    }
  }

  drawAngularGradient(ctx) {
    const app = window.photoEditorApp;
    const layer = app.document.getLayer(this.layerId);
    if (!layer) return;

    const { startPoint } = this;
    const width = layer.width;
    const height = layer.height;

    // Get image data for pixel manipulation
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // Parse colors
    const colors = this.stops.map(s => this.hexToRgb(s.color));

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Calculate angle from start point
        const dx = x - startPoint.x;
        const dy = y - startPoint.y;
        let angle = Math.atan2(dy, dx);

        // Normalize to 0-1
        let t = (angle + Math.PI) / (2 * Math.PI);

        // Get color at this position
        const color = this.interpolateColor(colors, t);

        const idx = (y * width + x) * 4;
        data[idx] = color.r;
        data[idx + 1] = color.g;
        data[idx + 2] = color.b;
        data[idx + 3] = Math.round(255 * this.opacity);
      }
    }

    ctx.putImageData(imageData, 0, 0);
    layer.dirty = true;
  }

  drawDiamondGradient(ctx) {
    const app = window.photoEditorApp;
    const layer = app.document.getLayer(this.layerId);
    if (!layer) return;

    const { startPoint, endPoint } = this;
    const width = layer.width;
    const height = layer.height;

    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const maxDist = Math.sqrt(dx * dx + dy * dy);

    if (maxDist === 0) return;

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    const colors = this.stops.map(s => this.hexToRgb(s.color));

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Diamond distance (Manhattan)
        const distX = Math.abs(x - startPoint.x);
        const distY = Math.abs(y - startPoint.y);
        const dist = distX + distY;

        // Normalize
        const t = Math.min(1, dist / maxDist);

        const color = this.interpolateColor(colors, t);

        const idx = (y * width + x) * 4;
        data[idx] = color.r;
        data[idx + 1] = color.g;
        data[idx + 2] = color.b;
        data[idx + 3] = Math.round(255 * this.opacity);
      }
    }

    ctx.putImageData(imageData, 0, 0);
    layer.dirty = true;
  }

  interpolateColor(colors, t) {
    if (colors.length === 1) return colors[0];
    if (t <= 0) return colors[0];
    if (t >= 1) return colors[colors.length - 1];

    // Find the two colors to interpolate between
    const segment = t * (colors.length - 1);
    const idx = Math.floor(segment);
    const localT = segment - idx;

    const c1 = colors[idx];
    const c2 = colors[Math.min(idx + 1, colors.length - 1)];

    return {
      r: Math.round(c1.r + (c2.r - c1.r) * localT),
      g: Math.round(c1.g + (c2.g - c1.g) * localT),
      b: Math.round(c1.b + (c2.b - c1.b) * localT)
    };
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
    return 'crosshair';
  }
}
