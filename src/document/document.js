/**
 * Document class - represents the entire image document
 * Manages layers, canvas size, and document-level operations
 */

import { Layer, createRasterLayer, LayerType } from './layer.js';
import { getEventBus, Events } from '../core/event-bus.js';
import { getStore } from '../core/store.js';

let documentIdCounter = 0;

export class Document {
  constructor(options = {}) {
    this.id = options.id ?? `doc_${++documentIdCounter}`;
    this.name = options.name ?? 'Untitled';
    this.width = options.width ?? 1920;
    this.height = options.height ?? 1080;

    // Layers array (bottom to top order)
    this.layers = [];
    this.activeLayerId = null;

    // Background settings
    this.background = {
      color: options.backgroundColor ?? '#ffffff',
      transparent: options.transparentBackground ?? false
    };

    // Selection state
    this.selection = null;

    // Resolution and color
    this.dpi = options.dpi ?? 72;
    this.colorMode = options.colorMode ?? 'rgb';

    // File reference (for save)
    this.fileHandle = null;
    this.filePath = null;

    // Timestamps
    this.createdAt = Date.now();
    this.modifiedAt = Date.now();

    this.eventBus = getEventBus();
  }

  /**
   * Initialize with a background layer
   */
  init() {
    // Create background layer
    const bgLayer = createRasterLayer('Background', this.width, this.height);

    if (!this.background.transparent) {
      bgLayer.fill(this.background.color);
    }

    bgLayer.locked = true;
    this.addLayer(bgLayer);
    this.setActiveLayer(bgLayer.id);

    return this;
  }

  /**
   * Add a layer to the document
   */
  addLayer(layer, index = -1) {
    if (index === -1) {
      this.layers.push(layer);
    } else {
      this.layers.splice(index, 0, layer);
    }

    this.modifiedAt = Date.now();
    this.eventBus.emit(Events.LAYER_ADDED, { layer, index });
    this.syncToStore();
  }

  /**
   * Remove a layer from the document
   */
  removeLayer(layerId) {
    const index = this.layers.findIndex(l => l.id === layerId);
    if (index === -1) return null;

    const [layer] = this.layers.splice(index, 1);

    // If this was the active layer, select another
    if (this.activeLayerId === layerId) {
      const newActiveIndex = Math.min(index, this.layers.length - 1);
      if (newActiveIndex >= 0) {
        this.setActiveLayer(this.layers[newActiveIndex].id);
      } else {
        this.activeLayerId = null;
      }
    }

    this.modifiedAt = Date.now();
    this.eventBus.emit(Events.LAYER_REMOVED, { layer, index });
    this.syncToStore();

    return layer;
  }

  /**
   * Get a layer by ID
   */
  getLayer(layerId) {
    return this.layers.find(l => l.id === layerId);
  }

  /**
   * Get the active layer
   */
  getActiveLayer() {
    return this.getLayer(this.activeLayerId);
  }

  /**
   * Set the active layer
   */
  setActiveLayer(layerId) {
    if (this.activeLayerId === layerId) return;

    const layer = this.getLayer(layerId);
    if (!layer) return;

    this.activeLayerId = layerId;
    this.eventBus.emit(Events.LAYER_SELECTED, { layer });
    this.syncToStore();
  }

  /**
   * Move a layer to a new position
   */
  moveLayer(layerId, newIndex) {
    const oldIndex = this.layers.findIndex(l => l.id === layerId);
    if (oldIndex === -1) return;

    newIndex = Math.max(0, Math.min(newIndex, this.layers.length - 1));
    if (oldIndex === newIndex) return;

    const [layer] = this.layers.splice(oldIndex, 1);
    this.layers.splice(newIndex, 0, layer);

    this.modifiedAt = Date.now();
    this.eventBus.emit(Events.LAYER_REORDERED, { layer, oldIndex, newIndex });
    this.syncToStore();
  }

  /**
   * Duplicate a layer
   */
  duplicateLayer(layerId) {
    const layer = this.getLayer(layerId);
    if (!layer) return null;

    const index = this.layers.indexOf(layer);
    const cloned = layer.clone();

    this.addLayer(cloned, index + 1);
    this.setActiveLayer(cloned.id);

    return cloned;
  }

  /**
   * Merge a layer with the one below
   */
  mergeDown(layerId) {
    const index = this.layers.findIndex(l => l.id === layerId);
    if (index <= 0) return null;

    const upperLayer = this.layers[index];
    const lowerLayer = this.layers[index - 1];

    if (lowerLayer.type !== LayerType.RASTER) return null;

    // Draw upper layer onto lower layer
    lowerLayer.ctx.globalAlpha = upperLayer.opacity;
    lowerLayer.ctx.globalCompositeOperation = upperLayer.blendMode;
    lowerLayer.ctx.drawImage(upperLayer.canvas, upperLayer.x, upperLayer.y);
    lowerLayer.ctx.globalAlpha = 1;
    lowerLayer.ctx.globalCompositeOperation = 'source-over';

    lowerLayer.dirty = true;
    lowerLayer.updateThumbnail();

    this.removeLayer(layerId);
    this.setActiveLayer(lowerLayer.id);

    return lowerLayer;
  }

