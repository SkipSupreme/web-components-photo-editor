/**
 * Layer class - represents a single layer in the document
 * Supports raster layers, adjustment layers, and groups
 */

let layerIdCounter = 0;

export const LayerType = {
  RASTER: 'raster',
  ADJUSTMENT: 'adjustment',
  GROUP: 'group',
  TEXT: 'text'
};

export const BlendMode = {
  NORMAL: 'normal',
  MULTIPLY: 'multiply',
  SCREEN: 'screen',
  OVERLAY: 'overlay',
  DARKEN: 'darken',
  LIGHTEN: 'lighten',
  COLOR_DODGE: 'color-dodge',
  COLOR_BURN: 'color-burn',
  HARD_LIGHT: 'hard-light',
  SOFT_LIGHT: 'soft-light',
  DIFFERENCE: 'difference',
  EXCLUSION: 'exclusion',
  HUE: 'hue',
  SATURATION: 'saturation',
  COLOR: 'color',
  LUMINOSITY: 'luminosity'
};

export class Layer {
  constructor(options = {}) {
    this.id = options.id ?? `layer_${++layerIdCounter}`;
    this.name = options.name ?? 'Layer';
    this.type = options.type ?? LayerType.RASTER;

    // Visibility and rendering
    this.visible = options.visible ?? true;
    this.opacity = options.opacity ?? 1.0; // 0-1
    this.blendMode = options.blendMode ?? BlendMode.NORMAL;
    this.locked = options.locked ?? false;

    // Position and transform
    this.x = options.x ?? 0;
    this.y = options.y ?? 0;
    this.width = options.width ?? 0;
    this.height = options.height ?? 0;

    // Canvas for raster data (null until initialized)
    this.canvas = null;
    this.ctx = null;

    // Mask (optional)
    this.mask = null;
    this.maskEnabled = true;
    this.maskLinked = true;

    // Clipping
    this.clipped = options.clipped ?? false; // Clipped to layer below

    // Group support
    this.parentId = options.parentId ?? null;
    this.children = []; // For groups

    // For adjustment layers
    this.adjustment = options.adjustment ?? null;

    // Dirty flag for rendering optimization
    this.dirty = true;

    // Thumbnail canvas for layers panel
    this.thumbnail = null;
  }

  /**
   * Initialize the layer canvas
   */
  initCanvas(width, height) {
    this.width = width;
    this.height = height;

    this.canvas = new OffscreenCanvas(width, height);
    this.ctx = this.canvas.getContext('2d', {
      willReadFrequently: true
    });

    // Clear to transparent
    this.ctx.clearRect(0, 0, width, height);

    this.dirty = true;
    this.updateThumbnail();
  }

  /**
   * Fill the layer with a color
   */
  fill(color) {
    if (!this.ctx) return;

    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.width, this.height);
    this.dirty = true;
    this.updateThumbnail();
  }

  /**
   * Clear the layer
   */
  clear() {
    if (!this.ctx) return;

    this.ctx.clearRect(0, 0, this.width, this.height);
    this.dirty = true;
    this.updateThumbnail();
  }

  /**
   * Draw an image onto the layer
   */
  drawImage(image, x = 0, y = 0, width, height) {
    if (!this.ctx) return;

    width = width ?? image.width;
    height = height ?? image.height;

    this.ctx.drawImage(image, x, y, width, height);
    this.dirty = true;
    this.updateThumbnail();
  }

  /**
   * Get ImageData from the layer
   */
  getImageData(x = 0, y = 0, width, height) {
    if (!this.ctx) return null;

    width = width ?? this.width;
    height = height ?? this.height;

    return this.ctx.getImageData(x, y, width, height);
  }

  /**
   * Put ImageData onto the layer
   */
  putImageData(imageData, x = 0, y = 0) {
    if (!this.ctx) return;

    this.ctx.putImageData(imageData, x, y);
    this.dirty = true;
    this.updateThumbnail();
  }

  /**
   * Get the layer as an ImageBitmap for WebGL
   */
  async toBitmap() {
    if (!this.canvas) return null;
    return await createImageBitmap(this.canvas);
  }

  /**
   * Create a mask for this layer
   */
  createMask(fillWhite = true) {
    this.mask = new OffscreenCanvas(this.width, this.height);
    const ctx = this.mask.getContext('2d');

    if (fillWhite) {
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, this.width, this.height);
    }

    this.maskEnabled = true;
    this.dirty = true;
  }

  /**
   * Remove the mask
   */
  removeMask() {
    this.mask = null;
    this.dirty = true;
  }

  /**
   * Apply mask (destructive - merges mask into layer alpha)
   */
  applyMask() {
    if (!this.mask || !this.ctx) return;

    const maskCtx = this.mask.getContext('2d');
    const maskData = maskCtx.getImageData(0, 0, this.width, this.height);
    const layerData = this.ctx.getImageData(0, 0, this.width, this.height);

    for (let i = 0; i < layerData.data.length; i += 4) {
      // Use mask luminance to affect alpha
      const maskAlpha = maskData.data[i]; // Red channel as grayscale
      layerData.data[i + 3] = Math.round(layerData.data[i + 3] * (maskAlpha / 255));
    }

    this.ctx.putImageData(layerData, 0, 0);
    this.mask = null;
    this.dirty = true;
    this.updateThumbnail();
  }

  /**
   * Update thumbnail for layers panel
   */
  updateThumbnail() {
    if (!this.canvas) return;

    const thumbSize = 40;
    const scale = Math.min(thumbSize / this.width, thumbSize / this.height);
    const thumbWidth = Math.round(this.width * scale);
    const thumbHeight = Math.round(this.height * scale);

    if (!this.thumbnail) {
      this.thumbnail = new OffscreenCanvas(thumbSize, thumbSize);
    }

    const ctx = this.thumbnail.getContext('2d');
    ctx.clearRect(0, 0, thumbSize, thumbSize);

    // Draw checkerboard background for transparency
    const checkSize = 5;
    for (let y = 0; y < thumbSize; y += checkSize) {
      for (let x = 0; x < thumbSize; x += checkSize) {
        ctx.fillStyle = ((x + y) / checkSize) % 2 === 0 ? '#ffffff' : '#cccccc';
        ctx.fillRect(x, y, checkSize, checkSize);
      }
    }

    // Draw scaled layer content centered
    const offsetX = (thumbSize - thumbWidth) / 2;
    const offsetY = (thumbSize - thumbHeight) / 2;
    ctx.drawImage(this.canvas, offsetX, offsetY, thumbWidth, thumbHeight);
  }

  /**
   * Clone this layer
   */
  clone() {
    const cloned = new Layer({
      name: `${this.name} Copy`,
      type: this.type,
      visible: this.visible,
      opacity: this.opacity,
      blendMode: this.blendMode,
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      clipped: this.clipped,
      adjustment: this.adjustment ? { ...this.adjustment } : null
    });

    if (this.canvas) {
      cloned.initCanvas(this.width, this.height);
      cloned.ctx.drawImage(this.canvas, 0, 0);
    }

    if (this.mask) {
      cloned.createMask(false);
      const maskCtx = cloned.mask.getContext('2d');
      maskCtx.drawImage(this.mask, 0, 0);
    }

    return cloned;
  }

  /**
   * Serialize layer for storage (without canvas data)
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      visible: this.visible,
      opacity: this.opacity,
      blendMode: this.blendMode,
      locked: this.locked,
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      clipped: this.clipped,
      parentId: this.parentId,
      maskEnabled: this.maskEnabled,
      maskLinked: this.maskLinked,
      adjustment: this.adjustment
    };
  }

  /**
   * Create layer from JSON
   */
  static fromJSON(json) {
    return new Layer(json);
  }
}

