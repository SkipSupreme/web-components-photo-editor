/**
 * Brush Presets - Predefined brush configurations
 */

/**
 * Brush tip shapes
 */
export const BrushTipShape = {
  ROUND: 'round',
  SQUARE: 'square',
  DIAMOND: 'diamond',
  CUSTOM: 'custom'
};

/**
 * Brush preset definition
 */
export class BrushPreset {
  constructor(options = {}) {
    this.id = options.id ?? `preset_${Date.now()}`;
    this.name = options.name ?? 'New Brush';
    this.category = options.category ?? 'General';

    // Tip shape
    this.tipShape = options.tipShape ?? BrushTipShape.ROUND;
    this.tipImage = options.tipImage ?? null; // For custom tips

    // Size
    this.size = options.size ?? 20;
    this.minSize = options.minSize ?? 1;
    this.maxSize = options.maxSize ?? 500;

    // Hardness (0 = soft, 100 = hard)
    this.hardness = options.hardness ?? 100;

    // Opacity (0-100)
    this.opacity = options.opacity ?? 100;

    // Flow (0-100) - how fast paint builds up
    this.flow = options.flow ?? 100;

    // Spacing (% of brush size between dabs)
    this.spacing = options.spacing ?? 25;

    // Angle and roundness
    this.angle = options.angle ?? 0;        // degrees
    this.roundness = options.roundness ?? 100; // % (100 = circle, lower = ellipse)

    // Dynamics - how pressure affects properties
    this.dynamics = {
      sizeJitter: options.dynamics?.sizeJitter ?? 0,
      sizePressure: options.dynamics?.sizePressure ?? true,
      sizeMinimum: options.dynamics?.sizeMinimum ?? 0,

      opacityJitter: options.dynamics?.opacityJitter ?? 0,
      opacityPressure: options.dynamics?.opacityPressure ?? false,

      flowJitter: options.dynamics?.flowJitter ?? 0,
      flowPressure: options.dynamics?.flowPressure ?? false,

      angleJitter: options.dynamics?.angleJitter ?? 0,
      anglePressure: options.dynamics?.anglePressure ?? false,

      roundnessJitter: options.dynamics?.roundnessJitter ?? 0,
      roundnessPressure: options.dynamics?.roundnessPressure ?? false,

      // Scatter
      scatter: options.dynamics?.scatter ?? 0,
      scatterBothAxes: options.dynamics?.scatterBothAxes ?? false,
      count: options.dynamics?.count ?? 1,
      countJitter: options.dynamics?.countJitter ?? 0
    };

    // Transfer (how paint transfers)
    this.transfer = {
      buildup: options.transfer?.buildup ?? false, // Airbrush mode
      smoothing: options.transfer?.smoothing ?? 0,  // Stroke smoothing %
      wetEdges: options.transfer?.wetEdges ?? false
    };

    // Blend mode for brush
    this.blendMode = options.blendMode ?? 'normal';

    // Thumbnail (generated or custom)
    this.thumbnail = options.thumbnail ?? null;
  }

  /**
   * Clone this preset
   */
  clone() {
    return new BrushPreset({
      ...this,
      id: `preset_${Date.now()}`,
      name: `${this.name} Copy`,
      dynamics: { ...this.dynamics },
      transfer: { ...this.transfer }
    });
  }