  /**
   * Flatten all layers
   */
  flatten() {
    if (this.layers.length <= 1) return;

    // Create new background layer
    const flattened = createRasterLayer('Background', this.width, this.height);

    // Fill with background color if not transparent
    if (!this.background.transparent) {
      flattened.fill(this.background.color);
    }

    // Composite all visible layers
    for (const layer of this.layers) {
      if (!layer.visible) continue;
      if (layer.type !== LayerType.RASTER) continue;

      flattened.ctx.globalAlpha = layer.opacity;
      flattened.ctx.globalCompositeOperation = layer.blendMode;
      flattened.ctx.drawImage(layer.canvas, layer.x, layer.y);
    }

    flattened.ctx.globalAlpha = 1;
    flattened.ctx.globalCompositeOperation = 'source-over';
    flattened.locked = true;

    // Replace all layers
    this.layers = [flattened];
    this.setActiveLayer(flattened.id);
    this.modifiedAt = Date.now();
    this.syncToStore();

    return flattened;
  }

  /**
   * Resize the canvas
   */
  resizeCanvas(newWidth, newHeight, anchor = 'center') {
    const oldWidth = this.width;
    const oldHeight = this.height;

    // Calculate offset based on anchor
    let offsetX = 0;
    let offsetY = 0;

    switch (anchor) {
      case 'top-left':
        break;
      case 'top':
        offsetX = (newWidth - oldWidth) / 2;
        break;
      case 'top-right':
        offsetX = newWidth - oldWidth;
        break;
      case 'left':
        offsetY = (newHeight - oldHeight) / 2;
        break;
      case 'center':
        offsetX = (newWidth - oldWidth) / 2;
        offsetY = (newHeight - oldHeight) / 2;
        break;
      case 'right':
        offsetX = newWidth - oldWidth;
        offsetY = (newHeight - oldHeight) / 2;
        break;
      case 'bottom-left':
        offsetY = newHeight - oldHeight;
        break;
      case 'bottom':
        offsetX = (newWidth - oldWidth) / 2;
        offsetY = newHeight - oldHeight;
        break;
      case 'bottom-right':
        offsetX = newWidth - oldWidth;
        offsetY = newHeight - oldHeight;
        break;
    }

    // Resize each layer
    for (const layer of this.layers) {
      if (!layer.canvas) continue;

      const oldCanvas = layer.canvas;
      layer.initCanvas(newWidth, newHeight);

      // Draw old content at offset
      layer.ctx.drawImage(oldCanvas, offsetX, offsetY);
      layer.x += offsetX;
      layer.y += offsetY;
    }

    this.width = newWidth;
    this.height = newHeight;
    this.modifiedAt = Date.now();
    this.syncToStore();
  }

  /**
   * Get flattened image as blob
   */
  async toBlob(format = 'image/png', quality = 0.92) {
    const canvas = new OffscreenCanvas(this.width, this.height);
    const ctx = canvas.getContext('2d');

    // Fill background if not transparent
    if (!this.background.transparent && format !== 'image/png') {
      ctx.fillStyle = this.background.color;
      ctx.fillRect(0, 0, this.width, this.height);
    }

    // Composite all visible layers
    for (const layer of this.layers) {
      if (!layer.visible || !layer.canvas) continue;

      ctx.globalAlpha = layer.opacity;
      ctx.globalCompositeOperation = layer.blendMode;
      ctx.drawImage(layer.canvas, layer.x, layer.y);
    }

    return await canvas.convertToBlob({ type: format, quality });
  }

  /**
   * Sync document state to the store
   */
  syncToStore() {
    const store = getStore();

    store.batch(() => {
      store.state.document.id = this.id;
      store.state.document.name = this.name;
      store.state.document.width = this.width;
      store.state.document.height = this.height;
      store.state.document.activeLayerId = this.activeLayerId;
      store.state.document.layers = this.layers.map(l => l.toJSON());
      store.state.document.background = { ...this.background };
    });
  }

  /**
   * Serialize document for storage
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      width: this.width,
      height: this.height,
      background: this.background,
      dpi: this.dpi,
      colorMode: this.colorMode,
      layers: this.layers.map(l => l.toJSON()),
      activeLayerId: this.activeLayerId,
      createdAt: this.createdAt,
      modifiedAt: this.modifiedAt
    };
  }
}

/**
 * Create a new empty document
 */
export function createDocument(options = {}) {
  const doc = new Document(options);
  doc.init();
  return doc;
}

/**
 * Create document from an image
 */
export async function createDocumentFromImage(image, name = 'Untitled') {
  const doc = new Document({
    name,
    width: image.width,
    height: image.height,
    transparentBackground: true
  });

  const layer = createRasterLayer('Layer 0', image.width, image.height);
  layer.drawImage(image);

  doc.addLayer(layer);
  doc.setActiveLayer(layer.id);

  return doc;
}
