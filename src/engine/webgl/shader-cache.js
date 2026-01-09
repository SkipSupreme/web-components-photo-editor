/**
 * Shader Cache - Optimized WebGL shader compilation and caching
 * Compiles shaders once and reuses them across the application
 */

/**
 * Compiled shader program wrapper
 */
class ShaderProgram {
  constructor(gl, program, uniforms, attributes) {
    this.gl = gl;
    this.program = program;
    this.uniforms = uniforms;
    this.attributes = attributes;
    this.lastUsed = performance.now();
  }

  /**
   * Use this shader program
   */
  use() {
    this.gl.useProgram(this.program);
    this.lastUsed = performance.now();
  }

  /**
   * Set uniform value
   */
  setUniform(name, value) {
    const location = this.uniforms[name];
    if (!location) return;

    const gl = this.gl;

    if (typeof value === 'number') {
      gl.uniform1f(location, value);
    } else if (Array.isArray(value)) {
      switch (value.length) {
        case 2:
          gl.uniform2fv(location, value);
          break;
        case 3:
          gl.uniform3fv(location, value);
          break;
        case 4:
          gl.uniform4fv(location, value);
          break;
        case 9:
          gl.uniformMatrix3fv(location, false, value);
          break;
        case 16:
          gl.uniformMatrix4fv(location, false, value);
          break;
      }
    } else if (value instanceof Float32Array) {
      if (value.length === 16) {
        gl.uniformMatrix4fv(location, false, value);
      } else if (value.length === 9) {
        gl.uniformMatrix3fv(location, false, value);
      } else {
        gl.uniform1fv(location, value);
      }
    }
  }

  /**
   * Set integer uniform
   */
  setUniformInt(name, value) {
    const location = this.uniforms[name];
    if (location) {
      this.gl.uniform1i(location, value);
    }
  }

  /**
   * Bind a texture to a uniform
   */
  setTexture(name, texture, unit = 0) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    this.setUniformInt(name, unit);
  }

  /**
   * Dispose of shader program
   */
  dispose() {
    if (this.program) {
      this.gl.deleteProgram(this.program);
      this.program = null;
    }
  }
}

/**
 * Shader Cache - Compiles and caches shader programs
 */
export class ShaderCache {
  constructor(gl) {
    this.gl = gl;
    this.programs = new Map();
    this.shaderSources = new Map();
    this.compiledShaders = new Map();
  }

  /**
   * Register shader source code
   */
  registerShader(name, source, type) {
    this.shaderSources.set(`${name}:${type}`, { source, type });
  }

  /**
   * Compile a shader from source
   */
  compileShader(source, type) {
    const gl = this.gl;
    const shader = gl.createShader(type);

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const error = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader compilation failed: ${error}`);
    }

    return shader;
  }

  /**
   * Get or compile a shader
   */
  getShader(name, source, type) {
    const key = `${name}:${type}`;

    if (this.compiledShaders.has(key)) {
      return this.compiledShaders.get(key);
    }

    const shader = this.compileShader(source, type);
    this.compiledShaders.set(key, shader);
    return shader;
  }

  /**
   * Create or get a shader program
   */
  getProgram(name, vertexSource, fragmentSource, uniformNames = [], attributeNames = []) {
    if (this.programs.has(name)) {
      return this.programs.get(name);
    }

    const gl = this.gl;

    // Compile shaders
    const vertexShader = this.getShader(`${name}_vert`, vertexSource, gl.VERTEX_SHADER);
    const fragmentShader = this.getShader(`${name}_frag`, fragmentSource, gl.FRAGMENT_SHADER);

    // Create program
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const error = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`Shader program linking failed: ${error}`);
    }

    // Get uniform locations
    const uniforms = {};
    for (const uniformName of uniformNames) {
      uniforms[uniformName] = gl.getUniformLocation(program, uniformName);
    }

    // Get attribute locations
    const attributes = {};
    for (const attrName of attributeNames) {
      attributes[attrName] = gl.getAttribLocation(program, attrName);
    }

    const shaderProgram = new ShaderProgram(gl, program, uniforms, attributes);
    this.programs.set(name, shaderProgram);

    return shaderProgram;
  }

  /**
   * Get a program if it exists
   */
  hasProgram(name) {
    return this.programs.has(name);
  }

  /**
   * Remove a program from cache
   */
  removeProgram(name) {
    const program = this.programs.get(name);
    if (program) {
      program.dispose();
      this.programs.delete(name);
    }
  }

  /**
   * Clear all cached shaders and programs
   */
  clear() {
    for (const program of this.programs.values()) {
      program.dispose();
    }
    this.programs.clear();

    for (const shader of this.compiledShaders.values()) {
      this.gl.deleteShader(shader);
    }
    this.compiledShaders.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      programs: this.programs.size,
      compiledShaders: this.compiledShaders.size,
      sourcesRegistered: this.shaderSources.size
    };
  }
}

// Common shader sources
export const CommonShaders = {
  // Simple vertex shader for full-screen quad
  QUAD_VERTEX: `
    attribute vec2 a_position;
    attribute vec2 a_texCoord;
    varying vec2 v_texCoord;

    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
      v_texCoord = a_texCoord;
    }
  `,

  // Simple texture copy
  COPY_FRAGMENT: `
    precision mediump float;
    varying vec2 v_texCoord;
    uniform sampler2D u_texture;

    void main() {
      gl_FragColor = texture2D(u_texture, v_texCoord);
    }
  `,

  // Blend two textures
  BLEND_FRAGMENT: `
    precision mediump float;
    varying vec2 v_texCoord;
    uniform sampler2D u_base;
    uniform sampler2D u_blend;
    uniform float u_opacity;
    uniform int u_blendMode;

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

    void main() {
      vec4 baseColor = texture2D(u_base, v_texCoord);
      vec4 blendColor = texture2D(u_blend, v_texCoord);

      vec3 result;
      if (u_blendMode == 0) result = blendNormal(baseColor.rgb, blendColor.rgb);
      else if (u_blendMode == 1) result = blendMultiply(baseColor.rgb, blendColor.rgb);
      else if (u_blendMode == 2) result = blendScreen(baseColor.rgb, blendColor.rgb);
      else if (u_blendMode == 3) result = blendOverlay(baseColor.rgb, blendColor.rgb);
      else result = blendColor.rgb;

      float alpha = blendColor.a * u_opacity;
      gl_FragColor = vec4(
        mix(baseColor.rgb, result, alpha),
        baseColor.a + alpha * (1.0 - baseColor.a)
      );
    }
  `
};

// Singleton instance
let cacheInstance = null;

/**
 * Initialize shader cache with WebGL context
 */
export function initShaderCache(gl) {
  if (cacheInstance) {
    cacheInstance.clear();
  }
  cacheInstance = new ShaderCache(gl);
  return cacheInstance;
}

/**
 * Get the global shader cache instance
 */
export function getShaderCache() {
  return cacheInstance;
}

/**
 * Dispose of the shader cache
 */
export function disposeShaderCache() {
  if (cacheInstance) {
    cacheInstance.clear();
    cacheInstance = null;
  }
}
