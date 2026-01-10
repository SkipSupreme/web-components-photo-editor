/**
 * Custom Brush Tips - Load and manage custom brush tip images
 */

import { getEventBus, Events } from '../../core/event-bus.js';

/**
 * Custom brush tip class
 */
export class BrushTip {
  constructor(options = {}) {
    this.id = options.id ?? `tip_${Date.now()}`;
    this.name = options.name ?? 'Custom Tip';
    this.category = options.category ?? 'Custom';

    // Original image data
    this.originalCanvas = null;
    this.width = options.width ?? 0;
    this.height = options.height ?? 0;

    // Cached scaled versions for performance
    this.cache = new Map();
    this.maxCacheSize = 10;

    // Processing options
    this.useGrayscale = options.useGrayscale ?? true;
    this.invertAlpha = options.invertAlpha ?? false;
  }

  /**
   * Load brush tip from image
   */
  async loadFromImage(image) {
    this.width = image.width;
    this.height = image.height;

    // Create original canvas
    this.originalCanvas = new OffscreenCanvas(this.width, this.height);
    const ctx = this.originalCanvas.getContext('2d');

    ctx.drawImage(image, 0, 0);

    // Process the image for use as brush tip
    await this.processImage();

    return this;
  }

  /**
   * Load brush tip from ImageData
   */
  loadFromImageData(imageData) {
    this.width = imageData.width;
    this.height = imageData.height;

    this.originalCanvas = new OffscreenCanvas(this.width, this.height);
    const ctx = this.originalCanvas.getContext('2d');
    ctx.putImageData(imageData, 0, 0);

    this.processImage();
    return this;
  }

  /**
   * Process the image for use as a brush tip
   * Converts to grayscale and uses luminance as alpha
   */
  processImage() {
    if (!this.originalCanvas) return;

    const ctx = this.originalCanvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, this.width, this.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      // Calculate luminance
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

      if (this.useGrayscale) {
        // Use luminance as the value and alpha
        let alpha = (luminance / 255) * (a / 255) * 255;

        if (this.invertAlpha) {
          alpha = 255 - alpha;
        }

        // Store as white with variable alpha (will be tinted when drawing)
        data[i] = 255;     // R
        data[i + 1] = 255; // G
        data[i + 2] = 255; // B
        data[i + 3] = alpha; // A
      }
    }

    ctx.putImageData(imageData, 0, 0);

    // Clear cache when image is processed
    this.cache.clear();
  }

  /**
   * Get a scaled version of the brush tip
   */
  getScaled(size) {
    if (!this.originalCanvas) return null;

    // Round size for caching
    const cacheKey = Math.round(size);

    // Check cache
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // Create scaled canvas
    const scale = size / Math.max(this.width, this.height);
    const scaledWidth = Math.max(1, Math.round(this.width * scale));
    const scaledHeight = Math.max(1, Math.round(this.height * scale));

    const scaledCanvas = new OffscreenCanvas(scaledWidth, scaledHeight);
    const ctx = scaledCanvas.getContext('2d');

    // Use better quality scaling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(this.originalCanvas, 0, 0, scaledWidth, scaledHeight);

    // Manage cache size
    if (this.cache.size >= this.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(cacheKey, scaledCanvas);
    return scaledCanvas;
  }

  /**
   * Draw the brush tip at a position with color
   */
  draw(ctx, x, y, size, color, opacity = 1, angle = 0, roundness = 1) {
    const scaledTip = this.getScaled(size);
    if (!scaledTip) return;

    const halfWidth = scaledTip.width / 2;
    const halfHeight = scaledTip.height / 2;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle * Math.PI / 180);
    ctx.scale(1, roundness);

    // Apply color tinting using multiply blend mode on a temp canvas
    const tempCanvas = new OffscreenCanvas(scaledTip.width, scaledTip.height);
    const tempCtx = tempCanvas.getContext('2d');

    // Draw the tip
    tempCtx.drawImage(scaledTip, 0, 0);

    // Apply color using multiply
    tempCtx.globalCompositeOperation = 'multiply';
    tempCtx.fillStyle = color;
    tempCtx.fillRect(0, 0, scaledTip.width, scaledTip.height);

    // Restore alpha from original
    tempCtx.globalCompositeOperation = 'destination-in';
    tempCtx.drawImage(scaledTip, 0, 0);

    // Draw to main context with opacity
    ctx.globalAlpha = opacity;
    ctx.drawImage(tempCanvas, -halfWidth, -halfHeight);

    ctx.restore();
  }

  /**
   * Generate a thumbnail preview
   */
  generateThumbnail(size = 48) {
    if (!this.originalCanvas) return null;

    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Draw checkerboard background
    const checkSize = 4;
    for (let y = 0; y < size; y += checkSize) {
      for (let x = 0; x < size; x += checkSize) {
        ctx.fillStyle = ((x + y) / checkSize) % 2 === 0 ? '#444' : '#333';
        ctx.fillRect(x, y, checkSize, checkSize);
      }
    }

    // Scale and center the tip
    const scale = Math.min(size / this.width, size / this.height) * 0.8;
    const scaledW = this.width * scale;
    const scaledH = this.height * scale;
    const offsetX = (size - scaledW) / 2;
    const offsetY = (size - scaledH) / 2;

    ctx.drawImage(this.originalCanvas, offsetX, offsetY, scaledW, scaledH);

    return canvas;
  }

  /**
   * Serialize for storage (without canvas data)
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      category: this.category,
      width: this.width,
      height: this.height,
      useGrayscale: this.useGrayscale,
      invertAlpha: this.invertAlpha
    };
  }
}

/**
 * Brush Tip Manager - manages custom brush tips
 */
