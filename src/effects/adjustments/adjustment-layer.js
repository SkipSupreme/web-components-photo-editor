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
 * Curves Adjustment
 * Uses cubic spline interpolation for smooth curves
 */
export class CurvesAdjustment extends Adjustment {
  constructor(params = {}) {
    super(AdjustmentType.CURVES, params);
    this.luts = null; // Cached lookup tables
  }

  apply(imageData) {
    const { points, channel } = this.params;
    const data = imageData.data;

    // Build LUTs for each channel
    this.luts = {
      rgb: this.buildLUT(points.rgb),
      red: this.buildLUT(points.red),
      green: this.buildLUT(points.green),
      blue: this.buildLUT(points.blue)
    };

    const rgbLut = this.luts.rgb;
    const rLut = this.luts.red;
    const gLut = this.luts.green;
    const bLut = this.luts.blue;

    for (let i = 0; i < data.length; i += 4) {
      // Apply RGB curve first, then individual channels
      data[i] = rLut[rgbLut[data[i]]];
      data[i + 1] = gLut[rgbLut[data[i + 1]]];
      data[i + 2] = bLut[rgbLut[data[i + 2]]];
    }

    return imageData;
  }

  buildLUT(points) {
    const lut = new Uint8Array(256);

    if (points.length < 2) {
      // Identity LUT
      for (let i = 0; i < 256; i++) lut[i] = i;
      return lut;
    }

    // Sort points by x
    const sorted = [...points].sort((a, b) => a.x - b.x);

    // Use monotonic cubic interpolation for smooth curves
    const n = sorted.length;
    const xs = sorted.map(p => p.x);
    const ys = sorted.map(p => p.y);

    // Calculate slopes
    const dxs = [];
    const dys = [];
    const ms = [];

    for (let i = 0; i < n - 1; i++) {
      dxs.push(xs[i + 1] - xs[i]);
      dys.push(ys[i + 1] - ys[i]);
      ms.push(dys[i] / dxs[i]);
    }

    // Calculate tangents using Fritsch-Carlson method
    const tangents = [ms[0]];
    for (let i = 1; i < n - 1; i++) {
      if (ms[i - 1] * ms[i] <= 0) {
        tangents.push(0);
      } else {
        tangents.push(3 * (dxs[i - 1] + dxs[i]) /
          ((2 * dxs[i] + dxs[i - 1]) / ms[i - 1] +
           (dxs[i] + 2 * dxs[i - 1]) / ms[i]));
      }
    }
    tangents.push(ms[n - 2]);

    // Build LUT using cubic Hermite interpolation
    for (let x = 0; x < 256; x++) {
      // Find segment
      let seg = 0;
      for (let i = 0; i < n - 1; i++) {
        if (x >= xs[i] && x <= xs[i + 1]) {
          seg = i;
          break;
        }
        if (x > xs[n - 1]) seg = n - 2;
      }

      // Handle edge cases
      if (x <= xs[0]) {
        lut[x] = Math.max(0, Math.min(255, Math.round(ys[0])));
        continue;
      }
      if (x >= xs[n - 1]) {
        lut[x] = Math.max(0, Math.min(255, Math.round(ys[n - 1])));
        continue;
      }

      // Cubic Hermite interpolation
      const t = (x - xs[seg]) / dxs[seg];
      const t2 = t * t;
      const t3 = t2 * t;

      const h00 = 2 * t3 - 3 * t2 + 1;
      const h10 = t3 - 2 * t2 + t;
      const h01 = -2 * t3 + 3 * t2;
      const h11 = t3 - t2;

      const y = h00 * ys[seg] +
                h10 * dxs[seg] * tangents[seg] +
                h01 * ys[seg + 1] +
                h11 * dxs[seg] * tangents[seg + 1];

      lut[x] = Math.max(0, Math.min(255, Math.round(y)));
    }

    return lut;
  }
}

/**
 * Color Balance Adjustment
 */
export class ColorBalanceAdjustment extends Adjustment {
  constructor(params = {}) {
    super(AdjustmentType.COLOR_BALANCE, params);
  }

  apply(imageData) {
    const { shadows, midtones, highlights, preserveLuminosity } = this.params;
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      // Calculate luminosity for tone detection
      const lum = (r * 0.299 + g * 0.587 + b * 0.114) / 255;

      // Calculate shadow/midtone/highlight weights
      const shadowWeight = 1 - Math.min(1, lum * 4);
      const highlightWeight = Math.max(0, (lum - 0.5) * 2);
      const midtoneWeight = 1 - shadowWeight - highlightWeight;

      // Apply color balance for each tone range
      // Cyan/Red adjustment
      const cyanRed = shadows.cyan * shadowWeight +
                      midtones.cyan * midtoneWeight +
                      highlights.cyan * highlightWeight;
      r += cyanRed * 2.55;
      b -= cyanRed * 0.5;
      g -= cyanRed * 0.5;

      // Magenta/Green adjustment
      const magentaGreen = shadows.magenta * shadowWeight +
                           midtones.magenta * midtoneWeight +
                           highlights.magenta * highlightWeight;
      g += magentaGreen * 2.55;
      r -= magentaGreen * 0.5;
      b -= magentaGreen * 0.5;

      // Yellow/Blue adjustment
      const yellowBlue = shadows.yellow * shadowWeight +
                         midtones.yellow * midtoneWeight +
                         highlights.yellow * highlightWeight;
      b += yellowBlue * 2.55;
      r -= yellowBlue * 0.5;
      g -= yellowBlue * 0.5;

      // Preserve luminosity if enabled
      if (preserveLuminosity) {
        const newLum = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
        if (newLum > 0) {
          const lumRatio = lum / newLum;
          r *= lumRatio;
          g *= lumRatio;
          b *= lumRatio;
        }
      }

      data[i] = Math.max(0, Math.min(255, Math.round(r)));
      data[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
      data[i + 2] = Math.max(0, Math.min(255, Math.round(b)));
    }

    return imageData;
  }
}