/**
 * Create a new raster layer
 */
export function createRasterLayer(name, width, height) {
  const layer = new Layer({
    name,
    type: LayerType.RASTER
  });
  layer.initCanvas(width, height);
  return layer;
}

/**
 * Create a layer from an image
 */
export async function createLayerFromImage(image, name = 'Image Layer') {
  const layer = new Layer({
    name,
    type: LayerType.RASTER
  });

  layer.initCanvas(image.width, image.height);
  layer.drawImage(image);

  return layer;
}

/**
 * Create an adjustment layer
 */
export function createAdjustmentLayer(type, params = {}) {
  return new Layer({
    name: `${type} Adjustment`,
    type: LayerType.ADJUSTMENT,
    adjustment: {
      type,
      params
    }
  });
}

/**
 * Create a layer group (folder)
 */
export function createLayerGroup(name = 'Group') {
  const group = new Layer({
    name,
    type: LayerType.GROUP
  });
  group.children = [];
  group.expanded = true;
  return group;
}

/**
 * LayerGroup - Container for layers with additional group functionality
 */
export class LayerGroup extends Layer {
  constructor(options = {}) {
    super({
      ...options,
      type: LayerType.GROUP
    });
    this.children = options.children ?? [];
    this.expanded = options.expanded ?? true;
    this.passThrough = options.passThrough ?? true; // Pass-through blend mode
  }

  /**
   * Add a layer to this group
   */
  addChild(layer, index = -1) {
    layer.parentId = this.id;
    if (index === -1) {
      this.children.push(layer);
    } else {
      this.children.splice(index, 0, layer);
    }
  }

  /**
   * Remove a layer from this group
   */
  removeChild(layerId) {
    const index = this.children.findIndex(l => l.id === layerId);
    if (index !== -1) {
      const [layer] = this.children.splice(index, 1);
      layer.parentId = null;
      return layer;
    }
    return null;
  }

  /**
   * Get all layers in this group (flattened)
   */
  getAllLayers() {
    const layers = [];
    for (const child of this.children) {
      layers.push(child);
      if (child instanceof LayerGroup) {
        layers.push(...child.getAllLayers());
      }
    }
    return layers;
  }

  /**
   * Toggle group expansion
   */
  toggleExpanded() {
    this.expanded = !this.expanded;
  }

  /**
   * Clone this group and all children
   */
  clone() {
    const cloned = new LayerGroup({
      name: `${this.name} Copy`,
      visible: this.visible,
      opacity: this.opacity,
      blendMode: this.blendMode,
      expanded: this.expanded,
      passThrough: this.passThrough
    });

    for (const child of this.children) {
      const clonedChild = child.clone();
      cloned.addChild(clonedChild);
    }

    return cloned;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      expanded: this.expanded,
      passThrough: this.passThrough,
      children: this.children.map(c => c.toJSON())
    };
  }
}