class BrushTipManager {
  constructor() {
    this.tips = new Map();
    this.categories = new Set(['Custom']);
    this.eventBus = null;

    // Load built-in tips
    this.loadBuiltInTips();
  }

  init() {
    this.eventBus = getEventBus();
  }

  /**
   * Load built-in brush tips (generated procedurally)
   */
  loadBuiltInTips() {
    // Create some built-in tips

    // Noise/grain tip
    const noiseTip = this.createNoiseTip(64, 64);
    noiseTip.id = 'builtin-noise';
    noiseTip.name = 'Noise';
    noiseTip.category = 'Built-in';
    this.addTip(noiseTip);

    // Splatter tip
    const splatterTip = this.createSplatterTip(64, 64);
    splatterTip.id = 'builtin-splatter';
    splatterTip.name = 'Splatter';
    splatterTip.category = 'Built-in';
    this.addTip(splatterTip);

    // Grass/hair tip
    const grassTip = this.createGrassTip(32, 64);
    grassTip.id = 'builtin-grass';
    grassTip.name = 'Grass';
    grassTip.category = 'Built-in';
    this.addTip(grassTip);

    // Leaf tip
    const leafTip = this.createLeafTip(48, 48);
    leafTip.id = 'builtin-leaf';
    leafTip.name = 'Leaf';
    leafTip.category = 'Built-in';
    this.addTip(leafTip);
  }

  /**
   * Create a noise-based tip
   */
  createNoiseTip(width, height) {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    const centerX = width / 2;
    const centerY = height / 2;
    const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;

        // Distance from center for falloff
        const dx = x - centerX;
        const dy = y - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const falloff = Math.max(0, 1 - dist / maxDist);

        // Random noise with falloff
        const noise = Math.random();
        const alpha = noise * falloff * 255;

        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        data[i + 3] = alpha;
      }
    }

    ctx.putImageData(imageData, 0, 0);

    const tip = new BrushTip({ width, height, useGrayscale: false });
    tip.originalCanvas = canvas;
    return tip;
  }

  /**
   * Create a splatter tip
   */
  createSplatterTip(width, height) {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'white';

    // Draw random circles
    const numCircles = 20;
    for (let i = 0; i < numCircles; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const radius = Math.random() * 8 + 2;

      ctx.globalAlpha = Math.random() * 0.5 + 0.5;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    const tip = new BrushTip({ width, height, useGrayscale: false });
    tip.originalCanvas = canvas;
    return tip;
  }

  /**
   * Create a grass/hair tip
   */
  createGrassTip(width, height) {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');

    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';

    // Draw grass blades
    const numBlades = 8;
    for (let i = 0; i < numBlades; i++) {
      const startX = (width / numBlades) * i + width / numBlades / 2;
      const startY = height;

      // Curve control points
      const cp1x = startX + (Math.random() - 0.5) * 10;
      const cp1y = height * 0.6;
      const endX = startX + (Math.random() - 0.5) * 15;
      const endY = Math.random() * height * 0.3;

      ctx.globalAlpha = 0.7 + Math.random() * 0.3;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.quadraticCurveTo(cp1x, cp1y, endX, endY);
      ctx.stroke();
    }

    const tip = new BrushTip({ width, height, useGrayscale: false });
    tip.originalCanvas = canvas;
    return tip;
  }

  /**
   * Create a leaf tip
   */
  createLeafTip(width, height) {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');

    const centerX = width / 2;
    const centerY = height / 2;

    ctx.fillStyle = 'white';
    ctx.beginPath();

    // Draw leaf shape using bezier curves
    ctx.moveTo(centerX, 0);
    ctx.bezierCurveTo(
      width * 0.8, height * 0.3,
      width * 0.8, height * 0.7,
      centerX, height
    );
    ctx.bezierCurveTo(
      width * 0.2, height * 0.7,
      width * 0.2, height * 0.3,
      centerX, 0
    );
    ctx.fill();

    // Draw center vein
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centerX, height * 0.1);
    ctx.lineTo(centerX, height * 0.9);
    ctx.stroke();

    const tip = new BrushTip({ width, height, useGrayscale: false });
    tip.originalCanvas = canvas;
    return tip;
  }

  /**
   * Add a brush tip
   */
  addTip(tip) {
    this.tips.set(tip.id, tip);
    this.categories.add(tip.category);
  }

  /**
   * Remove a brush tip
   */
  removeTip(id) {
    const tip = this.tips.get(id);
    if (tip) {
      this.tips.delete(id);

      // Check if category is still needed
      const hasCategory = Array.from(this.tips.values())
        .some(t => t.category === tip.category);
      if (!hasCategory && tip.category !== 'Built-in') {
        this.categories.delete(tip.category);
      }
    }
  }

  /**
   * Get a brush tip by ID
   */
  getTip(id) {
    return this.tips.get(id);
  }

  /**
   * Get all tips in a category
   */
  getTipsByCategory(category) {
    return Array.from(this.tips.values())
      .filter(t => t.category === category);
  }

  /**
   * Get all tips
   */
  getAllTips() {
    return Array.from(this.tips.values());
  }

  /**
   * Get all categories
   */
  getCategories() {
    return Array.from(this.categories);
  }

  /**
   * Load tip from file
   */
  async loadFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (e) => {
        const img = new Image();

        img.onload = async () => {
          const tip = new BrushTip({
            name: file.name.replace(/\.[^/.]+$/, ''),
            category: 'Custom'
          });

          await tip.loadFromImage(img);
          this.addTip(tip);

          if (this.eventBus) {
            this.eventBus.emit('brush-tip:loaded', { tip });
          }

          resolve(tip);
        };

        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target.result;
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }
}

// Singleton instance
let tipManager = null;

export function getBrushTipManager() {
  if (!tipManager) {
    tipManager = new BrushTipManager();
  }
  return tipManager;
}