/**
 * Black & White Adjustment
 */
export class BlackWhiteAdjustment extends Adjustment {
  constructor(params = {}) {
    super(AdjustmentType.BLACK_WHITE, params);
  }

  apply(imageData) {
    const { reds, yellows, greens, cyans, blues, magentas, tint, tintColor, tintAmount } = this.params;
    const data = imageData.data;

    // Parse tint color
    let tintR = 0, tintG = 0, tintB = 0;
    if (tint && tintColor) {
      const hex = tintColor.replace('#', '');
      tintR = parseInt(hex.substring(0, 2), 16);
      tintG = parseInt(hex.substring(2, 4), 16);
      tintB = parseInt(hex.substring(4, 6), 16);
    }

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;

      // Convert to HSL to determine color
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const l = (max + min) / 2;

      let hue = 0;
      if (max !== min) {
        const d = max - min;
        switch (max) {
          case r: hue = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
          case g: hue = ((b - r) / d + 2) / 6; break;
          case b: hue = ((r - g) / d + 4) / 6; break;
        }
      }
      hue *= 360;

      // Determine which color channel weights to use
      let weight = 0;

      // Red: 330-30
      if (hue >= 330 || hue < 30) {
        weight = reds / 100;
      }
      // Yellow: 30-90
      else if (hue >= 30 && hue < 90) {
        weight = yellows / 100;
      }
      // Green: 90-150
      else if (hue >= 90 && hue < 150) {
        weight = greens / 100;
      }
      // Cyan: 150-210
      else if (hue >= 150 && hue < 210) {
        weight = cyans / 100;
      }
      // Blue: 210-270
      else if (hue >= 210 && hue < 270) {
        weight = blues / 100;
      }
      // Magenta: 270-330
      else {
        weight = magentas / 100;
      }

      // Calculate grayscale with weighted contribution
      const saturation = max === 0 ? 0 : (max - min) / max;
      const baseGray = r * 0.299 + g * 0.587 + b * 0.114;
      let gray = baseGray + (l - baseGray) * weight * saturation;

      gray = Math.max(0, Math.min(1, gray)) * 255;

      // Apply tint if enabled
      if (tint) {
        const tintFactor = tintAmount / 100;
        data[i] = Math.round(gray * (1 - tintFactor) + tintR * (gray / 255) * tintFactor);
        data[i + 1] = Math.round(gray * (1 - tintFactor) + tintG * (gray / 255) * tintFactor);
        data[i + 2] = Math.round(gray * (1 - tintFactor) + tintB * (gray / 255) * tintFactor);
      } else {
        data[i] = Math.round(gray);
        data[i + 1] = Math.round(gray);
        data[i + 2] = Math.round(gray);
      }
    }

    return imageData;
  }
}

/**
 * Photo Filter Adjustment
 */
export class PhotoFilterAdjustment extends Adjustment {
  constructor(params = {}) {
    super(AdjustmentType.PHOTO_FILTER, {
      color: '#ec8a00',  // Warming filter by default
      density: 25,
      preserveLuminosity: true,
      ...params
    });
  }

  apply(imageData) {
    const { color, density, preserveLuminosity } = this.params;
    const data = imageData.data;

    // Parse filter color
    const hex = color.replace('#', '');
    const filterR = parseInt(hex.substring(0, 2), 16);
    const filterG = parseInt(hex.substring(2, 4), 16);
    const filterB = parseInt(hex.substring(4, 6), 16);

    const factor = density / 100;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const origLum = r * 0.299 + g * 0.587 + b * 0.114;

      // Blend with filter color
      let newR = r + (filterR - r) * factor;
      let newG = g + (filterG - g) * factor;
      let newB = b + (filterB - b) * factor;

      if (preserveLuminosity) {
        const newLum = newR * 0.299 + newG * 0.587 + newB * 0.114;
        if (newLum > 0) {
          const ratio = origLum / newLum;
          newR *= ratio;
          newG *= ratio;
          newB *= ratio;
        }
      }

      data[i] = Math.max(0, Math.min(255, Math.round(newR)));
      data[i + 1] = Math.max(0, Math.min(255, Math.round(newG)));
      data[i + 2] = Math.max(0, Math.min(255, Math.round(newB)));
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
    case AdjustmentType.CURVES:
      return new CurvesAdjustment(params);
    case AdjustmentType.HUE_SATURATION:
      return new HueSaturationAdjustment(params);
    case AdjustmentType.COLOR_BALANCE:
      return new ColorBalanceAdjustment(params);
    case AdjustmentType.BLACK_WHITE:
      return new BlackWhiteAdjustment(params);
    case AdjustmentType.INVERT:
      return new InvertAdjustment(params);
    case AdjustmentType.THRESHOLD:
      return new ThresholdAdjustment(params);
    case AdjustmentType.POSTERIZE:
      return new PosterizeAdjustment(params);
    case AdjustmentType.VIBRANCE:
      return new VibranceAdjustment(params);
    case AdjustmentType.PHOTO_FILTER:
      return new PhotoFilterAdjustment(params);
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
