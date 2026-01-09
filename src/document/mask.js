/**
 * Layer Mask System
 * Non-destructive masks that control layer visibility
 */

import { getEventBus, Events } from '../core/event-bus.js';
import { Command, getHistory } from '../core/commands.js';

/**
 * Mask class - represents a grayscale mask for a layer
 * White = visible, Black = hidden, Gray = partial visibility
 */
export class LayerMask {
  constructor(width, height, options = {}) {
    this.width = width;
    this.height = height;

    // Create mask canvas
    this.canvas = new OffscreenCanvas(width, height);
    this.ctx = this.canvas.getContext('2d', {
      willReadFrequently: true
    });

    // Initialize mask (default: white = fully visible)
    if (options.fillBlack) {
      this.ctx.fillStyle = 'black';
      this.ctx.fillRect(0, 0, width, height);
    } else {
      this.ctx.fillStyle = 'white';
      this.ctx.fillRect(0, 0, width, height);
    }

    // Mask properties
    this.enabled = true;
    this.linked = options.linked ?? true; // Linked to layer position
    this.density = options.density ?? 100; // 0-100, affects mask strength
    this.feather = options.feather ?? 0; // Blur amount for soft edges

    // Position offset (for unlinked masks)
    this.offsetX = 0;
    this.offsetY = 0;

    // Thumbnail for UI
    this.thumbnail = null;

    // Generate initial thumbnail
    this.updateThumbnail();
  }

  /**
   * Fill the entire mask with a value
   */
  fill(value) {
    this.ctx.fillStyle = typeof value === 'number'
      ? `rgb(${value}, ${value}, ${value})`
      : value;
    this.ctx.fillRect(0, 0, this.width, this.height);
    this.updateThumbnail();
  }

  /**
   * Invert the mask
   */
  invert() {
    const imageData = this.ctx.getImageData(0, 0, this.width, this.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255 - data[i];
      data[i + 1] = 255 - data[i + 1];
      data[i + 2] = 255 - data[i + 2];
    }

    this.ctx.putImageData(imageData, 0, 0);
    this.updateThumbnail();
  }

  /**
   * Get mask value at a point (0-255)
   */
  getValueAt(x, y) {
    const imageData = this.ctx.getImageData(x, y, 1, 1);
    return imageData.data[0]; // Red channel (grayscale)
  }

  /**
   * Set mask value at a point
   */
  setValueAt(x, y, value) {
    this.ctx.fillStyle = `rgb(${value}, ${value}, ${value})`;
    this.ctx.fillRect(x, y, 1, 1);
  }

  /**
   * Get the mask as ImageData
   */
  getImageData() {
    return this.ctx.getImageData(0, 0, this.width, this.height);
  }

  /**
   * Set mask from ImageData
   */
  putImageData(imageData, x = 0, y = 0) {
    this.ctx.putImageData(imageData, x, y);
    this.updateThumbnail();
  }

  /**
   * Apply the mask to layer image data
   * Returns new ImageData with alpha modified by mask
   */
  apply(layerImageData) {
    const maskData = this.ctx.getImageData(0, 0, this.width, this.height);
    const resultData = new ImageData(
      new Uint8ClampedArray(layerImageData.data),
      layerImageData.width,
      layerImageData.height
    );

    const density = this.density / 100;

    for (let i = 0; i < resultData.data.length; i += 4) {
      // Get mask value (grayscale, use red channel)
      const maskValue = maskData.data[i] / 255;

      // Apply density
      const effectiveMask = 1 - (1 - maskValue) * density;

      // Multiply layer alpha by mask
      resultData.data[i + 3] = Math.round(resultData.data[i + 3] * effectiveMask);
    }

    return resultData;
  }

