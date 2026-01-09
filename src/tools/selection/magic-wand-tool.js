/**
 * Magic Wand Tool - Color-based selection using flood fill
 */

import { BaseTool } from '../base-tool.js';
import { getStore } from '../../core/store.js';
import { getEventBus, Events } from '../../core/event-bus.js';
import { Selection, SelectionMode } from '../../document/selection.js';

export class MagicWandTool extends BaseTool {
  constructor() {
    super('magicWand');

    this.store = null;
    this.eventBus = null;

    // Options
    this.tolerance = 32;        // Color tolerance (0-255)
    this.contiguous = true;     // Only select contiguous pixels
    this.antiAlias = true;
    this.sampleAllLayers = false;
  }

  onActivate() {
    super.onActivate();
    this.store = getStore();
    this.eventBus = getEventBus();

    // Load options from store
    const options = this.store.state.tools.options.magicWand;
    if (options) {
      this.tolerance = options.tolerance ?? 32;
      this.contiguous = options.contiguous ?? true;
      this.sampleAllLayers = options.sampleAllLayers ?? false;
    }
  }

  onPointerDown(event) {
    const app = window.photoEditorApp;
    if (!app || !app.document) return;

    const x = Math.floor(event.x);
    const y = Math.floor(event.y);

    // Check bounds
    if (x < 0 || x >= app.document.width || y < 0 || y >= app.document.height) {
      return;
    }

    // Get image data to sample from
    const imageData = this.getImageData(app);
    if (!imageData) return;

    // Create selection mask
    const mask = this.createSelectionMask(imageData, x, y);

    // Determine selection mode
    let mode = SelectionMode.REPLACE;
    if (event.shiftKey && !event.altKey) {
      mode = SelectionMode.ADD;
    } else if (event.altKey && !event.shiftKey) {
      mode = SelectionMode.SUBTRACT;
    } else if (event.shiftKey && event.altKey) {
      mode = SelectionMode.INTERSECT;
    }

    // Create or update selection
    if (!app.selection) {
      app.selection = new Selection(app.document.width, app.document.height);
    }

    app.selection.fromMask(mask, mode);

    // Request render
    this.eventBus.emit(Events.RENDER_REQUEST);
  }

  /**
   * Get image data to sample from
   */
  getImageData(app) {
    if (this.sampleAllLayers) {
      // Composite all visible layers
      const canvas = new OffscreenCanvas(app.document.width, app.document.height);
      const ctx = canvas.getContext('2d');

      for (const layer of app.document.layers) {
        if (!layer.visible || !layer.canvas) continue;

        ctx.globalAlpha = layer.opacity;
        ctx.globalCompositeOperation = layer.blendMode;
        ctx.drawImage(layer.canvas, layer.x, layer.y);
      }

      return ctx.getImageData(0, 0, app.document.width, app.document.height);
    } else {
      // Sample from active layer
      const layer = app.document.getActiveLayer();
      if (!layer || !layer.ctx) return null;

      return layer.ctx.getImageData(0, 0, layer.width, layer.height);
    }
  }

  /**
   * Create selection mask using flood fill or global color matching
   */
  createSelectionMask(imageData, startX, startY) {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;

    const mask = new Uint8ClampedArray(width * height);

    // Get target color at start position
    const startIdx = (startY * width + startX) * 4;
    const targetColor = {
      r: data[startIdx],
      g: data[startIdx + 1],
      b: data[startIdx + 2],
      a: data[startIdx + 3]
    };

    if (this.contiguous) {
      // Flood fill from start point
      this.floodFill(data, mask, width, height, startX, startY, targetColor);
    } else {
      // Select all pixels matching the color
      this.globalColorMatch(data, mask, width, height, targetColor);
    }

    // Anti-alias edges if enabled
    if (this.antiAlias) {
      this.antiAliasEdges(mask, width, height);
    }

    return mask;
  }

  /**
   * Flood fill algorithm for contiguous selection
   */
  floodFill(data, mask, width, height, startX, startY, targetColor) {
    const stack = [[startX, startY]];
    const visited = new Uint8Array(width * height);

    while (stack.length > 0) {
      const [x, y] = stack.pop();

      if (x < 0 || x >= width || y < 0 || y >= height) continue;

      const pixelIdx = y * width + x;
      if (visited[pixelIdx]) continue;
      visited[pixelIdx] = 1;

      const idx = pixelIdx * 4;
      const pixelColor = {
        r: data[idx],
        g: data[idx + 1],
        b: data[idx + 2],
        a: data[idx + 3]
      };

      if (!this.colorsMatch(pixelColor, targetColor)) continue;

      // Select this pixel
      mask[pixelIdx] = 255;

      // Add neighbors (4-connected)
      stack.push([x + 1, y]);
      stack.push([x - 1, y]);
      stack.push([x, y + 1]);
      stack.push([x, y - 1]);
    }
  }

  /**
   * Global color matching (non-contiguous)
   */
  globalColorMatch(data, mask, width, height, targetColor) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const pixelColor = {
          r: data[idx],
          g: data[idx + 1],
          b: data[idx + 2],
          a: data[idx + 3]
        };

        if (this.colorsMatch(pixelColor, targetColor)) {
          mask[y * width + x] = 255;
        }
      }
    }
  }

  /**
   * Check if two colors match within tolerance
   */
  colorsMatch(c1, c2) {
    // Calculate color distance
    const dr = c1.r - c2.r;
    const dg = c1.g - c2.g;
    const db = c1.b - c2.b;
    const da = c1.a - c2.a;

    // Euclidean distance in RGBA space
    const distance = Math.sqrt(dr * dr + dg * dg + db * db + da * da);

    // Normalize to 0-255 range (max possible distance is 510)
    const normalizedDistance = distance / 2;

    return normalizedDistance <= this.tolerance;
  }

  /**
   * Anti-alias the edges of the selection
   */
  antiAliasEdges(mask, width, height) {
    const temp = new Uint8ClampedArray(mask.length);

    // Simple edge softening
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;

        if (mask[idx] === 0) {
          // Check if on edge (any neighbor is selected)
          const neighbors = [
            mask[(y - 1) * width + x],
            mask[(y + 1) * width + x],
            mask[y * width + (x - 1)],
            mask[y * width + (x + 1)]
          ];

          const selectedNeighbors = neighbors.filter(v => v > 0).length;
          if (selectedNeighbors > 0 && selectedNeighbors < 4) {
            temp[idx] = Math.round(255 * selectedNeighbors / 4 * 0.5);
          }
        } else {
          temp[idx] = mask[idx];
        }
      }
    }

    // Copy back
    for (let i = 0; i < mask.length; i++) {
      if (temp[i] > mask[i]) {
        mask[i] = temp[i];
      }
    }
  }

  getCursor() {
    return 'crosshair';
  }
}
