/**
 * App Shell - Main application container component
 * Sets up the layout and hosts all panels
 */

import { getStore } from '../core/store.js';
import { getEventBus, Events } from '../core/event-bus.js';

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: flex;
      flex-direction: column;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      background: var(--bg-primary);
      color: var(--text-primary);
    }

    .toolbar {
      display: flex;
      align-items: center;
      height: var(--toolbar-height);
      padding: 0 8px;
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
      gap: 8px;
    }

    .toolbar-section {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .main-content {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    .left-panel {
      width: var(--left-panel-width);
      background: var(--bg-secondary);
      border-right: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      padding: 8px 4px;
      gap: 4px;
    }

    .canvas-area {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: var(--bg-canvas);
    }

    .tool-options {
      display: flex;
      align-items: center;
      height: 32px;
      padding: 0 12px;
      background: var(--bg-panel);
      border-bottom: 1px solid var(--border-color);
      gap: 12px;
      font-size: 12px;
    }

    .canvas-container {
      flex: 1;
      position: relative;
      overflow: hidden;
    }

    .right-panel {
      width: var(--right-panel-width);
      background: var(--bg-secondary);
      border-left: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      overflow-y: auto;
    }

    .status-bar {
      display: flex;
      align-items: center;
      height: var(--status-bar-height);
      padding: 0 12px;
      background: var(--bg-secondary);
      border-top: 1px solid var(--border-color);
      font-size: 11px;
      color: var(--text-secondary);
      gap: 16px;
    }

    .status-bar .zoom {
      margin-left: auto;
    }

    /* Tool buttons */
    .tool-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 4px;
      cursor: pointer;
      transition: background-color 0.15s;
    }

    .tool-btn:hover {
      background: var(--bg-hover);
    }

    .tool-btn.active {
      background: var(--accent-color);
    }

    .tool-btn svg {
      width: 20px;
      height: 20px;
      fill: currentColor;
    }

    /* Option inputs */
    .option-group {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .option-group label {
      color: var(--text-secondary);
    }

    .option-group input[type="range"] {
      width: 80px;
    }

    .option-group input[type="number"] {
      width: 50px;
      padding: 2px 4px;
    }
  </style>

  <div class="toolbar">
    <div class="toolbar-section">
      <span style="font-weight: 500;">Photo Editor</span>
    </div>
    <div class="separator"></div>
    <div class="toolbar-section">
      <button class="icon-btn" data-action="new" data-tooltip="New (Ctrl+N)">
        <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/></svg>
      </button>
      <button class="icon-btn" data-action="open" data-tooltip="Open (Ctrl+O)">
        <svg viewBox="0 0 24 24"><path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/></svg>
      </button>
      <button class="icon-btn" data-action="save" data-tooltip="Save (Ctrl+S)">
        <svg viewBox="0 0 24 24"><path d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-4-4zm2 16H5V5h11.17L19 7.83V19zm-7-7a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 6h9v4H6V6z"/></svg>
      </button>
    </div>
    <div class="separator"></div>
    <div class="toolbar-section">
      <button class="icon-btn" data-action="undo" data-tooltip="Undo (Ctrl+Z)">
        <svg viewBox="0 0 24 24"><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/></svg>
      </button>
      <button class="icon-btn" data-action="redo" data-tooltip="Redo (Ctrl+Shift+Z)">
        <svg viewBox="0 0 24 24"><path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22l2.37.78c1.05-3.19 4.06-5.5 7.59-5.5 1.96 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"/></svg>
      </button>
    </div>
    <div class="separator"></div>
    <div class="toolbar-section">
      <button class="icon-btn" data-action="zoom-in" data-tooltip="Zoom In (Ctrl++)">
        <svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14zm.5-7H9v2H7v1h2v2h1v-2h2V9h-2V7z"/></svg>
      </button>
      <button class="icon-btn" data-action="zoom-out" data-tooltip="Zoom Out (Ctrl+-)">
        <svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14zM7 9h5v1H7V9z"/></svg>
      </button>
      <button class="icon-btn" data-action="fit" data-tooltip="Fit to Screen (Ctrl+0)">
        <svg viewBox="0 0 24 24"><path d="M3 5v4h2V5h4V3H5c-1.1 0-2 .9-2 2zm2 10H3v4c0 1.1.9 2 2 2h4v-2H5v-4zm14 4h-4v2h4c1.1 0 2-.9 2-2v-4h-2v4zm0-16h-4v2h4v4h2V5c0-1.1-.9-2-2-2z"/></svg>
      </button>
    </div>
  </div>

  <div class="main-content">
    <div class="left-panel">
      <button class="tool-btn active" data-tool="move" data-tooltip="Move (V)">
        <svg viewBox="0 0 24 24"><path d="M10 9h4V6h3l-5-5-5 5h3v3zm-1 1H6V7l-5 5 5 5v-3h3v-4zm14 2l-5-5v3h-3v4h3v3l5-5zm-9 3h-4v3H7l5 5 5-5h-3v-3z"/></svg>
      </button>
      <button class="tool-btn" data-tool="marquee" data-tooltip="Marquee (M)">
        <svg viewBox="0 0 24 24"><path d="M3 5h2V3H3v2zm0 8h2v-2H3v2zm4 8h2v-2H7v2zM3 9h2V7H3v2zm10-6h-2v2h2V3zm6 0v2h2V3h-2zM5 21v-2H3v2h2zm-2-4h2v-2H3v2zM9 3H7v2h2V3zm2 18h2v-2h-2v2zm8-8h2v-2h-2v2zm0 8v-2h-2v2h2zm0-12h2V7h-2v2zm0 8h2v-2h-2v2zm-4 4h2v-2h-2v2zm0-16h2V3h-2v2z"/></svg>
      </button>
      <button class="tool-btn" data-tool="lasso" data-tooltip="Lasso (L)">
        <svg viewBox="0 0 24 24"><path d="M15 2c-2.71 0-5.05 1.54-6.22 3.78-1.28.67-2.34 1.72-3 3C3.54 9.95 2 12.29 2 15c0 3.87 3.13 7 7 7 2.71 0 5.05-1.54 6.22-3.78 1.28-.67 2.34-1.72 3-3C20.46 14.05 22 11.71 22 9c0-3.87-3.13-7-7-7zM9 20c-2.76 0-5-2.24-5-5 0-1.12.37-2.16 1-3 0 3.87 3.13 7 7 7-.84.63-1.88 1-3 1zm3-3c-2.76 0-5-2.24-5-5 0-1.12.37-2.16 1-3 0 3.87 3.13 7 7 7-.84.63-1.88 1-3 1zm3-3c-2.76 0-5-2.24-5-5 0-1.12.37-2.16 1-3 0 3.87 3.13 7 7 7-.84.63-1.88 1-3 1zm4.32-1.78c.43-.84.68-1.8.68-2.78 0-3.26-2.47-5.91-5.6-6.31.33-.44.6-.93.82-1.45C17.53 2.55 20 5.24 20 8.5c0 1.28-.4 2.47-1.08 3.45-.29.16-.56.35-.82.55l-.78-.28z"/></svg>
      </button>
      <button class="tool-btn" data-tool="magicWand" data-tooltip="Magic Wand (W)">
        <svg viewBox="0 0 24 24"><path d="m7.5 5.6 2 2 7-7-2-2-7 7zm-5.5 13L9.9 11 11 12.1l-7.8 7.9-1.2-1.4zm9.9-1.4 7.9-7.9-1.4-1.4-7.9 7.9 1.4 1.4zm5.7-9.3 1.4 1.4-7.9 7.9-1.4-1.4 7.9-7.9zM4.5 9.1l-3 3L0 10.6l3-3 1.5 1.5zm6.4-6.4 3-3 1.5 1.5-3 3-1.5-1.5z"/></svg>
      </button>
      <div class="separator" style="width: 100%; height: 1px; margin: 4px 0;"></div>
      <button class="tool-btn" data-tool="brush" data-tooltip="Brush (B)">
        <svg viewBox="0 0 24 24"><path d="M7 14c-1.66 0-3 1.34-3 3 0 1.31-1.16 2-2 2 .92 1.22 2.49 2 4 2 2.21 0 4-1.79 4-4 0-1.66-1.34-3-3-3zm13.71-9.37l-1.34-1.34a.996.996 0 0 0-1.41 0L9 12.25 11.75 15l8.96-8.96a.996.996 0 0 0 0-1.41z"/></svg>
      </button>
      <button class="tool-btn" data-tool="eraser" data-tooltip="Eraser (E)">
        <svg viewBox="0 0 24 24"><path d="M16.24 3.56l4.95 4.94c.78.79.78 2.05 0 2.84L12 20.53a4.008 4.008 0 0 1-5.66 0L2.81 17c-.78-.79-.78-2.05 0-2.84l10.6-10.6c.79-.78 2.05-.78 2.83 0zM4.22 15.58l3.54 3.53c.78.79 2.04.79 2.83 0l3.53-3.53-4.95-4.95-4.95 4.95z"/></svg>
      </button>
      <button class="tool-btn" data-tool="fill" data-tooltip="Fill (G)">
        <svg viewBox="0 0 24 24"><path d="M16.56 8.94L7.62 0 6.21 1.41l2.38 2.38-5.15 5.15a1.49 1.49 0 0 0 0 2.12l5.5 5.5c.29.29.68.44 1.06.44s.77-.15 1.06-.44l5.5-5.5c.59-.58.59-1.53 0-2.12zM5.21 10L10 5.21 14.79 10H5.21zM19 11.5s-2 2.17-2 3.5c0 1.1.9 2 2 2s2-.9 2-2c0-1.33-2-3.5-2-3.5zM2 20h20v4H2v-4z"/></svg>
      </button>
      <button class="tool-btn" data-tool="eyedropper" data-tooltip="Eyedropper (I)">
        <svg viewBox="0 0 24 24"><path d="M20.71 5.63l-2.34-2.34a.996.996 0 0 0-1.41 0l-3.12 3.12-1.93-1.91-1.41 1.41 1.42 1.42L3 16.25V21h4.75l8.92-8.92 1.42 1.42 1.41-1.41-1.92-1.92 3.12-3.12c.4-.4.4-1.03.01-1.42zM6.92 19L5 17.08l8.06-8.06 1.92 1.92L6.92 19z"/></svg>
      </button>
      <div class="separator" style="width: 100%; height: 1px; margin: 4px 0;"></div>
      <button class="tool-btn" data-tool="zoom" data-tooltip="Zoom (Z)">
        <svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
      </button>
      <button class="tool-btn" data-tool="hand" data-tooltip="Hand (H)">
        <svg viewBox="0 0 24 24"><path d="M18 24h-6.55c-1.08 0-2.14-.45-2.89-1.23l-7.3-7.61 2.07-1.97c.55-.52 1.38-.62 2.04-.24l2.63 1.52V4.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5V12h1V1.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5V12h1V2.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5V12h1V5.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v11c0 4.14-3.36 7.5-7.5 7.5z"/></svg>
      </button>
    </div>

    <div class="canvas-area">
      <div class="tool-options" id="tool-options">
        <div class="option-group">
          <label>Size:</label>
          <input type="range" id="brush-size" min="1" max="500" value="20">
          <input type="number" id="brush-size-num" min="1" max="500" value="20" style="width: 50px;">
        </div>
        <div class="option-group">
          <label>Opacity:</label>
          <input type="range" id="brush-opacity" min="1" max="100" value="100">
          <span id="brush-opacity-val">100%</span>
        </div>
        <div class="option-group">
          <label>Hardness:</label>
          <input type="range" id="brush-hardness" min="0" max="100" value="100">
          <span id="brush-hardness-val">100%</span>
        </div>
      </div>
      <div class="canvas-container">
        <editor-canvas id="editor-canvas"></editor-canvas>
      </div>
    </div>

    <div class="right-panel">
      <color-panel></color-panel>
      <brushes-panel></brushes-panel>
      <layers-panel></layers-panel>
      <history-panel></history-panel>
    </div>
  </div>

  <div class="status-bar">
    <span id="status-dimensions">1920 × 1080</span>
    <span id="status-tool">Brush</span>
    <span id="status-position">X: 0, Y: 0</span>
    <span class="zoom" id="status-zoom">100%</span>
  </div>
`;

export class AppShell extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this.store = null;
    this.eventBus = null;
    this.unsubscribers = [];
  }

  connectedCallback() {
    this.store = getStore();
    this.eventBus = getEventBus();

    this.setupToolButtons();
    this.setupToolOptions();
    this.setupToolbarActions();
    this.setupStatusBar();
    this.subscribeToState();
  }

  disconnectedCallback() {
    this.unsubscribers.forEach(unsub => unsub());
  }

  setupToolButtons() {
    const toolBtns = this.shadowRoot.querySelectorAll('.tool-btn[data-tool]');

    toolBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tool = btn.dataset.tool;
        this.store.state.tools.active = tool;

        // Update active state
        toolBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        this.eventBus.emit(Events.TOOL_CHANGED, { tool });
      });
    });
  }

  setupToolOptions() {
    const sizeSlider = this.shadowRoot.getElementById('brush-size');
    const sizeNum = this.shadowRoot.getElementById('brush-size-num');
    const opacitySlider = this.shadowRoot.getElementById('brush-opacity');
    const opacityVal = this.shadowRoot.getElementById('brush-opacity-val');
    const hardnessSlider = this.shadowRoot.getElementById('brush-hardness');
    const hardnessVal = this.shadowRoot.getElementById('brush-hardness-val');

    // Size
    const updateSize = (value) => {
      this.store.state.tools.options.brush.size = parseInt(value);
      sizeSlider.value = value;
      sizeNum.value = value;
      this.eventBus.emit(Events.TOOL_OPTIONS_CHANGED, {
        tool: 'brush',
        options: this.store.state.tools.options.brush
      });
    };

    sizeSlider.addEventListener('input', (e) => updateSize(e.target.value));
    sizeNum.addEventListener('change', (e) => updateSize(e.target.value));

    // Opacity
    opacitySlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      this.store.state.tools.options.brush.opacity = value;
      opacityVal.textContent = `${value}%`;
      this.eventBus.emit(Events.TOOL_OPTIONS_CHANGED, {
        tool: 'brush',
        options: this.store.state.tools.options.brush
      });
    });

    // Hardness
    hardnessSlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      this.store.state.tools.options.brush.hardness = value;
      hardnessVal.textContent = `${value}%`;
      this.eventBus.emit(Events.TOOL_OPTIONS_CHANGED, {
        tool: 'brush',
        options: this.store.state.tools.options.brush
      });
    });
  }

  setupToolbarActions() {
    const toolbar = this.shadowRoot.querySelector('.toolbar');

    toolbar.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      this.eventBus.emit(`toolbar:${action}`, {});
    });
  }

  setupStatusBar() {
    // Update on viewport changes
    this.unsubscribers.push(
      this.eventBus.on(Events.VIEWPORT_CHANGED, ({ zoom }) => {
        this.shadowRoot.getElementById('status-zoom').textContent =
          `${Math.round(zoom * 100)}%`;
      })
    );

    // Update on pointer move
    this.unsubscribers.push(
      this.eventBus.on(Events.CANVAS_POINTER_MOVE, ({ x, y }) => {
        this.shadowRoot.getElementById('status-position').textContent =
          `X: ${Math.round(x)}, Y: ${Math.round(y)}`;
      })
    );

    // Update on tool change
    this.unsubscribers.push(
      this.eventBus.on(Events.TOOL_CHANGED, ({ tool }) => {
        const toolNames = {
          move: 'Move', marquee: 'Marquee', lasso: 'Lasso',
          magicWand: 'Magic Wand', brush: 'Brush', eraser: 'Eraser',
          fill: 'Fill', eyedropper: 'Eyedropper', zoom: 'Zoom', hand: 'Hand'
        };
        this.shadowRoot.getElementById('status-tool').textContent =
          toolNames[tool] || tool;
      })
    );
  }

  subscribeToState() {
    // Update dimensions display when document changes
    this.unsubscribers.push(
      this.store.subscribe('document', (doc) => {
        if (doc) {
          this.shadowRoot.getElementById('status-dimensions').textContent =
            `${doc.width} × ${doc.height}`;
        }
      })
    );

    // Sync tool options from store
    this.unsubscribers.push(
      this.store.subscribe('tools.options.brush', (options) => {
        if (!options) return;

        const sizeSlider = this.shadowRoot.getElementById('brush-size');
        const sizeNum = this.shadowRoot.getElementById('brush-size-num');
        const opacitySlider = this.shadowRoot.getElementById('brush-opacity');
        const opacityVal = this.shadowRoot.getElementById('brush-opacity-val');

        sizeSlider.value = options.size;
        sizeNum.value = options.size;
        opacitySlider.value = options.opacity;
        opacityVal.textContent = `${options.opacity}%`;
      })
    );
  }
}

customElements.define('app-shell', AppShell);
