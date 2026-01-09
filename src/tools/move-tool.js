/**
 * Move Tool - Move layers around the canvas
 */

import { BaseTool } from './base-tool.js';
import { getStore } from '../core/store.js';
import { getEventBus, Events } from '../core/event-bus.js';
import { Command, getHistory } from '../core/commands.js';

class MoveLayerCommand extends Command {
  constructor(layerId, fromX, fromY, toX, toY) {
    super('Move Layer');
    this.layerId = layerId;
    this.fromX = fromX;
    this.fromY = fromY;
    this.toX = toX;
    this.toY = toY;
  }

  execute() {
    const app = window.photoEditorApp;
    if (!app || !app.document) return false;

    const layer = app.document.getLayer(this.layerId);
    if (!layer) return false;

    layer.x = this.toX;
    layer.y = this.toY;
    layer.dirty = true;

    getEventBus().emit(Events.LAYER_UPDATED, { layer });
    getEventBus().emit(Events.RENDER_REQUEST);
    return true;
  }

  undo() {
    const app = window.photoEditorApp;
    if (!app || !app.document) return false;

    const layer = app.document.getLayer(this.layerId);
    if (!layer) return false;

    layer.x = this.fromX;
    layer.y = this.fromY;
    layer.dirty = true;

    getEventBus().emit(Events.LAYER_UPDATED, { layer });
    getEventBus().emit(Events.RENDER_REQUEST);
    return true;
  }
}

export class MoveTool extends BaseTool {
  constructor() {
    super('move');

    this.store = null;
    this.eventBus = null;

    this.isMoving = false;
    this.startX = 0;
    this.startY = 0;
    this.layerStartX = 0;
    this.layerStartY = 0;
    this.movingLayerId = null;
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
    if (!layer || layer.locked) return;

    this.isMoving = true;
    this.startX = event.x;
    this.startY = event.y;
    this.layerStartX = layer.x;
    this.layerStartY = layer.y;
    this.movingLayerId = layer.id;
  }

  onPointerMove(event) {
    if (!this.isMoving) return;

    const app = window.photoEditorApp;
    if (!app || !app.document) return;

    const layer = app.document.getLayer(this.movingLayerId);
    if (!layer) return;

    const dx = event.x - this.startX;
    const dy = event.y - this.startY;

    layer.x = this.layerStartX + dx;
    layer.y = this.layerStartY + dy;
    layer.dirty = true;

    this.eventBus.emit(Events.RENDER_REQUEST);
  }

  onPointerUp(event) {
    if (!this.isMoving) return;

    this.isMoving = false;

    const app = window.photoEditorApp;
    if (!app || !app.document) return;

    const layer = app.document.getLayer(this.movingLayerId);
    if (!layer) return;

    // Only create command if layer actually moved
    if (layer.x !== this.layerStartX || layer.y !== this.layerStartY) {
      const command = new MoveLayerCommand(
        this.movingLayerId,
        this.layerStartX,
        this.layerStartY,
        layer.x,
        layer.y
      );

      const history = getHistory();
      history.undoStack.push(command);
      history.redoStack = [];

      this.eventBus.emit(Events.HISTORY_PUSH, { command });
      this.eventBus.emit(Events.DOCUMENT_MODIFIED);
    }

    this.movingLayerId = null;
  }

  getCursor() {
    return 'move';
  }
}
