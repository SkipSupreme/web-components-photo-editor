/**
 * Brush Tool - Pressure-sensitive painting tool
 */

import { BaseTool } from '../base-tool.js';
import { BrushEngine } from './brush-engine.js';
import { getBrushPresetManager, BrushTipShape } from './brush-presets.js';
import { getBrushTipManager } from './brush-tips.js';
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
    this.presetManager = null;
    this.tipManager = null;
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

    // Current brush settings (from preset + overrides)
    this.currentBrush = null;

    // Custom tip (if using one)
    this.customTip = null;
  }

  onActivate() {
    super.onActivate();
    this.store = getStore();
    this.eventBus = getEventBus();
    this.presetManager = getBrushPresetManager();
    this.tipManager = getBrushTipManager();

    // Load options from store
    this.options = { ...this.store.state.tools.options.brush };

    // Get active preset and apply dynamics to engine
    this.loadActivePreset();
  }

  loadActivePreset() {
    const preset = this.presetManager.getActivePreset();
    if (preset) {
      this.currentBrush = {
        tipShape: preset.tipShape,
        tipId: preset.tipImage, // Custom tip ID if set
        size: this.options.size ?? preset.size,
        hardness: this.options.hardness ?? preset.hardness,
        opacity: this.options.opacity ?? preset.opacity,
        flow: this.options.flow ?? preset.flow,
        spacing: preset.spacing,
        angle: preset.angle,
        roundness: preset.roundness,
        dynamics: { ...preset.dynamics },
        transfer: { ...preset.transfer }
      };

      // Load custom tip if specified
      if (preset.tipShape === BrushTipShape.CUSTOM && preset.tipImage) {
        this.customTip = this.tipManager.getTip(preset.tipImage);
      } else {
        this.customTip = null;
      }

      // Apply dynamics to engine
      this.engine.setDynamics(preset.dynamics);
      this.engine.setSpacing(preset.spacing / 100);
    } else {
      // Fallback to basic brush
      this.currentBrush = {
        tipShape: BrushTipShape.ROUND,
        tipId: null,
        size: this.options.size ?? 20,
        hardness: this.options.hardness ?? 100,
        opacity: this.options.opacity ?? 100,
        flow: this.options.flow ?? 100,
        spacing: 25,
        angle: 0,
        roundness: 100,
        dynamics: { sizePressure: true },
        transfer: {}
      };
      this.customTip = null;
    }
  }

  onPointerDown(event) {
    const app = window.photoEditorApp;
    if (!app || !app.document) return;

    const layer = app.document.getActiveLayer();
    if (!layer || !layer.ctx || layer.locked) return;

    this.isDrawing = true;
    this.strokePoints = [];
    this.strokeLayerId = layer.id;

    // Reload preset in case it changed
    this.options = { ...this.store.state.tools.options.brush };
    this.loadActivePreset();

    // Reset the engine for a new stroke
    this.engine.resetStroke();

    // Store before state for undo
    this.beforeImageData = layer.ctx.getImageData(0, 0, layer.width, layer.height);

    // Initialize stroke bounds
    const brushSize = this.currentBrush.size;
    this.strokeBounds = {
      x: Math.floor(event.x - brushSize),
      y: Math.floor(event.y - brushSize),
      width: Math.ceil(brushSize * 2),
      height: Math.ceil(brushSize * 2)
    };

    // Process first point
    const point = this.engine.processPoint(event);
    this.strokePoints.push(point);
    this.lastPoint = point;

    // Draw initial dab(s) with dynamics
    this.drawDabsWithDynamics(layer, point, null);

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
    const interpolatedPoints = this.engine.interpolate(
      this.lastPoint,
      point,
      this.currentBrush.size
    );

    for (const p of interpolatedPoints) {
      this.drawDabsWithDynamics(layer, p, this.lastPoint);
      this.expandBounds(p, this.currentBrush.size);
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

  /**
   * Draw multiple dabs with dynamics (scatter, jitter, etc.)
   */
  drawDabsWithDynamics(layer, point, lastPoint) {
    const brush = this.currentBrush;

    // Get all dabs to draw with dynamics applied
    const dabs = this.engine.processPointWithDynamics(
      point,
      lastPoint,
      brush.size,
      brush.opacity,
      brush.flow,
      brush.angle,
      brush.roundness
    );

    // Draw each dab
    for (const dab of dabs) {
      this.drawDab(layer, dab);
      this.expandBounds(dab, dab.size);
    }
  }

  drawDab(layer, dab) {
    const ctx = layer.ctx;
    const color = this.store.state.colors.foreground;
    const hardness = this.currentBrush.hardness / 100;
    const tipShape = this.currentBrush.tipShape;

    const size = dab.size;
    const opacity = dab.opacity / 100;
    const angle = dab.angle || 0;
    const roundness = (dab.roundness || 100) / 100;
    const radius = size / 2;

    // Use custom tip if available
    if (tipShape === BrushTipShape.CUSTOM && this.customTip) {
      this.customTip.draw(ctx, dab.x, dab.y, size, color, opacity, angle, roundness);
      return;
    }

    // Standard brush shapes
    ctx.save();
    ctx.translate(dab.x, dab.y);
    ctx.rotate(angle * Math.PI / 180);

    if (hardness >= 0.99) {
      // Hard brush
      ctx.globalAlpha = opacity;
      ctx.fillStyle = color;
      ctx.beginPath();

      if (tipShape === BrushTipShape.ROUND) {
        ctx.ellipse(0, 0, radius, radius * roundness, 0, 0, Math.PI * 2);
      } else if (tipShape === BrushTipShape.SQUARE) {
        ctx.rect(-radius, -radius * roundness, size, size * roundness);
      } else if (tipShape === BrushTipShape.DIAMOND) {
        ctx.moveTo(0, -radius * roundness);
        ctx.lineTo(radius, 0);
        ctx.lineTo(0, radius * roundness);
        ctx.lineTo(-radius, 0);
        ctx.closePath();
      } else {
        // Default to round
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
      }
      ctx.fill();
    } else {
      // Soft brush with radial gradient
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);

      // Parse color to RGB
      const rgb = this.hexToRgb(color);
      const innerColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
      const midColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity * hardness})`;
      const outerColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`;

      gradient.addColorStop(0, innerColor);
      gradient.addColorStop(hardness, midColor);
      gradient.addColorStop(1, outerColor);

      ctx.fillStyle = gradient;

      if (roundness < 1) {
        // Apply roundness by scaling
        ctx.scale(1, roundness);
        ctx.fillRect(-radius, -radius, size, size);
      } else {
        ctx.fillRect(-radius, -radius, size, size);
      }
    }

    ctx.restore();
  }

  expandBounds(point, brushSize) {
    const padding = brushSize || this.currentBrush.size;
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
