/**
 * Brushes Panel - Brush presets selection and management
 */

import { getStore } from '../../core/store.js';
import { getEventBus, Events } from '../../core/event-bus.js';
import { getBrushPresetManager } from '../../tools/brush/brush-presets.js';

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: block;
      background: var(--bg-panel);
      border-bottom: 1px solid var(--border-color);
    }

    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
    }

    .panel-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-secondary);
    }

    .panel-actions {
      display: flex;
      gap: 4px;
    }

    .action-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: 4px;
      color: var(--text-secondary);
      transition: all 0.15s;
      background: none;
      border: none;
      cursor: pointer;
    }

    .action-btn:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }

    .action-btn svg {
      width: 16px;
      height: 16px;
      fill: currentColor;
    }

    .brush-settings {
      padding: 8px 12px;
      border-bottom: 1px solid var(--border-color);
    }

    .setting-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }

    .setting-row:last-child {
      margin-bottom: 0;
    }

    .setting-label {
      font-size: 11px;
      color: var(--text-secondary);
      width: 60px;
      flex-shrink: 0;
    }

    .setting-slider {
      flex: 1;
      height: 4px;
      -webkit-appearance: none;
      appearance: none;
      background: var(--bg-secondary);
      border-radius: 2px;
      outline: none;
    }

    .setting-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 12px;
      height: 12px;
      background: var(--accent-color);
      border-radius: 50%;
      cursor: pointer;
    }

    .setting-value {
      font-size: 11px;
      color: var(--text-primary);
      width: 40px;
      text-align: right;
    }

    .category-section {
      margin-bottom: 8px;
    }

    .category-header {
      display: flex;
      align-items: center;
      padding: 6px 12px;
      gap: 6px;
      cursor: pointer;
      font-size: 11px;
      font-weight: 600;
      color: var(--text-secondary);
      background: var(--bg-secondary);
    }

    .category-header:hover {
      background: var(--bg-hover);
    }

    .category-toggle {
      width: 12px;
      height: 12px;
      transition: transform 0.15s;
    }

    .category-toggle.collapsed {
      transform: rotate(-90deg);
    }

    .category-toggle svg {
      width: 12px;
      height: 12px;
      fill: currentColor;
    }

    .presets-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(48px, 1fr));
      gap: 4px;
      padding: 8px 12px;
    }

    .presets-grid.collapsed {
      display: none;
    }

    .preset-item {
      position: relative;
      aspect-ratio: 1;
      border-radius: 4px;
      border: 2px solid transparent;
      background: var(--bg-secondary);
      cursor: pointer;
      overflow: hidden;
      transition: all 0.15s;
    }

    .preset-item:hover {
      border-color: var(--border-color);
    }

    .preset-item.selected {
      border-color: var(--accent-color);
    }

    .preset-item canvas {
      width: 100%;
      height: 100%;
    }

    .preset-item .preset-name {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 2px 4px;
      font-size: 8px;
      background: rgba(0, 0, 0, 0.7);
      color: white;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      opacity: 0;
      transition: opacity 0.15s;
    }

    .preset-item:hover .preset-name {
      opacity: 1;
    }

    .brush-preview {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 12px;
      border-bottom: 1px solid var(--border-color);
    }

    .brush-preview canvas {
      background-image:
        linear-gradient(45deg, #333 25%, transparent 25%),
        linear-gradient(-45deg, #333 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #333 75%),
        linear-gradient(-45deg, transparent 75%, #333 75%);
      background-size: 8px 8px;
      background-position: 0 0, 0 4px, 4px -4px, -4px 0px;
      background-color: #222;
      border-radius: 4px;
    }
  </style>

  <div class="panel-header">
    <span class="panel-title">Brushes</span>
    <div class="panel-actions">
      <button class="action-btn" data-action="new" title="New Brush">
        <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
      </button>
    </div>
  </div>

  <div class="brush-preview">
    <canvas id="preview-canvas" width="80" height="80"></canvas>
  </div>

  <div class="brush-settings">
    <div class="setting-row">
      <span class="setting-label">Size</span>
      <input type="range" class="setting-slider" id="brush-size" min="1" max="500" value="20">
      <span class="setting-value" id="size-value">20px</span>
    </div>
    <div class="setting-row">
      <span class="setting-label">Hardness</span>
      <input type="range" class="setting-slider" id="brush-hardness" min="0" max="100" value="100">
      <span class="setting-value" id="hardness-value">100%</span>
    </div>
    <div class="setting-row">
      <span class="setting-label">Opacity</span>
      <input type="range" class="setting-slider" id="brush-opacity" min="1" max="100" value="100">
      <span class="setting-value" id="opacity-value">100%</span>
    </div>
    <div class="setting-row">
      <span class="setting-label">Flow</span>
      <input type="range" class="setting-slider" id="brush-flow" min="1" max="100" value="100">
      <span class="setting-value" id="flow-value">100%</span>
    </div>
  </div>

  <div id="presets-container"></div>
`;

export class BrushesPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this.store = null;
    this.eventBus = null;
    this.presetManager = null;
    this.unsubscribers = [];

    this.collapsedCategories = new Set();
  }

  connectedCallback() {
    this.store = getStore();
    this.eventBus = getEventBus();
    this.presetManager = getBrushPresetManager();

    this.setupEventListeners();
    this.render();
    this.updatePreview();
  }

  disconnectedCallback() {
    this.unsubscribers.forEach(unsub => unsub());
  }

  setupEventListeners() {
    // Size slider
    const sizeSlider = this.shadowRoot.getElementById('brush-size');
    const sizeValue = this.shadowRoot.getElementById('size-value');
    sizeSlider.addEventListener('input', (e) => {
      const size = parseInt(e.target.value);
      sizeValue.textContent = `${size}px`;
      this.updateBrushOption('size', size);
      this.updatePreview();
    });

    // Hardness slider
    const hardnessSlider = this.shadowRoot.getElementById('brush-hardness');
    const hardnessValue = this.shadowRoot.getElementById('hardness-value');
    hardnessSlider.addEventListener('input', (e) => {
      const hardness = parseInt(e.target.value);
      hardnessValue.textContent = `${hardness}%`;
      this.updateBrushOption('hardness', hardness);
      this.updatePreview();
    });

    // Opacity slider
    const opacitySlider = this.shadowRoot.getElementById('brush-opacity');
    const opacityValue = this.shadowRoot.getElementById('opacity-value');
    opacitySlider.addEventListener('input', (e) => {
      const opacity = parseInt(e.target.value);
      opacityValue.textContent = `${opacity}%`;
      this.updateBrushOption('opacity', opacity);
    });

    // Flow slider
    const flowSlider = this.shadowRoot.getElementById('brush-flow');
    const flowValue = this.shadowRoot.getElementById('flow-value');
    flowSlider.addEventListener('input', (e) => {
      const flow = parseInt(e.target.value);
      flowValue.textContent = `${flow}%`;
      this.updateBrushOption('flow', flow);
    });

    // Listen for tool changes
    this.unsubscribers.push(
      this.eventBus.on(Events.TOOL_CHANGED, () => this.syncFromStore()),
      this.eventBus.on(Events.TOOL_OPTIONS_CHANGED, () => this.syncFromStore())
    );
  }

  updateBrushOption(option, value) {
    this.store.state.tools.options.brush[option] = value;
    this.eventBus.emit(Events.TOOL_OPTIONS_CHANGED, {
      tool: 'brush',
      options: this.store.state.tools.options.brush
    });
  }

  syncFromStore() {
    const options = this.store.state.tools.options.brush;
    if (!options) return;

    const sizeSlider = this.shadowRoot.getElementById('brush-size');
    const hardnessSlider = this.shadowRoot.getElementById('brush-hardness');
    const opacitySlider = this.shadowRoot.getElementById('brush-opacity');
    const flowSlider = this.shadowRoot.getElementById('brush-flow');

    if (sizeSlider) {
      sizeSlider.value = options.size ?? 20;
      this.shadowRoot.getElementById('size-value').textContent = `${options.size ?? 20}px`;
    }
    if (hardnessSlider) {
      hardnessSlider.value = options.hardness ?? 100;
      this.shadowRoot.getElementById('hardness-value').textContent = `${options.hardness ?? 100}%`;
    }
    if (opacitySlider) {
      opacitySlider.value = options.opacity ?? 100;
      this.shadowRoot.getElementById('opacity-value').textContent = `${options.opacity ?? 100}%`;
    }
    if (flowSlider) {
      flowSlider.value = options.flow ?? 100;
      this.shadowRoot.getElementById('flow-value').textContent = `${options.flow ?? 100}%`;
    }

    this.updatePreview();
  }

  updatePreview() {
    const canvas = this.shadowRoot.getElementById('preview-canvas');
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const options = this.store.state.tools.options.brush;
    const size = Math.min(60, options?.size ?? 20);
    const hardness = (options?.hardness ?? 100) / 100;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = size / 2;

    if (hardness >= 0.99) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const gradient = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, radius
      );
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
      gradient.addColorStop(hardness, 'rgba(255, 255, 255, 0.8)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.fillStyle = gradient;
      ctx.fillRect(centerX - radius, centerY - radius, size, size);
    }
  }

  render() {
    const container = this.shadowRoot.getElementById('presets-container');
    const categories = this.presetManager.getCategories();
    const activeId = this.presetManager.activePresetId;

    container.innerHTML = categories.map(category => {
      const presets = this.presetManager.getPresetsByCategory(category);
      const isCollapsed = this.collapsedCategories.has(category);

      return `
        <div class="category-section">
          <div class="category-header" data-category="${category}">
            <span class="category-toggle ${isCollapsed ? 'collapsed' : ''}">
              <svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>
            </span>
            <span>${category}</span>
            <span style="margin-left: auto; font-weight: normal;">(${presets.length})</span>
          </div>
          <div class="presets-grid ${isCollapsed ? 'collapsed' : ''}">
            ${presets.map(preset => `
              <div class="preset-item ${preset.id === activeId ? 'selected' : ''}"
                   data-preset-id="${preset.id}"
                   title="${preset.name}">
                <canvas width="48" height="48" data-thumb-id="${preset.id}"></canvas>
                <div class="preset-name">${preset.name}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');

    // Draw thumbnails
    requestAnimationFrame(() => {
      const thumbs = container.querySelectorAll('[data-thumb-id]');
      thumbs.forEach(thumb => {
        const presetId = thumb.dataset.thumbId;
        const preset = this.presetManager.getPreset(presetId);
        if (preset?.thumbnail) {
          const ctx = thumb.getContext('2d');
          ctx.drawImage(preset.thumbnail, 0, 0);
        }
      });
    });

    // Category toggle handlers
    container.querySelectorAll('.category-header').forEach(header => {
      header.addEventListener('click', () => {
        const category = header.dataset.category;
        const toggle = header.querySelector('.category-toggle');
        const grid = header.nextElementSibling;

        if (this.collapsedCategories.has(category)) {
          this.collapsedCategories.delete(category);
          toggle.classList.remove('collapsed');
          grid.classList.remove('collapsed');
        } else {
          this.collapsedCategories.add(category);
          toggle.classList.add('collapsed');
          grid.classList.add('collapsed');
        }
      });
    });

    // Preset selection handlers
    container.querySelectorAll('.preset-item').forEach(item => {
      item.addEventListener('click', () => {
        const presetId = item.dataset.presetId;
        this.selectPreset(presetId);
      });
    });
  }

  selectPreset(presetId) {
    const preset = this.presetManager.getPreset(presetId);
    if (!preset) return;

    this.presetManager.setActivePreset(presetId);

    // Apply preset settings to brush options
    this.store.state.tools.options.brush = {
      ...this.store.state.tools.options.brush,
      size: preset.size,
      hardness: preset.hardness,
      opacity: preset.opacity,
      flow: preset.flow,
      spacing: preset.spacing,
      pressureSize: preset.dynamics.sizePressure,
      pressureOpacity: preset.dynamics.opacityPressure
    };

    this.eventBus.emit(Events.TOOL_OPTIONS_CHANGED, {
      tool: 'brush',
      options: this.store.state.tools.options.brush
    });

    this.syncFromStore();
    this.render();
  }
}

customElements.define('brushes-panel', BrushesPanel);