  /**
   * Create mask from selection
   */
  static fromSelection(selection, fillWhite = true) {
    const mask = new LayerMask(selection.width, selection.height, {
      fillBlack: !fillWhite
    });

    // Copy selection mask to layer mask
    if (selection.mask) {
      const selMaskCtx = selection.mask.getContext('2d');
      const selData = selMaskCtx.getImageData(0, 0, selection.width, selection.height);

      // Convert selection mask (where white=selected) to layer mask
      if (!fillWhite) {
        // Selection becomes visible area
        mask.ctx.drawImage(selection.mask, 0, 0);
      } else {
        // Selection becomes hidden area (invert)
        const maskData = mask.ctx.getImageData(0, 0, mask.width, mask.height);
        for (let i = 0; i < maskData.data.length; i += 4) {
          const selValue = selData.data[i];
          maskData.data[i] = 255 - selValue;
          maskData.data[i + 1] = 255 - selValue;
          maskData.data[i + 2] = 255 - selValue;
          maskData.data[i + 3] = 255;
        }
        mask.ctx.putImageData(maskData, 0, 0);
      }
    }

    mask.updateThumbnail();
    return mask;
  }

  /**
   * Update thumbnail for layers panel
   */
  updateThumbnail() {
    const thumbSize = 32;
    const scale = Math.min(thumbSize / this.width, thumbSize / this.height);
    const thumbWidth = Math.round(this.width * scale);
    const thumbHeight = Math.round(this.height * scale);

    if (!this.thumbnail) {
      this.thumbnail = new OffscreenCanvas(thumbSize, thumbSize);
    }

    const ctx = this.thumbnail.getContext('2d');

    // Clear with checkerboard
    const checkSize = 4;
    for (let y = 0; y < thumbSize; y += checkSize) {
      for (let x = 0; x < thumbSize; x += checkSize) {
        ctx.fillStyle = ((x + y) / checkSize) % 2 === 0 ? '#666' : '#444';
        ctx.fillRect(x, y, checkSize, checkSize);
      }
    }

    // Draw scaled mask centered
    const offsetX = (thumbSize - thumbWidth) / 2;
    const offsetY = (thumbSize - thumbHeight) / 2;
    ctx.drawImage(this.canvas, offsetX, offsetY, thumbWidth, thumbHeight);
  }

  /**
   * Clone this mask
   */
  clone() {
    const cloned = new LayerMask(this.width, this.height);
    cloned.ctx.drawImage(this.canvas, 0, 0);
    cloned.enabled = this.enabled;
    cloned.linked = this.linked;
    cloned.density = this.density;
    cloned.feather = this.feather;
    cloned.offsetX = this.offsetX;
    cloned.offsetY = this.offsetY;
    cloned.updateThumbnail();
    return cloned;
  }

  /**
   * Serialize for storage
   */
  toJSON() {
    return {
      width: this.width,
      height: this.height,
      enabled: this.enabled,
      linked: this.linked,
      density: this.density,
      feather: this.feather,
      offsetX: this.offsetX,
      offsetY: this.offsetY
      // Note: canvas data would need to be exported separately
    };
  }
}

/**
 * Command for mask paint operations
 */
export class MaskPaintCommand extends Command {
  constructor(layerId, beforeImageData, afterImageData) {
    super('Paint Mask');
    this.layerId = layerId;
    this.beforeImageData = beforeImageData;
    this.afterImageData = afterImageData;
  }

  execute() {
    const app = window.photoEditorApp;
    if (!app || !app.document) return false;

    const layer = app.document.getLayer(this.layerId);
    if (!layer || !layer.mask) return false;

    layer.mask.putImageData(this.afterImageData);
    layer.dirty = true;

    getEventBus().emit(Events.LAYER_UPDATED, { layer });
    getEventBus().emit(Events.RENDER_REQUEST);
    return true;
  }

  undo() {
    const app = window.photoEditorApp;
    if (!app || !app.document) return false;

    const layer = app.document.getLayer(this.layerId);
    if (!layer || !layer.mask) return false;

    layer.mask.putImageData(this.beforeImageData);
    layer.dirty = true;

    getEventBus().emit(Events.LAYER_UPDATED, { layer });
    getEventBus().emit(Events.RENDER_REQUEST);
    return true;
  }
}

