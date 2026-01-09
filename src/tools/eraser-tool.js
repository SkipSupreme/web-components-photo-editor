/**
 * Eraser Tool - Removes pixels from layers
 */

import { BaseTool } from './base-tool.js';
import { BrushEngine } from './brush/brush-engine.js';
import { getStore } from '../core/store.js';
import { getEventBus, Events } from '../core/event-bus.js';
import { Command, getHistory } from '../core/commands.js';

class EraserStrokeCommand extends Command {
  constructor(layerId, beforeImageData, afterImageData) {
    super('Eraser');
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

export class EraserTool extends BaseTool {
  constructor() {
    super('eraser');

    this.engine = new BrushEngine();
    this.store = null;
    this.eventBus = null;

    this.isErasing = false;
    this.lastPoint = null;
    this.strokeLayerId = null;
    this.beforeImageData = null;
  }

  onActivate() {
    super.onActivate();
    this.store = getStore();
    this.eventBus = getEventBus();
    this.options = { ...this.store.state.tools.options.eraser };
  }

  onPointerDown(event) {
    const app = window.photoEditorApp;
    if (!app || !app.document) return;

    const layer = app.document.getActiveLayer();
    if (!layer || !layer.ctx || layer.locked) return;

    this.isErasing = true;
    this.strokeLayerId = layer.id;

    // Store before state
    this.beforeImageData = layer.ctx.getImageData(0, 0, layer.width, layer.height);

    const point = this.engine.processPoint(event);
    this.lastPoint = point;

    this.eraseAt(layer, point);

    layer.dirty = true;
    this.eventBus.emit(Events.RENDER_REQUEST);
  }

  onPointerMove(event) {
    if (!this.isErasing) return;

    const app = window.photoEditorApp;
    if (!app || !app.document) return;

    const layer = app.document.getLayer(this.strokeLayerId);
    if (!layer || !layer.ctx) return;

    const point = this.engine.processPoint(event);
    const interpolatedPoints = this.engine.interpolate(this.lastPoint, point);

    for (const p of interpolatedPoints) {
      this.eraseAt(layer, p);
    }

    this.lastPoint = point;
    layer.dirty = true;
    this.eventBus.emit(Events.RENDER_REQUEST);
  }

  onPointerUp(event) {
    if (!this.isErasing) return;

    this.isErasing = false;

    const app = window.photoEditorApp;
    if (!app || !app.document) return;

    const layer = app.document.getLayer(this.strokeLayerId);
    if (!layer || !layer.ctx) return;

    // Get after state
    const afterImageData = layer.ctx.getImageData(0, 0, layer.width, layer.height);

    // Add to history
    const command = new EraserStrokeCommand(
      this.strokeLayerId,
      this.beforeImageData,
      afterImageData
    );

    const history = getHistory();
    history.undoStack.push(command);
    history.redoStack = [];

    this.eventBus.emit(Events.HISTORY_PUSH, { command });
    this.eventBus.emit(Events.DOCUMENT_MODIFIED);

    layer.updateThumbnail();
    this.eventBus.emit(Events.LAYER_UPDATED, { layer });

    this.lastPoint = null;
    this.beforeImageData = null;
  }

  eraseAt(layer, point) {
    const ctx = layer.ctx;
    const size = this.options.size * point.pressure;
    const opacity = this.options.opacity / 100;
    const hardness = this.options.hardness / 100;
    const radius = size / 2;

    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';

    if (hardness >= 0.99) {
      ctx.globalAlpha = opacity;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const gradient = ctx.createRadialGradient(
        point.x, point.y, 0,
        point.x, point.y, radius
      );

      gradient.addColorStop(0, `rgba(0, 0, 0, ${opacity})`);
      gradient.addColorStop(hardness, `rgba(0, 0, 0, ${opacity * hardness})`);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = gradient;
      ctx.fillRect(point.x - radius, point.y - radius, size, size);
    }

    ctx.restore();
  }

  getCursor() {
    return 'crosshair';
  }
}
