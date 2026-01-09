/**
 * Selection - Manages selection state as a mask
 * Selections can be rectangular, elliptical, freeform (path), or pixel-based (mask)
 */

import { getEventBus, Events } from '../core/event-bus.js';

/**
 * Selection mode for combining selections
 */
export const SelectionMode = {
  REPLACE: 'replace',    // Replace existing selection
  ADD: 'add',            // Union with existing
  SUBTRACT: 'subtract',  // Subtract from existing
  INTERSECT: 'intersect' // Intersect with existing
};

/**
 * Selection type
 */
export const SelectionType = {
  NONE: 'none',
  RECTANGLE: 'rectangle',
  ELLIPSE: 'ellipse',
  PATH: 'path',      // Freeform/lasso
  MASK: 'mask'       // Pixel-based (magic wand result)
};

export class Selection {
  constructor(width, height) {
    this.width = width;
    this.height = height;

    // Selection is stored as an alpha mask (0 = not selected, 255 = selected)
    // Allows for soft/feathered selections
    this.mask = null;

    // For rendering marching ants, we also store the path
    this.path = null;
    this.bounds = null;

    // Selection type
    this.type = SelectionType.NONE;

    // Feather radius
    this.feather = 0;

    // Anti-aliased edge
    this.antiAlias = true;

    this.eventBus = getEventBus();
  }

  /**
   * Check if there's an active selection
   */
  hasSelection() {
    return this.type !== SelectionType.NONE && this.mask !== null;
  }

  /**
   * Clear selection
   */
  clear() {
    this.mask = null;
    this.path = null;
    this.bounds = null;
    this.type = SelectionType.NONE;
    this.eventBus.emit(Events.SELECTION_CLEARED);
  }

  /**
   * Select all
   */
  selectAll() {
    this.mask = new Uint8ClampedArray(this.width * this.height);
    this.mask.fill(255);
    this.type = SelectionType.RECTANGLE;
    this.bounds = { x: 0, y: 0, width: this.width, height: this.height };
    this.path = this.boundsToPath(this.bounds);
    this.eventBus.emit(Events.SELECTION_CHANGED, { selection: this });
  }

  /**
   * Invert selection
   */
  invert() {
    if (!this.mask) {
      this.selectAll();
      return;
    }

    for (let i = 0; i < this.mask.length; i++) {
      this.mask[i] = 255 - this.mask[i];
    }

    this.updateBounds();
    this.eventBus.emit(Events.SELECTION_CHANGED, { selection: this });
  }

  /**
   * Create rectangular selection
   */
  fromRectangle(x, y, width, height, mode = SelectionMode.REPLACE) {
    const rect = { x: Math.floor(x), y: Math.floor(y), width: Math.ceil(width), height: Math.ceil(height) };

    // Clamp to canvas bounds
    const x1 = Math.max(0, rect.x);
    const y1 = Math.max(0, rect.y);
    const x2 = Math.min(this.width, rect.x + rect.width);
    const y2 = Math.min(this.height, rect.y + rect.height);

    if (x2 <= x1 || y2 <= y1) {
      if (mode === SelectionMode.REPLACE) this.clear();
      return;
    }

    const newMask = new Uint8ClampedArray(this.width * this.height);

    // Fill rectangle
    for (let py = y1; py < y2; py++) {
      for (let px = x1; px < x2; px++) {
        newMask[py * this.width + px] = 255;
      }
    }

    this.applyMask(newMask, mode);
    this.type = SelectionType.RECTANGLE;
    this.path = this.boundsToPath({ x: x1, y: y1, width: x2 - x1, height: y2 - y1 });
    this.updateBounds();

    this.eventBus.emit(Events.SELECTION_CHANGED, { selection: this });
  }

  /**
   * Create elliptical selection
   */
  fromEllipse(cx, cy, rx, ry, mode = SelectionMode.REPLACE) {
    const x1 = Math.max(0, Math.floor(cx - rx));
    const y1 = Math.max(0, Math.floor(cy - ry));
    const x2 = Math.min(this.width, Math.ceil(cx + rx));
    const y2 = Math.min(this.height, Math.ceil(cy + ry));

    if (x2 <= x1 || y2 <= y1) {
      if (mode === SelectionMode.REPLACE) this.clear();
      return;
    }

    const newMask = new Uint8ClampedArray(this.width * this.height);

    // Fill ellipse
    for (let py = y1; py < y2; py++) {
      for (let px = x1; px < x2; px++) {
        // Normalized distance from center
        const dx = (px - cx) / rx;
        const dy = (py - cy) / ry;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= 1.0) {
          // Anti-aliasing at the edge
          if (this.antiAlias && dist > 0.9) {
            newMask[py * this.width + px] = Math.round(255 * (1 - (dist - 0.9) / 0.1));
          } else {
            newMask[py * this.width + px] = 255;
          }
        }
      }
    }