/**
 * Command for adding a mask
 */
export class AddMaskCommand extends Command {
  constructor(layerId, fillWhite = true) {
    super('Add Layer Mask');
    this.layerId = layerId;
    this.fillWhite = fillWhite;
    this.maskData = null; // Store mask data for redo
  }

  execute() {
    const app = window.photoEditorApp;
    if (!app || !app.document) return false;

    const layer = app.document.getLayer(this.layerId);
    if (!layer) return false;

    // Create mask
    layer.mask = new LayerMask(layer.width, layer.height, {
      fillBlack: !this.fillWhite
    });
    layer.maskEnabled = true;
    layer.dirty = true;

    // Store for redo
    this.maskData = layer.mask.getImageData();

    getEventBus().emit(Events.LAYER_UPDATED, { layer });
    getEventBus().emit(Events.RENDER_REQUEST);
    return true;
  }

  undo() {
    const app = window.photoEditorApp;
    if (!app || !app.document) return false;

    const layer = app.document.getLayer(this.layerId);
    if (!layer) return false;

    layer.mask = null;
    layer.maskEnabled = false;
    layer.dirty = true;

    getEventBus().emit(Events.LAYER_UPDATED, { layer });
    getEventBus().emit(Events.RENDER_REQUEST);
    return true;
  }
}

/**
 * Command for deleting a mask
 */
export class DeleteMaskCommand extends Command {
  constructor(layerId) {
    super('Delete Layer Mask');
    this.layerId = layerId;
    this.maskData = null;
    this.maskProps = null;
  }

  execute() {
    const app = window.photoEditorApp;
    if (!app || !app.document) return false;

    const layer = app.document.getLayer(this.layerId);
    if (!layer || !layer.mask) return false;

    // Store mask data for undo
    this.maskData = layer.mask.getImageData();
    this.maskProps = {
      enabled: layer.mask.enabled,
      linked: layer.mask.linked,
      density: layer.mask.density,
      feather: layer.mask.feather
    };

    layer.mask = null;
    layer.maskEnabled = false;
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

    layer.mask = new LayerMask(layer.width, layer.height, this.maskProps);
    layer.mask.putImageData(this.maskData);
    layer.maskEnabled = this.maskProps.enabled;
    layer.dirty = true;

    getEventBus().emit(Events.LAYER_UPDATED, { layer });
    getEventBus().emit(Events.RENDER_REQUEST);
    return true;
  }
}

/**
 * Command for applying (merging) a mask
 */
export class ApplyMaskCommand extends Command {
  constructor(layerId) {
    super('Apply Layer Mask');
    this.layerId = layerId;
    this.beforeLayerData = null;
    this.maskData = null;
    this.maskProps = null;
  }

  execute() {
    const app = window.photoEditorApp;
    if (!app || !app.document) return false;

    const layer = app.document.getLayer(this.layerId);
    if (!layer || !layer.mask || !layer.ctx) return false;

    // Store for undo
    this.beforeLayerData = layer.ctx.getImageData(0, 0, layer.width, layer.height);
    this.maskData = layer.mask.getImageData();
    this.maskProps = {
      enabled: layer.mask.enabled,
      linked: layer.mask.linked,
      density: layer.mask.density,
      feather: layer.mask.feather
    };

    // Apply mask to layer
    const maskedData = layer.mask.apply(this.beforeLayerData);
    layer.ctx.putImageData(maskedData, 0, 0);

    // Remove mask
    layer.mask = null;
    layer.maskEnabled = false;
    layer.dirty = true;
    layer.updateThumbnail();

    getEventBus().emit(Events.LAYER_UPDATED, { layer });
    getEventBus().emit(Events.RENDER_REQUEST);
    return true;
  }

