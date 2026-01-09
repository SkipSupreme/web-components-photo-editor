/**
 * WebGL Blend Mode Shaders
 * Implements all Photoshop blend modes as GLSL fragment shaders
 */

// Blend mode constants (match Photoshop order)
export const BlendMode = {
  NORMAL: 0,
  DISSOLVE: 1,
  DARKEN: 2,
  MULTIPLY: 3,
  COLOR_BURN: 4,
  LINEAR_BURN: 5,
  LIGHTEN: 6,
  SCREEN: 7,
  COLOR_DODGE: 8,
  LINEAR_DODGE: 9,
  OVERLAY: 10,
  SOFT_LIGHT: 11,
  HARD_LIGHT: 12,
  VIVID_LIGHT: 13,
  LINEAR_LIGHT: 14,
  PIN_LIGHT: 15,
  HARD_MIX: 16,
  DIFFERENCE: 17,
  EXCLUSION: 18,
  SUBTRACT: 19,
  DIVIDE: 20,
  HUE: 21,
  SATURATION: 22,
  COLOR: 23,
  LUMINOSITY: 24
};

// Human-readable names
export const BlendModeNames = {
  [BlendMode.NORMAL]: 'Normal',
  [BlendMode.DISSOLVE]: 'Dissolve',
  [BlendMode.DARKEN]: 'Darken',
  [BlendMode.MULTIPLY]: 'Multiply',
  [BlendMode.COLOR_BURN]: 'Color Burn',
  [BlendMode.LINEAR_BURN]: 'Linear Burn',
  [BlendMode.LIGHTEN]: 'Lighten',
  [BlendMode.SCREEN]: 'Screen',
  [BlendMode.COLOR_DODGE]: 'Color Dodge',
  [BlendMode.LINEAR_DODGE]: 'Linear Dodge (Add)',
  [BlendMode.OVERLAY]: 'Overlay',
  [BlendMode.SOFT_LIGHT]: 'Soft Light',
  [BlendMode.HARD_LIGHT]: 'Hard Light',
  [BlendMode.VIVID_LIGHT]: 'Vivid Light',
  [BlendMode.LINEAR_LIGHT]: 'Linear Light',
  [BlendMode.PIN_LIGHT]: 'Pin Light',
  [BlendMode.HARD_MIX]: 'Hard Mix',
  [BlendMode.DIFFERENCE]: 'Difference',
  [BlendMode.EXCLUSION]: 'Exclusion',
  [BlendMode.SUBTRACT]: 'Subtract',
  [BlendMode.DIVIDE]: 'Divide',
  [BlendMode.HUE]: 'Hue',
  [BlendMode.SATURATION]: 'Saturation',
  [BlendMode.COLOR]: 'Color',
  [BlendMode.LUMINOSITY]: 'Luminosity'
};

// Vertex shader for compositing
export const compositeVertexShader = `#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_texCoord;

uniform mat3 u_matrix;

out vec2 v_texCoord;

void main() {
  vec3 position = u_matrix * vec3(a_position, 1.0);
  gl_Position = vec4(position.xy, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
`;

// Fragment shader with all blend modes
export const compositeFragmentShader = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_baseTexture;   // Layer below (destination)
uniform sampler2D u_blendTexture;  // Current layer (source)
uniform float u_opacity;
uniform int u_blendMode;
uniform bool u_hasMask;
uniform sampler2D u_maskTexture;

out vec4 outColor;

// ============ Helper Functions ============

vec3 rgb2hsl(vec3 c) {
  float maxC = max(max(c.r, c.g), c.b);
  float minC = min(min(c.r, c.g), c.b);
  float l = (maxC + minC) / 2.0;

  if (maxC == minC) {
    return vec3(0.0, 0.0, l);
  }

  float d = maxC - minC;
  float s = l > 0.5 ? d / (2.0 - maxC - minC) : d / (maxC + minC);
  float h;

  if (maxC == c.r) {
    h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
  } else if (maxC == c.g) {
    h = (c.b - c.r) / d + 2.0;
  } else {
    h = (c.r - c.g) / d + 4.0;
  }
  h /= 6.0;

  return vec3(h, s, l);
}

