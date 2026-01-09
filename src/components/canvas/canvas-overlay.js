/**
 * Canvas Overlay - Renders selection marching ants, guides, rulers, and tool previews
 */

import { getStore } from '../../core/store.js';
import { getEventBus, Events } from '../../core/event-bus.js';

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: block;
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 10;
    }

    canvas {
      width: 100%;
      height: 100%;
    }
  </style>
  <canvas id="overlay-canvas"></canvas>
`;

export class CanvasOverlay extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this.canvas = null;
    this.ctx = null;

    this.store = null;
    this.eventBus = null;
    this.unsubscribers = [];

    // Viewport state (synced from editor-canvas)
    this.viewport = {
      zoom: 1,
      panX: 0,
      panY: 0
    };

    // Marching ants animation
    this.marchingAntsOffset = 0;
    this.animationFrameId = null;

    // Selection preview state
    this.selectionPreview = null;

    // Transform handles state
    this.transformHandles = null;

    // Bound methods
    this.handleResize = this.handleResize.bind(this);
    this.animate = this.animate.bind(this);
  }

  connectedCallback() {
    this.store = getStore();
    this.eventBus = getEventBus();
    this.canvas = this.shadowRoot.getElementById('overlay-canvas');
    this.ctx = this.canvas.getContext('2d');

    this.setupEventListeners();

    requestAnimationFrame(() => {
      this.handleResize();
      this.startAnimation();
    });
  }

  disconnectedCallback() {
    this.unsubscribers.forEach(unsub => unsub());
    window.removeEventListener('resize', this.handleResize);
    this.stopAnimation();
  }

  setupEventListeners() {
    window.addEventListener('resize', this.handleResize);

    // Viewport changes
    this.unsubscribers.push(
      this.eventBus.on(Events.VIEWPORT_CHANGED, (viewport) => {
        this.viewport = viewport;
      })
    );

    // Selection changes
    this.unsubscribers.push(
      this.eventBus.on(Events.SELECTION_CHANGED, () => this.render()),
      this.eventBus.on(Events.SELECTION_CLEARED, () => this.render())
    );

    // Selection preview (while dragging)
    this.unsubscribers.push(
      this.eventBus.on(Events.SELECTION_PREVIEW_START, (data) => {
        this.selectionPreview = data;
      }),
      this.eventBus.on(Events.SELECTION_PREVIEW_UPDATE, (data) => {
        this.selectionPreview = { ...this.selectionPreview, ...data };
      }),
      this.eventBus.on(Events.SELECTION_PREVIEW_END, () => {
        this.selectionPreview = null;
      })
    );

    // Transform handles
    this.unsubscribers.push(
      this.eventBus.on(Events.TRANSFORM_START, (data) => {
        this.transformHandles = data;
      }),
      this.eventBus.on(Events.TRANSFORM_UPDATE, (data) => {
        this.transformHandles = data;
      }),
      this.eventBus.on(Events.TRANSFORM_END, () => {
        this.transformHandles = null;
      })
    );

    // Render request
    this.unsubscribers.push(
      this.eventBus.on(Events.RENDER_REQUEST, () => {
        // Will be rendered on next animation frame
      })
    );
  }

  handleResize() {
    const rect = this.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;

    this.ctx.scale(dpr, dpr);
  }

  startAnimation() {
    this.animationFrameId = requestAnimationFrame(this.animate);
  }

  stopAnimation() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  animate() {
    this.marchingAntsOffset = (this.marchingAntsOffset + 0.5) % 16;
    this.render();
    this.animationFrameId = requestAnimationFrame(this.animate);
  }

  render() {
    const ctx = this.ctx;
    const { width, height } = this.canvas;
    const dpr = window.devicePixelRatio || 1;

    // Clear
    ctx.clearRect(0, 0, width / dpr, height / dpr);

    // Draw selection preview (while dragging)
    if (this.selectionPreview) {
      this.drawSelectionPreview(ctx);
    }

    // Draw marching ants for active selection
    const app = window.photoEditorApp;
    if (app?.selection?.hasSelection()) {
      this.drawMarchingAnts(ctx, app.selection);
    }

    // Draw transform handles
    if (this.transformHandles) {
      this.drawTransformHandles(ctx);
    }
  }

  /**
   * Draw selection preview (rectangle, ellipse, or path)
   */
  drawSelectionPreview(ctx) {
    const preview = this.selectionPreview;
    const { zoom, panX, panY } = this.viewport;

    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.lineDashOffset = -this.marchingAntsOffset;

    if (preview.shape === 'rectangle' && preview.bounds) {
      const { x, y, width, height } = preview.bounds;
      const sx = x * zoom + panX;
      const sy = y * zoom + panY;
      const sw = width * zoom;
      const sh = height * zoom;

      ctx.strokeRect(sx, sy, sw, sh);

      // Draw inverted dashes
      ctx.strokeStyle = '#000000';
      ctx.lineDashOffset = -this.marchingAntsOffset + 5;
      ctx.strokeRect(sx, sy, sw, sh);

    } else if (preview.shape === 'ellipse' && preview.bounds) {
      const { x, y, width, height } = preview.bounds;
      const cx = (x + width / 2) * zoom + panX;
      const cy = (y + height / 2) * zoom + panY;
      const rx = (width / 2) * zoom;
      const ry = (height / 2) * zoom;

      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#000000';
      ctx.lineDashOffset = -this.marchingAntsOffset + 5;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();

    } else if ((preview.shape === 'path' || preview.shape === 'polygon') && preview.points) {
      const points = preview.points;
      if (points.length < 2) {
        ctx.restore();
        return;
      }

      ctx.beginPath();
      ctx.moveTo(points[0].x * zoom + panX, points[0].y * zoom + panY);

      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x * zoom + panX, points[i].y * zoom + panY);
      }

      // For polygon, show line to current point
      if (preview.shape === 'polygon' && preview.currentPoint) {
        ctx.lineTo(preview.currentPoint.x * zoom + panX, preview.currentPoint.y * zoom + panY);
      }

      // Close path for lasso
      if (preview.shape === 'path') {
        ctx.closePath();
      }

      ctx.stroke();

      ctx.strokeStyle = '#000000';
      ctx.lineDashOffset = -this.marchingAntsOffset + 5;
      ctx.beginPath();
      ctx.moveTo(points[0].x * zoom + panX, points[0].y * zoom + panY);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x * zoom + panX, points[i].y * zoom + panY);
      }
      if (preview.shape === 'polygon' && preview.currentPoint) {
        ctx.lineTo(preview.currentPoint.x * zoom + panX, preview.currentPoint.y * zoom + panY);
      }
      if (preview.shape === 'path') {
        ctx.closePath();
      }
      ctx.stroke();

      // Draw start point indicator for polygon
      if (preview.shape === 'polygon' && points.length >= 3) {
        const startX = points[0].x * zoom + panX;
        const startY = points[0].y * zoom + panY;

        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(startX, startY, 5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  /**
   * Draw marching ants around selection
   */
  drawMarchingAnts(ctx, selection) {
    const { zoom, panX, panY } = this.viewport;

    if (!selection.path && !selection.bounds) return;

    ctx.save();
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    // Draw white dashes
    ctx.strokeStyle = '#ffffff';
    ctx.lineDashOffset = -this.marchingAntsOffset;

    if (selection.path) {
      this.drawPath(ctx, selection.path, zoom, panX, panY);
    } else if (selection.bounds) {
      const { x, y, width, height } = selection.bounds;
      ctx.strokeRect(
        x * zoom + panX,
        y * zoom + panY,
        width * zoom,
        height * zoom
      );
    }

    // Draw black dashes (offset)
    ctx.strokeStyle = '#000000';
    ctx.lineDashOffset = -this.marchingAntsOffset + 4;

    if (selection.path) {
      this.drawPath(ctx, selection.path, zoom, panX, panY);
    } else if (selection.bounds) {
      const { x, y, width, height } = selection.bounds;
      ctx.strokeRect(
        x * zoom + panX,
        y * zoom + panY,
        width * zoom,
        height * zoom
      );
    }

    ctx.restore();
  }

  drawPath(ctx, path, zoom, panX, panY) {
    if (!path || path.length < 2) return;

    ctx.beginPath();
    ctx.moveTo(path[0].x * zoom + panX, path[0].y * zoom + panY);

    for (let i = 1; i < path.length; i++) {
      ctx.lineTo(path[i].x * zoom + panX, path[i].y * zoom + panY);
    }

    ctx.closePath();
    ctx.stroke();
  }

  /**
   * Draw transform handles
   */
  drawTransformHandles(ctx) {
    const handles = this.transformHandles;
    if (!handles || !handles.bounds) return;

    const { zoom, panX, panY } = this.viewport;
    const { x, y, width, height } = handles.bounds;

    const sx = x * zoom + panX;
    const sy = y * zoom + panY;
    const sw = width * zoom;
    const sh = height * zoom;

    ctx.save();

    // Draw bounding box
    ctx.strokeStyle = '#0078d4';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.strokeRect(sx, sy, sw, sh);

    // Draw handles
    const handleSize = 8;
    const halfHandle = handleSize / 2;

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#0078d4';
    ctx.lineWidth = 1;

    // Corner handles
    const corners = [
      { x: sx, y: sy, cursor: 'nw-resize' },
      { x: sx + sw, y: sy, cursor: 'ne-resize' },
      { x: sx + sw, y: sy + sh, cursor: 'se-resize' },
      { x: sx, y: sy + sh, cursor: 'sw-resize' }
    ];

    // Edge handles
    const edges = [
      { x: sx + sw / 2, y: sy, cursor: 'n-resize' },
      { x: sx + sw, y: sy + sh / 2, cursor: 'e-resize' },
      { x: sx + sw / 2, y: sy + sh, cursor: 's-resize' },
      { x: sx, y: sy + sh / 2, cursor: 'w-resize' }
    ];

    // Draw all handles
    [...corners, ...edges].forEach(handle => {
      ctx.fillRect(handle.x - halfHandle, handle.y - halfHandle, handleSize, handleSize);
      ctx.strokeRect(handle.x - halfHandle, handle.y - halfHandle, handleSize, handleSize);
    });

    // Draw rotation handle
    if (handles.showRotation !== false) {
      const rotateHandleY = sy - 30;

      // Line to rotation handle
      ctx.beginPath();
      ctx.moveTo(sx + sw / 2, sy);
      ctx.lineTo(sx + sw / 2, rotateHandleY);
      ctx.stroke();

      // Rotation handle circle
      ctx.beginPath();
      ctx.arc(sx + sw / 2, rotateHandleY, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Draw center point
    const centerX = sx + sw / 2;
    const centerY = sy + sh / 2;

    ctx.beginPath();
    ctx.moveTo(centerX - 5, centerY);
    ctx.lineTo(centerX + 5, centerY);
    ctx.moveTo(centerX, centerY - 5);
    ctx.lineTo(centerX, centerY + 5);
    ctx.stroke();

    ctx.restore();
  }
}

customElements.define('canvas-overlay', CanvasOverlay);