  undo() {
    const app = window.photoEditorApp;
    if (!app || !app.document) return false;

    const layer = app.document.getLayer(this.layerId);
    if (!layer || !layer.ctx) return false;

    // Restore layer data
    layer.ctx.putImageData(this.beforeLayerData, 0, 0);

    // Restore mask
    layer.mask = new LayerMask(layer.width, layer.height, this.maskProps);
    layer.mask.putImageData(this.maskData);
    layer.maskEnabled = this.maskProps.enabled;
    layer.dirty = true;
    layer.updateThumbnail();

    getEventBus().emit(Events.LAYER_UPDATED, { layer });
    getEventBus().emit(Events.RENDER_REQUEST);
    return true;
  }
}

/**
 * Command for inverting a mask
 */
export class InvertMaskCommand extends Command {
  constructor(layerId) {
    super('Invert Layer Mask');
    this.layerId = layerId;
  }

  execute() {
    const app = window.photoEditorApp;
    if (!app || !app.document) return false;

    const layer = app.document.getLayer(this.layerId);
    if (!layer || !layer.mask) return false;

    layer.mask.invert();
    layer.dirty = true;

    getEventBus().emit(Events.LAYER_UPDATED, { layer });
    getEventBus().emit(Events.RENDER_REQUEST);
    return true;
  }

  undo() {
    // Inverting twice restores original
    return this.execute();
  }
}

/**
 * Mask manager for handling mask editing state
 */
class MaskManager {
  constructor() {
    this.isEditingMask = false;
    this.activeLayerId = null;
    this.eventBus = null;
  }

  init() {
    this.eventBus = getEventBus();
  }

  /**
   * Enter mask editing mode
   */
  enterMaskEditMode(layerId) {
    this.isEditingMask = true;
    this.activeLayerId = layerId;
    this.eventBus?.emit('mask:edit-start', { layerId });
  }

  /**
   * Exit mask editing mode
   */
  exitMaskEditMode() {
    this.isEditingMask = false;
    this.activeLayerId = null;
    this.eventBus?.emit('mask:edit-end', {});
  }

  /**
   * Check if currently editing a mask
   */
  isEditing() {
    return this.isEditingMask;
  }

  /**
   * Get the layer being edited
   */
  getEditingLayerId() {
    return this.activeLayerId;
  }

  /**
   * Add mask to layer
   */
  addMask(layerId, fillWhite = true) {
    const command = new AddMaskCommand(layerId, fillWhite);
    getHistory().execute(command);
  }

  /**
   * Delete mask from layer
   */
  deleteMask(layerId) {
    const command = new DeleteMaskCommand(layerId);
    getHistory().execute(command);
  }

  /**
   * Apply (merge) mask to layer
   */
  applyMask(layerId) {
    const command = new ApplyMaskCommand(layerId);
    getHistory().execute(command);
  }

  /**
   * Invert mask
   */
  invertMask(layerId) {
    const command = new InvertMaskCommand(layerId);
    getHistory().execute(command);
  }

  /**
   * Toggle mask enabled state
   */
  toggleMaskEnabled(layerId) {
    const app = window.photoEditorApp;
    if (!app || !app.document) return;

    const layer = app.document.getLayer(layerId);
    if (!layer || !layer.mask) return;

    layer.mask.enabled = !layer.mask.enabled;
    layer.maskEnabled = layer.mask.enabled;
    layer.dirty = true;

    this.eventBus?.emit(Events.LAYER_UPDATED, { layer });
    this.eventBus?.emit(Events.RENDER_REQUEST);
  }

  /**
   * Toggle mask link state
   */
  toggleMaskLinked(layerId) {
    const app = window.photoEditorApp;
    if (!app || !app.document) return;

    const layer = app.document.getLayer(layerId);
    if (!layer || !layer.mask) return;

    layer.mask.linked = !layer.mask.linked;
    layer.maskLinked = layer.mask.linked;

    this.eventBus?.emit(Events.LAYER_UPDATED, { layer });
  }
}

// Singleton instance
let maskManager = null;

export function getMaskManager() {
  if (!maskManager) {
    maskManager = new MaskManager();
    maskManager.init();
  }
  return maskManager;
}