    this.applyMask(newMask, mode);
    this.type = SelectionType.ELLIPSE;
    this.path = this.ellipseToPath(cx, cy, rx, ry);
    this.updateBounds();

    this.eventBus.emit(Events.SELECTION_CHANGED, { selection: this });
  }

  /**
   * Create selection from polygon path
   */
  fromPath(points, mode = SelectionMode.REPLACE) {
    if (points.length < 3) {
      if (mode === SelectionMode.REPLACE) this.clear();
      return;
    }

    const newMask = new Uint8ClampedArray(this.width * this.height);

    // Use scanline fill algorithm
    const minY = Math.max(0, Math.floor(Math.min(...points.map(p => p.y))));
    const maxY = Math.min(this.height - 1, Math.ceil(Math.max(...points.map(p => p.y))));

    for (let y = minY; y <= maxY; y++) {
      const intersections = [];

      // Find all edge intersections with this scanline
      for (let i = 0; i < points.length; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % points.length];

        if ((p1.y <= y && p2.y > y) || (p2.y <= y && p1.y > y)) {
          const x = p1.x + (y - p1.y) / (p2.y - p1.y) * (p2.x - p1.x);
          intersections.push(x);
        }
      }

      // Sort intersections
      intersections.sort((a, b) => a - b);

      // Fill between pairs of intersections
      for (let i = 0; i < intersections.length; i += 2) {
        const x1 = Math.max(0, Math.floor(intersections[i]));
        const x2 = Math.min(this.width, Math.ceil(intersections[i + 1] || intersections[i]));

        for (let x = x1; x < x2; x++) {
          newMask[y * this.width + x] = 255;
        }
      }
    }

    this.applyMask(newMask, mode);
    this.type = SelectionType.PATH;
    this.path = points;
    this.updateBounds();

    this.eventBus.emit(Events.SELECTION_CHANGED, { selection: this });
  }

  /**
   * Create selection from pixel mask (magic wand, etc.)
   */
  fromMask(mask, mode = SelectionMode.REPLACE) {
    this.applyMask(mask, mode);
    this.type = SelectionType.MASK;
    this.path = null; // Complex masks don't have simple paths
    this.updateBounds();

    this.eventBus.emit(Events.SELECTION_CHANGED, { selection: this });
  }

  /**
   * Apply a new mask with the given mode
   */
  applyMask(newMask, mode) {
    if (mode === SelectionMode.REPLACE || !this.mask) {
      this.mask = newMask;
      return;
    }

    for (let i = 0; i < this.mask.length; i++) {
      switch (mode) {
        case SelectionMode.ADD:
          // Union: max of both
          this.mask[i] = Math.max(this.mask[i], newMask[i]);
          break;

        case SelectionMode.SUBTRACT:
          // Subtract: old minus new
          this.mask[i] = Math.max(0, this.mask[i] - newMask[i]);
          break;

        case SelectionMode.INTERSECT:
          // Intersect: min of both
          this.mask[i] = Math.min(this.mask[i], newMask[i]);
          break;
      }
    }
  }

  /**
   * Apply feathering to the selection
   */
  featherSelection(radius) {
    if (!this.mask || radius <= 0) return;

    // Simple box blur for feathering
    const temp = new Uint8ClampedArray(this.mask.length);
    const size = Math.ceil(radius);

    // Horizontal pass
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        let sum = 0;
        let count = 0;

        for (let dx = -size; dx <= size; dx++) {
          const nx = x + dx;
          if (nx >= 0 && nx < this.width) {
            sum += this.mask[y * this.width + nx];
            count++;
          }
        }

        temp[y * this.width + x] = Math.round(sum / count);
      }
    }

    // Vertical pass
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        let sum = 0;
        let count = 0;

        for (let dy = -size; dy <= size; dy++) {
          const ny = y + dy;
          if (ny >= 0 && ny < this.height) {
            sum += temp[ny * this.width + x];
            count++;
          }
        }

        this.mask[y * this.width + x] = Math.round(sum / count);
      }
    }

    this.feather = radius;
    this.eventBus.emit(Events.SELECTION_CHANGED, { selection: this });
  }

  /**
   * Expand or contract selection
   */
  modify(amount) {
    if (!this.mask) return;

    // Positive = expand, negative = contract
    const expand = amount > 0;
    const size = Math.abs(Math.ceil(amount));

    const temp = new Uint8ClampedArray(this.mask.length);

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (expand) {
          // Expand: if any neighbor is selected, select this pixel
          let maxVal = 0;
          for (let dy = -size; dy <= size; dy++) {
            for (let dx = -size; dx <= size; dx++) {
              const nx = x + dx;
              const ny = y + dy;
              if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                maxVal = Math.max(maxVal, this.mask[ny * this.width + nx]);
              }
            }
          }
          temp[y * this.width + x] = maxVal;
        } else {
          // Contract: if any neighbor is not selected, deselect this pixel
          let minVal = 255;
          for (let dy = -size; dy <= size; dy++) {
            for (let dx = -size; dx <= size; dx++) {
              const nx = x + dx;
              const ny = y + dy;
              if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                minVal = Math.min(minVal, this.mask[ny * this.width + nx]);
              }
            }
          }
          temp[y * this.width + x] = minVal;
        }
      }
    }

    this.mask = temp;
    this.updateBounds();
    this.eventBus.emit(Events.SELECTION_CHANGED, { selection: this });
  }

  /**
   * Update selection bounds
   */
  updateBounds() {
    if (!this.mask) {
      this.bounds = null;
      return;
    }

    let minX = this.width;
    let minY = this.height;
    let maxX = 0;
    let maxY = 0;
    let hasSelection = false;

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.mask[y * this.width + x] > 0) {
          hasSelection = true;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    if (hasSelection) {
      this.bounds = {
        x: minX,
        y: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1
      };
    } else {
      this.bounds = null;
      this.type = SelectionType.NONE;
    }
  }

  /**
   * Get selection mask as ImageData for rendering
   */
  toImageData() {
    if (!this.mask) return null;

    const imageData = new ImageData(this.width, this.height);

    for (let i = 0; i < this.mask.length; i++) {
      const val = this.mask[i];
      const idx = i * 4;
      imageData.data[idx] = val;
      imageData.data[idx + 1] = val;
      imageData.data[idx + 2] = val;
      imageData.data[idx + 3] = 255;
    }

    return imageData;
  }

  /**
   * Check if a point is inside the selection
   */
  containsPoint(x, y) {
    if (!this.mask) return false;

    const px = Math.floor(x);
    const py = Math.floor(y);

    if (px < 0 || px >= this.width || py < 0 || py >= this.height) {
      return false;
    }

    return this.mask[py * this.width + px] > 127;
  }

  /**
   * Get selection alpha at a point (0-1)
   */
  getAlphaAt(x, y) {
    if (!this.mask) return 1;

    const px = Math.floor(x);
    const py = Math.floor(y);

    if (px < 0 || px >= this.width || py < 0 || py >= this.height) {
      return 0;
    }

    return this.mask[py * this.width + px] / 255;
  }

  /**
   * Convert bounds to a path
   */
  boundsToPath(bounds) {
    return [
      { x: bounds.x, y: bounds.y },
      { x: bounds.x + bounds.width, y: bounds.y },
      { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
      { x: bounds.x, y: bounds.y + bounds.height }
    ];
  }

  /**
   * Convert ellipse to path (approximate with points)
   */
  ellipseToPath(cx, cy, rx, ry, segments = 64) {
    const points = [];
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push({
        x: cx + rx * Math.cos(angle),
        y: cy + ry * Math.sin(angle)
      });
    }
    return points;
  }

  /**
   * Clone this selection
   */
  clone() {
    const cloned = new Selection(this.width, this.height);
    if (this.mask) {
      cloned.mask = new Uint8ClampedArray(this.mask);
    }
    if (this.path) {
      cloned.path = this.path.map(p => ({ ...p }));
    }
    if (this.bounds) {
      cloned.bounds = { ...this.bounds };
    }
    cloned.type = this.type;
    cloned.feather = this.feather;
    cloned.antiAlias = this.antiAlias;
    return cloned;
  }
}
