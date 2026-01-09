/**
 * Fill Tool - Flood fill with color
 */

import { BaseTool } from './base-tool.js';
import { getStore } from '../core/store.js';
import { getEventBus, Events } from '../core/event-bus.js';
import { Command, getHistory } from '../core/commands.js';

class FillCommand extends Command {
  constructor(layerId, beforeImageData, afterImageData) {
    super('Fill');
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

export class FillTool extends BaseTool {
  constructor() {
    super('fill');

    this.store = null;
    this.eventBus = null;
    this.tolerance = 32;
  }

  onActivate() {
    super.onActivate();
    this.store = getStore();
    this.eventBus = getEventBus();
  }

  onPointerDown(event) {
    const app = window.photoEditorApp;
    if (!app || !app.document) return;

    const layer = app.document.getActiveLayer();
    if (!layer || !layer.ctx || layer.locked) return;

    const x = Math.floor(event.x - layer.x);
    const y = Math.floor(event.y - layer.y);

    if (x < 0 || x >= layer.width || y < 0 || y >= layer.height) return;

    // Get before state
    const beforeImageData = layer.ctx.getImageData(0, 0, layer.width, layer.height);

    // Perform flood fill
    const color = this.store.state.colors.foreground;
    const fillColor = this.hexToRgb(color);

    this.floodFill(layer, x, y, fillColor, this.tolerance);

    // Get after state
    const afterImageData = layer.ctx.getImageData(0, 0, layer.width, layer.height);

    // Add to history
    const command = new FillCommand(layer.id, beforeImageData, afterImageData);

    const history = getHistory();
    history.undoStack.push(command);
    history.redoStack = [];

    this.eventBus.emit(Events.HISTORY_PUSH, { command });
    this.eventBus.emit(Events.DOCUMENT_MODIFIED);

    layer.dirty = true;
    layer.updateThumbnail();
    this.eventBus.emit(Events.LAYER_UPDATED, { layer });
    this.eventBus.emit(Events.RENDER_REQUEST);
  }

  floodFill(layer, startX, startY, fillColor, tolerance) {
    const ctx = layer.ctx;
    const imageData = ctx.getImageData(0, 0, layer.width, layer.height);
    const data = imageData.data;
    const width = layer.width;
    const height = layer.height;

    // Get target color at start position
    const startIdx = (startY * width + startX) * 4;
    const targetColor = {
      r: data[startIdx],
      g: data[startIdx + 1],
      b: data[startIdx + 2],
      a: data[startIdx + 3]
    };

    // Don't fill if same color
    if (this.colorsMatch(targetColor, fillColor, 0)) return;

    // Visited pixels
    const visited = new Uint8Array(width * height);

    // Stack-based flood fill
    const stack = [[startX, startY]];

    while (stack.length > 0) {
      const [x, y] = stack.pop();

      if (x < 0 || x >= width || y < 0 || y >= height) continue;

      const pixelIdx = y * width + x;
      if (visited[pixelIdx]) continue;

      const idx = pixelIdx * 4;
      const pixelColor = {
        r: data[idx],
        g: data[idx + 1],
        b: data[idx + 2],
        a: data[idx + 3]
      };

      if (!this.colorsMatch(pixelColor, targetColor, tolerance)) continue;

      // Fill this pixel
      visited[pixelIdx] = 1;
      data[idx] = fillColor.r;
      data[idx + 1] = fillColor.g;
      data[idx + 2] = fillColor.b;
      data[idx + 3] = 255;

      // Add neighbors
      stack.push([x + 1, y]);
      stack.push([x - 1, y]);
      stack.push([x, y + 1]);
      stack.push([x, y - 1]);
    }

    ctx.putImageData(imageData, 0, 0);
  }

  colorsMatch(c1, c2, tolerance) {
    return Math.abs(c1.r - c2.r) <= tolerance &&
           Math.abs(c1.g - c2.g) <= tolerance &&
           Math.abs(c1.b - c2.b) <= tolerance &&
           Math.abs(c1.a - c2.a) <= tolerance;
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