  /**
   * Generate a thumbnail for this preset
   */
  generateThumbnail(size = 48) {
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Draw brush preview
    const radius = (size * 0.4) * (this.roundness / 100);
    const centerX = size / 2;
    const centerY = size / 2;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(this.angle * Math.PI / 180);

    if (this.hardness >= 99) {
      // Hard brush
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      if (this.tipShape === BrushTipShape.ROUND) {
        ctx.ellipse(0, 0, radius, radius * (this.roundness / 100), 0, 0, Math.PI * 2);
      } else if (this.tipShape === BrushTipShape.SQUARE) {
        const halfSize = radius;
        ctx.rect(-halfSize, -halfSize * (this.roundness / 100), halfSize * 2, halfSize * 2 * (this.roundness / 100));
      } else if (this.tipShape === BrushTipShape.DIAMOND) {
        ctx.moveTo(0, -radius);
        ctx.lineTo(radius, 0);
        ctx.lineTo(0, radius * (this.roundness / 100));
        ctx.lineTo(-radius, 0);
        ctx.closePath();
      }
      ctx.fill();
    } else {
      // Soft brush with gradient
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
      const hardnessPoint = this.hardness / 100;
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
      gradient.addColorStop(hardnessPoint, 'rgba(255, 255, 255, 0.8)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.fillStyle = gradient;
      ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
    }

    ctx.restore();

    this.thumbnail = canvas;
    return canvas;
  }

  /**
   * Serialize for storage
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      category: this.category,
      tipShape: this.tipShape,
      size: this.size,
      hardness: this.hardness,
      opacity: this.opacity,
      flow: this.flow,
      spacing: this.spacing,
      angle: this.angle,
      roundness: this.roundness,
      dynamics: this.dynamics,
      transfer: this.transfer,
      blendMode: this.blendMode
    };
  }

  static fromJSON(json) {
    return new BrushPreset(json);
  }
}

/**
 * Default brush presets
 */
export const defaultPresets = [
  // Basic brushes
  new BrushPreset({
    id: 'hard-round',
    name: 'Hard Round',
    category: 'Basic',
    tipShape: BrushTipShape.ROUND,
    size: 20,
    hardness: 100,
    opacity: 100,
    flow: 100,
    spacing: 25,
    dynamics: { sizePressure: true }
  }),

  new BrushPreset({
    id: 'soft-round',
    name: 'Soft Round',
    category: 'Basic',
    tipShape: BrushTipShape.ROUND,
    size: 30,
    hardness: 0,
    opacity: 100,
    flow: 100,
    spacing: 25,
    dynamics: { sizePressure: true }
  }),

  new BrushPreset({
    id: 'hard-round-pressure-opacity',
    name: 'Hard Round Pressure Opacity',
    category: 'Basic',
    tipShape: BrushTipShape.ROUND,
    size: 20,
    hardness: 100,
    opacity: 100,
    flow: 100,
    spacing: 25,
    dynamics: {
      sizePressure: true,
      opacityPressure: true
    }
  }),

  new BrushPreset({
    id: 'soft-round-pressure-opacity',
    name: 'Soft Round Pressure Opacity',
    category: 'Basic',
    tipShape: BrushTipShape.ROUND,
    size: 30,
    hardness: 0,
    opacity: 100,
    flow: 100,
    spacing: 25,
    dynamics: {
      sizePressure: true,
      opacityPressure: true
    }
  }),

  // Airbrush
  new BrushPreset({
    id: 'airbrush-soft',
    name: 'Soft Airbrush',
    category: 'Airbrush',
    tipShape: BrushTipShape.ROUND,
    size: 50,
    hardness: 0,
    opacity: 20,
    flow: 20,
    spacing: 10,
    dynamics: {
      sizePressure: true,
      flowPressure: true
    },
    transfer: { buildup: true }
  }),

  // Textured
  new BrushPreset({
    id: 'chalk',
    name: 'Chalk',
    category: 'Dry Media',
    tipShape: BrushTipShape.ROUND,
    size: 25,
    hardness: 70,
    opacity: 80,
    flow: 100,
    spacing: 15,
    dynamics: {
      sizePressure: true,
      sizeJitter: 10,
      opacityJitter: 20,
      scatter: 20
    }
  }),

  new BrushPreset({
    id: 'pencil',
    name: 'Pencil',
    category: 'Dry Media',
    tipShape: BrushTipShape.ROUND,
    size: 5,
    hardness: 90,
    opacity: 100,
    flow: 100,
    spacing: 10,
    dynamics: {
      sizePressure: true,
      sizeMinimum: 20,
      opacityPressure: true
    }
  }),

  new BrushPreset({
    id: 'charcoal',
    name: 'Charcoal',
    category: 'Dry Media',
    tipShape: BrushTipShape.ROUND,
    size: 30,
    hardness: 30,
    opacity: 70,
    flow: 80,
    spacing: 8,
    roundness: 60,
    angle: 45,
    dynamics: {
      sizePressure: true,
      opacityPressure: true,
      sizeJitter: 15,
      angleJitter: 20
    }
  }),

  // Ink
  new BrushPreset({
    id: 'ink-pen',
    name: 'Ink Pen',
    category: 'Ink',
    tipShape: BrushTipShape.ROUND,
    size: 8,
    hardness: 100,
    opacity: 100,
    flow: 100,
    spacing: 5,
    dynamics: {
      sizePressure: true,
      sizeMinimum: 10
    },
    transfer: { smoothing: 50 }
  }),

  new BrushPreset({
    id: 'marker',
    name: 'Marker',
    category: 'Ink',
    tipShape: BrushTipShape.ROUND,
    size: 20,
    hardness: 80,
    opacity: 80,
    flow: 100,
    spacing: 15,
    dynamics: {
      sizePressure: false
    },
    transfer: { wetEdges: true }
  }),

  // Special
  new BrushPreset({
    id: 'spray',
    name: 'Spray',
    category: 'Special',
    tipShape: BrushTipShape.ROUND,
    size: 100,
    hardness: 100,
    opacity: 20,
    flow: 50,
    spacing: 5,
    dynamics: {
      scatter: 100,
      scatterBothAxes: true,
      count: 3,
      countJitter: 50,
      sizeJitter: 80
    },
    transfer: { buildup: true }
  }),

  new BrushPreset({
    id: 'splatter',
    name: 'Splatter',
    category: 'Special',
    tipShape: BrushTipShape.ROUND,
    size: 50,
    hardness: 100,
    opacity: 100,
    flow: 100,
    spacing: 100,
    dynamics: {
      scatter: 150,
      scatterBothAxes: true,
      sizeJitter: 100,
      count: 5,
      countJitter: 80
    }
  }),

  // Shapes
  new BrushPreset({
    id: 'square',
    name: 'Square',
    category: 'Shapes',
    tipShape: BrushTipShape.SQUARE,
    size: 20,
    hardness: 100,
    opacity: 100,
    flow: 100,
    spacing: 25,
    dynamics: { sizePressure: true }
  }),

  new BrushPreset({
    id: 'diamond',
    name: 'Diamond',
    category: 'Shapes',
    tipShape: BrushTipShape.DIAMOND,
    size: 20,
    hardness: 100,
    opacity: 100,
    flow: 100,
    spacing: 25,
    dynamics: { sizePressure: true }
  }),

  // Eraser presets
  new BrushPreset({
    id: 'eraser-hard',
    name: 'Hard Eraser',
    category: 'Erasers',
    tipShape: BrushTipShape.ROUND,
    size: 30,
    hardness: 100,
    opacity: 100,
    flow: 100,
    spacing: 25,
    dynamics: { sizePressure: true }
  }),

  new BrushPreset({
    id: 'eraser-soft',
    name: 'Soft Eraser',
    category: 'Erasers',
    tipShape: BrushTipShape.ROUND,
    size: 50,
    hardness: 0,
    opacity: 100,
    flow: 100,
    spacing: 25,
    dynamics: {
      sizePressure: true,
      opacityPressure: true
    }
  })
];

// Generate thumbnails for all default presets
defaultPresets.forEach(preset => preset.generateThumbnail());

/**
 * Brush preset manager
 */
class BrushPresetManager {
  constructor() {
    this.presets = new Map();
    this.categories = new Set();
    this.activePresetId = null;

    // Load defaults
    this.loadDefaults();
  }

  loadDefaults() {
    for (const preset of defaultPresets) {
      this.addPreset(preset);
    }
    this.activePresetId = 'hard-round';
  }

  addPreset(preset) {
    this.presets.set(preset.id, preset);
    this.categories.add(preset.category);
  }

  removePreset(id) {
    const preset = this.presets.get(id);
    if (preset) {
      this.presets.delete(id);

      // Check if category is still needed
      const hasCategory = Array.from(this.presets.values())
        .some(p => p.category === preset.category);
      if (!hasCategory) {
        this.categories.delete(preset.category);
      }
    }
  }

  getPreset(id) {
    return this.presets.get(id);
  }

  getActivePreset() {
    return this.presets.get(this.activePresetId);
  }

  setActivePreset(id) {
    if (this.presets.has(id)) {
      this.activePresetId = id;
      return true;
    }
    return false;
  }

  getPresetsByCategory(category) {
    return Array.from(this.presets.values())
      .filter(p => p.category === category);
  }

  getAllPresets() {
    return Array.from(this.presets.values());
  }

  getCategories() {
    return Array.from(this.categories);
  }

  /**
   * Export presets to JSON
   */
  exportPresets() {
    return Array.from(this.presets.values()).map(p => p.toJSON());
  }

  /**
   * Import presets from JSON
   */
  importPresets(json) {
    for (const data of json) {
      const preset = BrushPreset.fromJSON(data);
      preset.generateThumbnail();
      this.addPreset(preset);
    }
  }
}

// Singleton instance
let presetManager = null;

export function getBrushPresetManager() {
  if (!presetManager) {
    presetManager = new BrushPresetManager();
  }
  return presetManager;
}