float hue2rgb(float p, float q, float t) {
  if (t < 0.0) t += 1.0;
  if (t > 1.0) t -= 1.0;
  if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
  if (t < 1.0/2.0) return q;
  if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
  return p;
}

vec3 hsl2rgb(vec3 c) {
  if (c.y == 0.0) {
    return vec3(c.z);
  }

  float q = c.z < 0.5 ? c.z * (1.0 + c.y) : c.z + c.y - c.z * c.y;
  float p = 2.0 * c.z - q;

  return vec3(
    hue2rgb(p, q, c.x + 1.0/3.0),
    hue2rgb(p, q, c.x),
    hue2rgb(p, q, c.x - 1.0/3.0)
  );
}

float lum(vec3 c) {
  return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
}

vec3 setLum(vec3 c, float l) {
  float d = l - lum(c);
  return c + vec3(d);
}

float sat(vec3 c) {
  return max(max(c.r, c.g), c.b) - min(min(c.r, c.g), c.b);
}

vec3 setSat(vec3 c, float s) {
  float cMin = min(min(c.r, c.g), c.b);
  float cMax = max(max(c.r, c.g), c.b);

  if (cMax == cMin) {
    return vec3(0.0);
  }

  return (c - cMin) * s / (cMax - cMin);
}

vec3 clipColor(vec3 c) {
  float l = lum(c);
  float n = min(min(c.r, c.g), c.b);
  float x = max(max(c.r, c.g), c.b);

  if (n < 0.0) {
    c = l + (c - l) * l / (l - n);
  }
  if (x > 1.0) {
    c = l + (c - l) * (1.0 - l) / (x - l);
  }

  return c;
}

// ============ Blend Mode Functions ============

vec3 blendNormal(vec3 base, vec3 blend) {
  return blend;
}

vec3 blendMultiply(vec3 base, vec3 blend) {
  return base * blend;
}

vec3 blendScreen(vec3 base, vec3 blend) {
  return 1.0 - (1.0 - base) * (1.0 - blend);
}

vec3 blendOverlay(vec3 base, vec3 blend) {
  return mix(
    2.0 * base * blend,
    1.0 - 2.0 * (1.0 - base) * (1.0 - blend),
    step(0.5, base)
  );
}

vec3 blendDarken(vec3 base, vec3 blend) {
  return min(base, blend);
}

vec3 blendLighten(vec3 base, vec3 blend) {
  return max(base, blend);
}

vec3 blendColorDodge(vec3 base, vec3 blend) {
  return mix(
    min(vec3(1.0), base / (1.0 - blend + 0.001)),
    vec3(1.0),
    step(1.0, blend)
  );
}

vec3 blendColorBurn(vec3 base, vec3 blend) {
  return mix(
    1.0 - min(vec3(1.0), (1.0 - base) / (blend + 0.001)),
    vec3(0.0),
    step(blend, vec3(0.0))
  );
}

vec3 blendLinearDodge(vec3 base, vec3 blend) {
  return min(base + blend, vec3(1.0));
}

vec3 blendLinearBurn(vec3 base, vec3 blend) {
  return max(base + blend - 1.0, vec3(0.0));
}

vec3 blendHardLight(vec3 base, vec3 blend) {
  return blendOverlay(blend, base);
}

vec3 blendSoftLight(vec3 base, vec3 blend) {
  vec3 d = mix(
    sqrt(base),
    ((16.0 * base - 12.0) * base + 4.0) * base,
    step(0.25, base)
  );
  return mix(
    base - (1.0 - 2.0 * blend) * base * (1.0 - base),
    base + (2.0 * blend - 1.0) * (d - base),
    step(0.5, blend)
  );
}

vec3 blendVividLight(vec3 base, vec3 blend) {
  return mix(
    blendColorBurn(base, 2.0 * blend),
    blendColorDodge(base, 2.0 * (blend - 0.5)),
    step(0.5, blend)
  );
}

