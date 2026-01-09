/**
 * Adjustment Layer System
 * Non-destructive adjustment layers that modify the appearance of layers below
 */

import { getEventBus, Events } from '../../core/event-bus.js';

/**
 * Adjustment types
 */
export const AdjustmentType = {
  BRIGHTNESS_CONTRAST: 'brightness-contrast',
  LEVELS: 'levels',
  CURVES: 'curves',
  HUE_SATURATION: 'hue-saturation',
  COLOR_BALANCE: 'color-balance',
  BLACK_WHITE: 'black-white',
  INVERT: 'invert',
  POSTERIZE: 'posterize',
  THRESHOLD: 'threshold',
  GRADIENT_MAP: 'gradient-map',
  PHOTO_FILTER: 'photo-filter',
  VIBRANCE: 'vibrance'
};

/**
 * Default parameters for each adjustment type
 */
export const AdjustmentDefaults = {
  [AdjustmentType.BRIGHTNESS_CONTRAST]: {
    brightness: 0,    // -100 to 100
    contrast: 0,      // -100 to 100
    useLegacy: false
  },

  [AdjustmentType.LEVELS]: {
    inputBlack: 0,    // 0-255
    inputWhite: 255,  // 0-255
    gamma: 1.0,       // 0.1-10
    outputBlack: 0,   // 0-255
    outputWhite: 255, // 0-255
    channel: 'rgb'    // 'rgb', 'red', 'green', 'blue'
  },

  [AdjustmentType.CURVES]: {
    points: {
      rgb: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
      red: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
      green: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
      blue: [{ x: 0, y: 0 }, { x: 255, y: 255 }]
    },
    channel: 'rgb'
  },

  [AdjustmentType.HUE_SATURATION]: {
    hue: 0,           // -180 to 180
    saturation: 0,    // -100 to 100
    lightness: 0,     // -100 to 100
    colorize: false,
    colorizeHue: 0,
    colorizeSaturation: 25
  },

  [AdjustmentType.COLOR_BALANCE]: {
    shadows: { cyan: 0, magenta: 0, yellow: 0 },
    midtones: { cyan: 0, magenta: 0, yellow: 0 },
    highlights: { cyan: 0, magenta: 0, yellow: 0 },
    preserveLuminosity: true
  },

  [AdjustmentType.BLACK_WHITE]: {
    reds: 40,
    yellows: 60,
    greens: 40,
    cyans: 60,
    blues: 20,
    magentas: 80,
    tint: false,
    tintColor: '#a28c6e',
    tintAmount: 50
  },

  [AdjustmentType.INVERT]: {},

  [AdjustmentType.POSTERIZE]: {
    levels: 4  // 2-255
  },

  [AdjustmentType.THRESHOLD]: {
    level: 128  // 1-255
  },

  [AdjustmentType.VIBRANCE]: {
    vibrance: 0,     // -100 to 100
    saturation: 0    // -100 to 100
  }
};

/**
 * Base Adjustment class
 */
export class Adjustment {
  constructor(type, params = {}) {
    this.type = type;
    this.params = { ...AdjustmentDefaults[type], ...params };
  }

  /**
   * Apply the adjustment to image data
   * Override in subclasses
   */
  apply(imageData) {
    throw new Error('apply() must be implemented by subclass');
  }

  /**
   * Get a preview LUT (lookup table) for fast preview
   */
  getLUT() {
    return null;
  }

  /**
   * Clone this adjustment
   */
  clone() {
    return new this.constructor(this.type, { ...this.params });
  }
}

/**
 * Brightness/Contrast Adjustment
 */
export class BrightnessContrastAdjustment extends Adjustment {
  constructor(params = {}) {
    super(AdjustmentType.BRIGHTNESS_CONTRAST, params);
  }

  apply(imageData) {
    const { brightness, contrast } = this.params;
    const data = imageData.data;

    // Normalize values
    const b = brightness / 100 * 255;
    const c = (contrast + 100) / 100;
    const factor = (259 * (c * 255 + 255)) / (255 * (259 - c * 255));

    for (let i = 0; i < data.length; i += 4) {
      // Apply brightness and contrast
      data[i] = this.clamp(factor * (data[i] + b - 128) + 128);
      data[i + 1] = this.clamp(factor * (data[i + 1] + b - 128) + 128);
      data[i + 2] = this.clamp(factor * (data[i + 2] + b - 128) + 128);
    }

    return imageData;
  }

  clamp(value) {
    return Math.max(0, Math.min(255, Math.round(value)));
  }
}

/**
 * Levels Adjustment
 */
export class LevelsAdjustment extends Adjustment {
  constructor(params = {}) {
    super(AdjustmentType.LEVELS, params);
  }

  apply(imageData) {
    const { inputBlack, inputWhite, gamma, outputBlack, outputWhite, channel } = this.params;
    const data = imageData.data;

    // Create lookup table
    const lut = new Uint8Array(256);
    const inputRange = inputWhite - inputBlack;

    for (let i = 0; i < 256; i++) {
      // Input levels
      let value = (i - inputBlack) / inputRange;
      value = Math.max(0, Math.min(1, value));

      // Gamma
      value = Math.pow(value, 1 / gamma);

      // Output levels
      value = outputBlack + value * (outputWhite - outputBlack);

      lut[i] = Math.max(0, Math.min(255, Math.round(value)));
    }

    // Apply LUT
    const channels = channel === 'rgb' ? [0, 1, 2] :
                     channel === 'red' ? [0] :
                     channel === 'green' ? [1] :
                     channel === 'blue' ? [2] : [0, 1, 2];

    for (let i = 0; i < data.length; i += 4) {
      for (const ch of channels) {
        data[i + ch] = lut[data[i + ch]];
      }
    }

    return imageData;
  }
}

