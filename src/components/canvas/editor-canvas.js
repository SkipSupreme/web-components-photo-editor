/**
 * Editor Canvas - Main editing canvas with WebGL2 rendering
 * Handles viewport transformations, pointer events, and rendering
 */

import { getStore } from '../../core/store.js';
import { getEventBus, Events } from '../../core/event-bus.js';

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: block;
      width: 100%;
      height: 100%;
      position: absolute;
      top: 0;
      left: 0;
      overflow: hidden;
    }

    .canvas-wrapper {
      width: 100%;
      height: 100%;
      position: relative;
    }

    canvas {
      position: absolute;
      top: 0;
      left: 0;
      touch-action: none;
    }

    #main-canvas {
      z-index: 1;
    }

    #overlay-canvas {
      z-index: 2;
      pointer-events: none;
    }

    /* Checkerboard background for transparency */
    .checkerboard {
      position: absolute;
      top: 0;
      left: 0;
      z-index: 0;
      background-image:
        linear-gradient(45deg, #404040 25%, transparent 25%),
        linear-gradient(-45deg, #404040 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #404040 75%),
        linear-gradient(-45deg, transparent 75%, #404040 75%);
      background-size: 20px 20px;
      background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
      background-color: #333;
    }
  </style>

  <div class="canvas-wrapper">
    <div class="checkerboard" id="checkerboard"></div>
    <canvas id="main-canvas"></canvas>
    <canvas id="overlay-canvas"></canvas>
  </div>
`;

export class EditorCanvas extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    // Canvas elements
    this.mainCanvas = null;
    this.overlayCanvas = null;
    this.checkerboard = null;

    // Contexts
    this.gl = null;
    this.overlayCtx = null;

    // Viewport state
    this.viewport = {
      zoom: 1,
      panX: 0,
      panY: 0,
      rotation: 0
    };

    // Document dimensions
    this.docWidth = 1920;
    this.docHeight = 1080;

    // Pointer tracking
    this.activePointers = new Map();
    this.isDrawing = false;
    this.isPanning = false;
    this.lastPanPoint = null;

    // Pinch zoom state
    this.initialPinchDistance = 0;
    this.initialPinchZoom = 1;

    this.store = null;
    this.eventBus = null;
    this.unsubscribers = [];

    // Bound methods
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handleWheel = this.handleWheel.bind(this);
    this.handleResize = this.handleResize.bind(this);
  }

  connectedCallback() {
    this.store = getStore();
    this.eventBus = getEventBus();

    this.mainCanvas = this.shadowRoot.getElementById('main-canvas');
    this.overlayCanvas = this.shadowRoot.getElementById('overlay-canvas');
    this.checkerboard = this.shadowRoot.getElementById('checkerboard');

    this.initWebGL();
    this.initOverlay();
    this.setupEventListeners();
    this.subscribeToState();

    // Initial resize
    requestAnimationFrame(() => {
      this.handleResize();
      this.centerDocument();
      this.render();
    });
  }

  disconnectedCallback() {
    this.unsubscribers.forEach(unsub => unsub());
    window.removeEventListener('resize', this.handleResize);
  }

  initWebGL() {
    this.gl = this.mainCanvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
      preserveDrawingBuffer: true
    });

    if (!this.gl) {
      console.error('WebGL2 not supported');
      return;
    }

    const gl = this.gl;

    // Enable blending
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Create shaders
    this.initShaders();
  }

  initShaders() {
    const gl = this.gl;

    // Vertex shader
    const vsSource = `#version 300 es
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

    // Fragment shader with blend modes
    const fsSource = `#version 300 es
      precision highp float;

      in vec2 v_texCoord;

      uniform sampler2D u_texture;
      uniform float u_opacity;

      out vec4 outColor;

      void main() {
        vec4 color = texture(u_texture, v_texCoord);
        outColor = vec4(color.rgb, color.a * u_opacity);
      }
    `;

    // Compile shaders
    const vertexShader = this.compileShader(gl.VERTEX_SHADER, vsSource);
    const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fsSource);

    // Create program
    this.program = gl.createProgram();
    gl.attachShader(this.program, vertexShader);
    gl.attachShader(this.program, fragmentShader);
    gl.linkProgram(this.program);

    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      console.error('Shader program error:', gl.getProgramInfoLog(this.program));
      return;
    }

    // Get locations
    this.locations = {
      position: gl.getAttribLocation(this.program, 'a_position'),
      texCoord: gl.getAttribLocation(this.program, 'a_texCoord'),
      matrix: gl.getUniformLocation(this.program, 'u_matrix'),
      texture: gl.getUniformLocation(this.program, 'u_texture'),
      opacity: gl.getUniformLocation(this.program, 'u_opacity')
    };

    // Create buffers
    this.createBuffers();
  }

  compileShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  createBuffers() {
    const gl = this.gl;

    // Position buffer (quad)
    this.positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      0, 0,
      1, 0,
      0, 1,
      0, 1,
      1, 0,
      1, 1
    ]), gl.STATIC_DRAW);

    // Texture coordinate buffer
    this.texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      0, 0,
      1, 0,
      0, 1,
      0, 1,
      1, 0,
      1, 1
    ]), gl.STATIC_DRAW);

    // Create VAO
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.enableVertexAttribArray(this.locations.position);
    gl.vertexAttribPointer(this.locations.position, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.enableVertexAttribArray(this.locations.texCoord);
    gl.vertexAttribPointer(this.locations.texCoord, 2, gl.FLOAT, false, 0, 0);
  }

  initOverlay() {
    this.overlayCtx = this.overlayCanvas.getContext('2d');
  }

  setupEventListeners() {
    // Pointer events
    this.mainCanvas.addEventListener('pointerdown', this.handlePointerDown);
    this.mainCanvas.addEventListener('pointermove', this.handlePointerMove);
    this.mainCanvas.addEventListener('pointerup', this.handlePointerUp);
    this.mainCanvas.addEventListener('pointerleave', this.handlePointerUp);
    this.mainCanvas.addEventListener('pointercancel', this.handlePointerUp);

    // Wheel for zoom
    this.mainCanvas.addEventListener('wheel', this.handleWheel, { passive: false });

    // Window resize
    window.addEventListener('resize', this.handleResize);

    // Toolbar actions
    this.unsubscribers.push(
      this.eventBus.on('toolbar:zoom-in', () => this.zoomBy(1.25)),
      this.eventBus.on('toolbar:zoom-out', () => this.zoomBy(0.8)),
      this.eventBus.on('toolbar:fit', () => this.fitToScreen())
    );
  }

  subscribeToState() {
    // Update when document changes
    this.unsubscribers.push(
      this.store.subscribe('document', (doc) => {
        if (doc && doc.width && doc.height) {
          this.docWidth = doc.width;
          this.docHeight = doc.height;
          this.updateCheckerboard();
          this.render();
        }
      })
    );

    // Re-render on layer changes
    this.unsubscribers.push(
      this.eventBus.on(Events.LAYER_UPDATED, () => this.render()),
      this.eventBus.on(Events.LAYER_ADDED, () => this.render()),
      this.eventBus.on(Events.LAYER_REMOVED, () => this.render()),
      this.eventBus.on(Events.LAYER_REORDERED, () => this.render()),
      this.eventBus.on(Events.LAYER_VISIBILITY_CHANGED, () => this.render()),
      this.eventBus.on(Events.RENDER_REQUEST, () => this.render())
    );
  }

  handleResize() {
    const rect = this.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Resize main canvas
    this.mainCanvas.width = rect.width * dpr;
    this.mainCanvas.height = rect.height * dpr;
    this.mainCanvas.style.width = `${rect.width}px`;
    this.mainCanvas.style.height = `${rect.height}px`;

    // Resize overlay canvas
    this.overlayCanvas.width = rect.width * dpr;
    this.overlayCanvas.height = rect.height * dpr;
    this.overlayCanvas.style.width = `${rect.width}px`;
    this.overlayCanvas.style.height = `${rect.height}px`;

    // Update WebGL viewport
    if (this.gl) {
      this.gl.viewport(0, 0, this.mainCanvas.width, this.mainCanvas.height);
    }

    this.updateCheckerboard();
    this.render();
  }

  handlePointerDown(e) {
    e.preventDefault();
    this.mainCanvas.setPointerCapture(e.pointerId);
    this.activePointers.set(e.pointerId, e);

    const tool = this.store.state.tools.active;

    if (this.activePointers.size === 2) {
      // Two-finger gesture - start pinch zoom
      this.startPinchZoom();
      this.isDrawing = false;
      return;
    }

    if (tool === 'hand' || e.button === 1 || (e.button === 0 && e.spaceKey)) {
      // Start panning
      this.isPanning = true;
      this.lastPanPoint = { x: e.clientX, y: e.clientY };
      this.mainCanvas.style.cursor = 'grabbing';
      return;
    }

    // Start drawing/tool operation
    this.isDrawing = true;
    const coords = this.screenToDocument(e.clientX, e.clientY);

    this.eventBus.emit(Events.CANVAS_POINTER_DOWN, {
      x: coords.x,
      y: coords.y,
      pressure: e.pressure,
      tiltX: e.tiltX,
      tiltY: e.tiltY,
      pointerType: e.pointerType,
      button: e.button
    });
  }

  handlePointerMove(e) {
    const coords = this.screenToDocument(e.clientX, e.clientY);

    // Always emit position for status bar
    this.eventBus.emit(Events.CANVAS_POINTER_MOVE, {
      x: coords.x,
      y: coords.y,
      pressure: e.pressure
    });

    if (this.activePointers.size === 2) {
      // Update pinch zoom
      this.activePointers.set(e.pointerId, e);
      this.updatePinchZoom();
      return;
    }

    if (this.isPanning) {
      const dx = e.clientX - this.lastPanPoint.x;
      const dy = e.clientY - this.lastPanPoint.y;

      this.viewport.panX += dx;
      this.viewport.panY += dy;

      this.lastPanPoint = { x: e.clientX, y: e.clientY };
      this.updateCheckerboard();
      this.render();

      this.eventBus.emit(Events.VIEWPORT_CHANGED, { ...this.viewport });
      return;
    }

    if (this.isDrawing) {
      // Get coalesced events for smooth strokes
      const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];

      for (const coalescedEvent of events) {
        const coalescedCoords = this.screenToDocument(
          coalescedEvent.clientX,
          coalescedEvent.clientY
        );

        this.eventBus.emit(Events.CANVAS_POINTER_MOVE, {
          x: coalescedCoords.x,
          y: coalescedCoords.y,
          pressure: coalescedEvent.pressure,
          tiltX: coalescedEvent.tiltX,
          tiltY: coalescedEvent.tiltY,
          pointerType: coalescedEvent.pointerType,
          isCoalesced: true
        });
      }
    }
  }

  handlePointerUp(e) {
    this.activePointers.delete(e.pointerId);

    if (this.isPanning) {
      this.isPanning = false;
      this.mainCanvas.style.cursor = '';
      return;
    }

    if (this.isDrawing) {
      this.isDrawing = false;
      const coords = this.screenToDocument(e.clientX, e.clientY);

      this.eventBus.emit(Events.CANVAS_POINTER_UP, {
        x: coords.x,
        y: coords.y,
        pressure: e.pressure
      });
    }
  }

  handleWheel(e) {
    e.preventDefault();

    if (e.ctrlKey || e.metaKey) {
      // Zoom
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      this.zoomAt(e.clientX, e.clientY, delta);
    } else {
      // Pan
      this.viewport.panX -= e.deltaX;
      this.viewport.panY -= e.deltaY;
      this.updateCheckerboard();
      this.render();
      this.eventBus.emit(Events.VIEWPORT_CHANGED, { ...this.viewport });
    }
  }

  startPinchZoom() {
    const pointers = Array.from(this.activePointers.values());
    if (pointers.length < 2) return;

    const dx = pointers[1].clientX - pointers[0].clientX;
    const dy = pointers[1].clientY - pointers[0].clientY;
    this.initialPinchDistance = Math.sqrt(dx * dx + dy * dy);
    this.initialPinchZoom = this.viewport.zoom;
  }

  updatePinchZoom() {
    const pointers = Array.from(this.activePointers.values());
    if (pointers.length < 2) return;

    const dx = pointers[1].clientX - pointers[0].clientX;
    const dy = pointers[1].clientY - pointers[0].clientY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const scale = distance / this.initialPinchDistance;
    this.viewport.zoom = Math.max(0.1, Math.min(32, this.initialPinchZoom * scale));

    this.updateCheckerboard();
    this.render();
    this.eventBus.emit(Events.VIEWPORT_CHANGED, { ...this.viewport });
  }

  screenToDocument(screenX, screenY) {
    const rect = this.mainCanvas.getBoundingClientRect();
    const canvasX = screenX - rect.left;
    const canvasY = screenY - rect.top;

    // Reverse viewport transform
    const docX = (canvasX - this.viewport.panX) / this.viewport.zoom;
    const docY = (canvasY - this.viewport.panY) / this.viewport.zoom;

    return { x: docX, y: docY };
  }

  documentToScreen(docX, docY) {
    const screenX = docX * this.viewport.zoom + this.viewport.panX;
    const screenY = docY * this.viewport.zoom + this.viewport.panY;
    return { x: screenX, y: screenY };
  }

  zoomBy(factor) {
    const rect = this.mainCanvas.getBoundingClientRect();
    this.zoomAt(rect.width / 2, rect.height / 2, factor);
  }

  zoomAt(screenX, screenY, factor) {
    const rect = this.mainCanvas.getBoundingClientRect();
    const canvasX = screenX - rect.left;
    const canvasY = screenY - rect.top;

    // Zoom centered on pointer position
    const newZoom = Math.max(0.1, Math.min(32, this.viewport.zoom * factor));
    const zoomDelta = newZoom / this.viewport.zoom;

    this.viewport.panX = canvasX - (canvasX - this.viewport.panX) * zoomDelta;
    this.viewport.panY = canvasY - (canvasY - this.viewport.panY) * zoomDelta;
    this.viewport.zoom = newZoom;

    this.updateCheckerboard();
    this.render();
    this.eventBus.emit(Events.VIEWPORT_CHANGED, { ...this.viewport });
  }

  fitToScreen() {
    const rect = this.mainCanvas.getBoundingClientRect();
    const padding = 40;

    const scaleX = (rect.width - padding * 2) / this.docWidth;
    const scaleY = (rect.height - padding * 2) / this.docHeight;
    this.viewport.zoom = Math.min(scaleX, scaleY, 1);

    this.centerDocument();
    this.updateCheckerboard();
    this.render();
    this.eventBus.emit(Events.VIEWPORT_CHANGED, { ...this.viewport });
  }

  centerDocument() {
    const rect = this.mainCanvas.getBoundingClientRect();
    const scaledWidth = this.docWidth * this.viewport.zoom;
    const scaledHeight = this.docHeight * this.viewport.zoom;

    this.viewport.panX = (rect.width - scaledWidth) / 2;
    this.viewport.panY = (rect.height - scaledHeight) / 2;
  }

  updateCheckerboard() {
    const { panX, panY, zoom } = this.viewport;
    const scaledWidth = this.docWidth * zoom;
    const scaledHeight = this.docHeight * zoom;

    this.checkerboard.style.left = `${panX}px`;
    this.checkerboard.style.top = `${panY}px`;
    this.checkerboard.style.width = `${scaledWidth}px`;
    this.checkerboard.style.height = `${scaledHeight}px`;
  }

  render() {
    if (!this.gl) return;

    const gl = this.gl;

    // Clear
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Get current document from app
    const app = window.photoEditorApp;
    if (!app || !app.document) return;

    // Use program
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    // Check if document has any clipping masks or layer masks that need compositing
    const hasClippingOrMasks = app.document.layers.some(l =>
      l.clipped || (l.mask && l.maskEnabled)
    );

    if (hasClippingOrMasks) {
      // Use composited canvas for proper mask/clipping support
      const compositedCanvas = app.document.getCompositedCanvas(false);
      this.renderComposited(compositedCanvas);
    } else {
      // Fast path: render layers directly
      for (const layer of app.document.layers) {
        if (!layer.visible || !layer.canvas) continue;
        this.renderLayer(layer);
      }
    }
  }

  /**
   * Render a pre-composited canvas (for documents with masks/clipping)
   */
  renderComposited(canvas) {
    const gl = this.gl;

    // Create or update texture for composited output
    if (!this._compositedTexture) {
      this._compositedTexture = gl.createTexture();
    }

    gl.bindTexture(gl.TEXTURE_2D, this._compositedTexture);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA,
      gl.RGBA, gl.UNSIGNED_BYTE, canvas
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Create a virtual layer for the composited output
    const virtualLayer = {
      x: 0,
      y: 0,
      width: canvas.width,
      height: canvas.height,
      opacity: 1
    };

    // Calculate transform matrix
    const matrix = this.createTransformMatrix(virtualLayer);

    // Set uniforms
    gl.uniformMatrix3fv(this.locations.matrix, false, matrix);
    gl.uniform1f(this.locations.opacity, 1);
    gl.uniform1i(this.locations.texture, 0);

    // Draw
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  renderLayer(layer) {
    const gl = this.gl;

    // Create or update texture
    if (!layer._glTexture) {
      layer._glTexture = gl.createTexture();
    }

    gl.bindTexture(gl.TEXTURE_2D, layer._glTexture);

    if (layer.dirty) {
      gl.texImage2D(
        gl.TEXTURE_2D, 0, gl.RGBA,
        gl.RGBA, gl.UNSIGNED_BYTE, layer.canvas
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      layer.dirty = false;
    }

    // Calculate transform matrix
    const matrix = this.createTransformMatrix(layer);

    // Set uniforms
    gl.uniformMatrix3fv(this.locations.matrix, false, matrix);
    gl.uniform1f(this.locations.opacity, layer.opacity);
    gl.uniform1i(this.locations.texture, 0);

    // Draw
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  createTransformMatrix(layer) {
    const canvasWidth = this.mainCanvas.width;
    const canvasHeight = this.mainCanvas.height;
    const dpr = window.devicePixelRatio || 1;

    const { zoom, panX, panY } = this.viewport;

    // Transform: scale by layer size, apply zoom, pan, then convert to clip space
    const scaleX = (layer.width * zoom * dpr) / canvasWidth * 2;
    const scaleY = (layer.height * zoom * dpr) / canvasHeight * 2;

    const translateX = ((layer.x * zoom + panX) * dpr / canvasWidth) * 2 - 1;
    const translateY = 1 - ((layer.y * zoom + panY) * dpr / canvasHeight) * 2 - scaleY;

    // Column-major matrix
    return new Float32Array([
      scaleX, 0, 0,
      0, -scaleY, 0,
      translateX, translateY + scaleY, 1
    ]);
  }

  /**
   * Draw to the active layer at document coordinates
   */
  drawToLayer(x, y, size, color, opacity = 1, hardness = 1) {
    const app = window.photoEditorApp;
    if (!app || !app.document) return;

    const layer = app.document.getActiveLayer();
    if (!layer || !layer.ctx) return;

    const ctx = layer.ctx;

    // Create brush stamp
    const radius = size / 2;

    if (hardness >= 1) {
      // Hard brush
      ctx.globalAlpha = opacity;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Soft brush with gradient
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, color);
      gradient.addColorStop(hardness, color);
      gradient.addColorStop(1, 'transparent');

      ctx.globalAlpha = opacity;
      ctx.fillStyle = gradient;
      ctx.fillRect(x - radius, y - radius, size, size);
    }

    ctx.globalAlpha = 1;
    layer.dirty = true;
  }
}

customElements.define('editor-canvas', EditorCanvas);