vec3 blendLinearLight(vec3 base, vec3 blend) {
  return mix(
    blendLinearBurn(base, 2.0 * blend),
    blendLinearDodge(base, 2.0 * (blend - 0.5)),
    step(0.5, blend)
  );
}

vec3 blendPinLight(vec3 base, vec3 blend) {
  return mix(
    blendDarken(base, 2.0 * blend),
    blendLighten(base, 2.0 * (blend - 0.5)),
    step(0.5, blend)
  );
}

vec3 blendHardMix(vec3 base, vec3 blend) {
  return step(1.0, base + blend);
}

vec3 blendDifference(vec3 base, vec3 blend) {
  return abs(base - blend);
}

vec3 blendExclusion(vec3 base, vec3 blend) {
  return base + blend - 2.0 * base * blend;
}

vec3 blendSubtract(vec3 base, vec3 blend) {
  return max(base - blend, vec3(0.0));
}

vec3 blendDivide(vec3 base, vec3 blend) {
  return base / (blend + 0.001);
}

vec3 blendHue(vec3 base, vec3 blend) {
  vec3 baseHSL = rgb2hsl(base);
  vec3 blendHSL = rgb2hsl(blend);
  return hsl2rgb(vec3(blendHSL.x, baseHSL.y, baseHSL.z));
}

vec3 blendSaturation(vec3 base, vec3 blend) {
  vec3 baseHSL = rgb2hsl(base);
  vec3 blendHSL = rgb2hsl(blend);
  return hsl2rgb(vec3(baseHSL.x, blendHSL.y, baseHSL.z));
}

vec3 blendColor(vec3 base, vec3 blend) {
  vec3 baseHSL = rgb2hsl(base);
  vec3 blendHSL = rgb2hsl(blend);
  return hsl2rgb(vec3(blendHSL.x, blendHSL.y, baseHSL.z));
}

vec3 blendLuminosity(vec3 base, vec3 blend) {
  vec3 baseHSL = rgb2hsl(base);
  vec3 blendHSL = rgb2hsl(blend);
  return hsl2rgb(vec3(baseHSL.x, baseHSL.y, blendHSL.z));
}

// ============ Main Blend Function ============

vec3 blend(vec3 base, vec3 blend, int mode) {
  if (mode == 0) return blendNormal(base, blend);       // Normal
  if (mode == 1) return blendNormal(base, blend);       // Dissolve (handled separately)
  if (mode == 2) return blendDarken(base, blend);       // Darken
  if (mode == 3) return blendMultiply(base, blend);     // Multiply
  if (mode == 4) return blendColorBurn(base, blend);    // Color Burn
  if (mode == 5) return blendLinearBurn(base, blend);   // Linear Burn
  if (mode == 6) return blendLighten(base, blend);      // Lighten
  if (mode == 7) return blendScreen(base, blend);       // Screen
  if (mode == 8) return blendColorDodge(base, blend);   // Color Dodge
  if (mode == 9) return blendLinearDodge(base, blend);  // Linear Dodge
  if (mode == 10) return blendOverlay(base, blend);     // Overlay
  if (mode == 11) return blendSoftLight(base, blend);   // Soft Light
  if (mode == 12) return blendHardLight(base, blend);   // Hard Light
  if (mode == 13) return blendVividLight(base, blend);  // Vivid Light
  if (mode == 14) return blendLinearLight(base, blend); // Linear Light
  if (mode == 15) return blendPinLight(base, blend);    // Pin Light
  if (mode == 16) return blendHardMix(base, blend);     // Hard Mix
  if (mode == 17) return blendDifference(base, blend);  // Difference
  if (mode == 18) return blendExclusion(base, blend);   // Exclusion
  if (mode == 19) return blendSubtract(base, blend);    // Subtract
  if (mode == 20) return blendDivide(base, blend);      // Divide
  if (mode == 21) return blendHue(base, blend);         // Hue
  if (mode == 22) return blendSaturation(base, blend);  // Saturation
  if (mode == 23) return blendColor(base, blend);       // Color
  if (mode == 24) return blendLuminosity(base, blend);  // Luminosity
  return blend;
}