/**
 * Hue/Saturation Adjustment
 */
export class HueSaturationAdjustment extends Adjustment {
  constructor(params = {}) {
    super(AdjustmentType.HUE_SATURATION, params);
  }

  apply(imageData) {
    const { hue, saturation, lightness, colorize, colorizeHue, colorizeSaturation } = this.params;
    const data = imageData.data;

    const hueShift = hue / 360;
    const satMult = (saturation + 100) / 100;
    const lightAdd = lightness / 100;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;

      if (colorize) {
        // Colorize mode
        const l = 0.299 * r + 0.587 * g + 0.114 * b;
        const h = colorizeHue / 360;
        const s = colorizeSaturation / 100;

        const rgb = this.hslToRgb(h, s, l + lightAdd);
        data[i] = Math.round(rgb.r * 255);
        data[i + 1] = Math.round(rgb.g * 255);
        data[i + 2] = Math.round(rgb.b * 255);
      } else {
        // Standard HSL adjustment
        const hsl = this.rgbToHsl(r, g, b);

        hsl.h = (hsl.h + hueShift + 1) % 1;
        hsl.s = Math.max(0, Math.min(1, hsl.s * satMult));
        hsl.l = Math.max(0, Math.min(1, hsl.l + lightAdd));

        const rgb = this.hslToRgb(hsl.h, hsl.s, hsl.l);
        data[i] = Math.round(rgb.r * 255);
        data[i + 1] = Math.round(rgb.g * 255);
        data[i + 2] = Math.round(rgb.b * 255);
      }
    }

    return imageData;
  }

  rgbToHsl(r, g, b) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;

    if (max === min) {
      return { h: 0, s: 0, l };
    }

    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    let h;
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }

    return { h, s, l };
  }

  hslToRgb(h, s, l) {
    if (s === 0) {
      return { r: l, g: l, b: l };
    }

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    return {
      r: this.hue2rgb(p, q, h + 1/3),
      g: this.hue2rgb(p, q, h),
      b: this.hue2rgb(p, q, h - 1/3)
    };
  }

  hue2rgb(p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  }
}

/**
 * Invert Adjustment
 */
export class InvertAdjustment extends Adjustment {
  constructor(params = {}) {
    super(AdjustmentType.INVERT, params);
  }

  apply(imageData) {
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255 - data[i];
      data[i + 1] = 255 - data[i + 1];
      data[i + 2] = 255 - data[i + 2];
    }

    return imageData;
  }
}

/**
 * Threshold Adjustment
 */
export class ThresholdAdjustment extends Adjustment {
  constructor(params = {}) {
    super(AdjustmentType.THRESHOLD, params);
  }

  apply(imageData) {
    const { level } = this.params;
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const value = gray >= level ? 255 : 0;
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
    }

    return imageData;
  }
}

/**
 * Posterize Adjustment
 */
export class PosterizeAdjustment extends Adjustment {
  constructor(params = {}) {
    super(AdjustmentType.POSTERIZE, params);
  }

  apply(imageData) {
    const { levels } = this.params;
    const data = imageData.data;

    const step = 255 / (levels - 1);

    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.round(Math.round(data[i] / step) * step);
      data[i + 1] = Math.round(Math.round(data[i + 1] / step) * step);
      data[i + 2] = Math.round(Math.round(data[i + 2] / step) * step);
    }

    return imageData;
  }
}

/**
 * Vibrance Adjustment
 */
export class VibranceAdjustment extends Adjustment {
  constructor(params = {}) {
    super(AdjustmentType.VIBRANCE, params);
  }

  apply(imageData) {
    const { vibrance, saturation } = this.params;
    const data = imageData.data;

    const vibAmt = vibrance / 100;
    const satAmt = (saturation + 100) / 100;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const avg = (r + g + b) / 3;

      // Calculate current saturation
      const currentSat = max === 0 ? 0 : 1 - min / max;

      // Vibrance affects less saturated pixels more
      const vibMult = 1 + vibAmt * (1 - currentSat);

      // Apply both adjustments
      const mult = satAmt * vibMult;

      data[i] = Math.max(0, Math.min(255, avg + (r - avg) * mult));
      data[i + 1] = Math.max(0, Math.min(255, avg + (g - avg) * mult));
      data[i + 2] = Math.max(0, Math.min(255, avg + (b - avg) * mult));
    }

    return imageData;
  }
}

/**
 * Create an adjustment by type
 */
export function createAdjustment(type, params = {}) {
  switch (type) {
    case AdjustmentType.BRIGHTNESS_CONTRAST:
      return new BrightnessContrastAdjustment(params);
    case AdjustmentType.LEVELS:
      return new LevelsAdjustment(params);
    case AdjustmentType.HUE_SATURATION:
      return new HueSaturationAdjustment(params);
    case AdjustmentType.INVERT:
      return new InvertAdjustment(params);
    case AdjustmentType.THRESHOLD:
      return new ThresholdAdjustment(params);
    case AdjustmentType.POSTERIZE:
      return new PosterizeAdjustment(params);
    case AdjustmentType.VIBRANCE:
      return new VibranceAdjustment(params);
    default:
      throw new Error(`Unknown adjustment type: ${type}`);
  }
}

/**
 * Apply adjustment to a layer's image data (non-destructive preview)
 */
export function applyAdjustmentPreview(layer, adjustment) {
  if (!layer || !layer.ctx) return null;

  const imageData = layer.ctx.getImageData(0, 0, layer.width, layer.height);
  adjustment.apply(imageData);
  return imageData;
}