void main() {
  vec4 baseColor = texture(u_baseTexture, v_texCoord);
  vec4 blendColor = texture(u_blendTexture, v_texCoord);

  // Apply mask if present
  float maskAlpha = 1.0;
  if (u_hasMask) {
    maskAlpha = texture(u_maskTexture, v_texCoord).r;
  }

  // Calculate effective alpha
  float alpha = blendColor.a * u_opacity * maskAlpha;

  // Handle dissolve mode (random transparency based on alpha)
  if (u_blendMode == 1) {
    float noise = fract(sin(dot(v_texCoord, vec2(12.9898, 78.233))) * 43758.5453);
    if (noise > alpha) {
      outColor = baseColor;
      return;
    }
    alpha = 1.0;
  }

  // Apply blend mode
  vec3 blended = blend(baseColor.rgb, blendColor.rgb, u_blendMode);

  // Composite with alpha
  vec3 result = mix(baseColor.rgb, blended, alpha);
  float resultAlpha = baseColor.a + alpha * (1.0 - baseColor.a);

  outColor = vec4(result, resultAlpha);
}
`;

/**
 * Simple pass-through shader for displaying final result
 */
export const displayVertexShader = `#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_texCoord;

out vec2 v_texCoord;

void main() {
  gl_Position = vec4(a_position * 2.0 - 1.0, 0.0, 1.0);
  v_texCoord = vec2(a_texCoord.x, 1.0 - a_texCoord.y);
}
`;

export const displayFragmentShader = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_texture;

out vec4 outColor;

void main() {
  outColor = texture(u_texture, v_texCoord);
}
`;

/**
 * Map CSS blend mode names to our blend mode constants
 */
export function cssBlendModeToConstant(cssBlendMode) {
  const map = {
    'normal': BlendMode.NORMAL,
    'multiply': BlendMode.MULTIPLY,
    'screen': BlendMode.SCREEN,
    'overlay': BlendMode.OVERLAY,
    'darken': BlendMode.DARKEN,
    'lighten': BlendMode.LIGHTEN,
    'color-dodge': BlendMode.COLOR_DODGE,
    'color-burn': BlendMode.COLOR_BURN,
    'hard-light': BlendMode.HARD_LIGHT,
    'soft-light': BlendMode.SOFT_LIGHT,
    'difference': BlendMode.DIFFERENCE,
    'exclusion': BlendMode.EXCLUSION,
    'hue': BlendMode.HUE,
    'saturation': BlendMode.SATURATION,
    'color': BlendMode.COLOR,
    'luminosity': BlendMode.LUMINOSITY
  };
  return map[cssBlendMode] ?? BlendMode.NORMAL;
}

/**
 * Get blend mode groups for UI
 */
export function getBlendModeGroups() {
  return [
    {
      name: 'Normal',
      modes: [BlendMode.NORMAL, BlendMode.DISSOLVE]
    },
    {
      name: 'Darken',
      modes: [BlendMode.DARKEN, BlendMode.MULTIPLY, BlendMode.COLOR_BURN, BlendMode.LINEAR_BURN]
    },
    {
      name: 'Lighten',
      modes: [BlendMode.LIGHTEN, BlendMode.SCREEN, BlendMode.COLOR_DODGE, BlendMode.LINEAR_DODGE]
    },
    {
      name: 'Contrast',
      modes: [BlendMode.OVERLAY, BlendMode.SOFT_LIGHT, BlendMode.HARD_LIGHT, BlendMode.VIVID_LIGHT, BlendMode.LINEAR_LIGHT, BlendMode.PIN_LIGHT, BlendMode.HARD_MIX]
    },
    {
      name: 'Inversion',
      modes: [BlendMode.DIFFERENCE, BlendMode.EXCLUSION, BlendMode.SUBTRACT, BlendMode.DIVIDE]
    },
    {
      name: 'Component',
      modes: [BlendMode.HUE, BlendMode.SATURATION, BlendMode.COLOR, BlendMode.LUMINOSITY]
    }
  ];
}
