/**
 * Adjustments Panel - Edit adjustment layer parameters
 */

import { getEventBus, Events } from '../../core/event-bus.js';
import { AdjustmentType, AdjustmentDefaults } from '../../effects/adjustments/adjustment-layer.js';

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

    .panel-content {
      padding: 12px;
      max-height: 300px;
      overflow-y: auto;
    }

    .empty-state {
      color: var(--text-secondary);
      font-size: 12px;
      text-align: center;
      padding: 20px;
    }

    .adjustment-type {
      font-size: 12px;
      color: var(--accent-color);
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border-color);
    }

    .control-group {
      margin-bottom: 12px;
    }

    .control-label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 4px;
      font-size: 11px;
      color: var(--text-secondary);
    }

    .control-value {
      color: var(--text-primary);
      font-weight: 500;
    }

    .slider-control {
      width: 100%;
    }

    input[type="range"] {
      width: 100%;
      height: 4px;
      border-radius: 2px;
      background: var(--bg-input);
      -webkit-appearance: none;
      cursor: pointer;
    }

    input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: var(--accent-color);
      cursor: pointer;
      border: 2px solid var(--bg-panel);
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    }

    input[type="range"]::-webkit-slider-thumb:hover {
      transform: scale(1.1);
    }

    input[type="checkbox"] {
      margin-right: 6px;
    }

    .checkbox-control {
      display: flex;
      align-items: center;
      font-size: 11px;
      color: var(--text-primary);
      cursor: pointer;
    }

    .color-control {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .color-picker {
      width: 32px;
      height: 24px;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      padding: 0;
      cursor: pointer;
    }

    .control-section {
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border-color);
    }

    .control-section:last-child {
      border-bottom: none;
      margin-bottom: 0;
    }

    .section-title {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-secondary);
      margin-bottom: 8px;
    }

    .reset-btn {
      padding: 4px 8px;
      font-size: 10px;
      background: var(--bg-input);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.15s;
    }

    .reset-btn:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }
  </style>

  <div class="panel-header">
    <span class="panel-title">Properties</span>
    <button class="reset-btn" id="reset-btn">Reset</button>
  </div>
  <div class="panel-content" id="panel-content">
    <div class="empty-state">Select an adjustment layer</div>
  </div>
`;

export class AdjustmentsPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this.eventBus = null;
    this.currentLayer = null;
    this.unsubscribers = [];
  }

  connectedCallback() {
    this.eventBus = getEventBus();

    this.setupEventListeners();
    this.subscribeToEvents();
  }

  disconnectedCallback() {
    this.unsubscribers.forEach(unsub => unsub());
  }

  setupEventListeners() {
    // Reset button
    this.shadowRoot.getElementById('reset-btn').addEventListener('click', () => {
      this.resetToDefaults();
    });

    // Delegate input events
    this.shadowRoot.getElementById('panel-content').addEventListener('input', (e) => {
      this.handleInputChange(e);
    });

    this.shadowRoot.getElementById('panel-content').addEventListener('change', (e) => {
      if (e.target.type === 'checkbox' || e.target.type === 'color') {
        this.handleInputChange(e);
      }
    });
  }

  subscribeToEvents() {
    this.unsubscribers.push(
      this.eventBus.on(Events.LAYER_SELECTED, ({ layer }) => {
        if (layer?.type === 'adjustment') {
          this.showAdjustmentControls(layer);
        } else {
          this.clearPanel();
        }
      }),
      this.eventBus.on(Events.ADJUSTMENT_LAYER_CREATED, ({ layer }) => {
        this.showAdjustmentControls(layer);
      }),
      this.eventBus.on(Events.LAYER_REMOVED, () => {
        const app = window.photoEditorApp;
        const activeLayer = app?.document?.getActiveLayer();
        if (!activeLayer || activeLayer.type !== 'adjustment') {
          this.clearPanel();
        }
      })
    );

    // Initial check
    setTimeout(() => {
      const app = window.photoEditorApp;
      const activeLayer = app?.document?.getActiveLayer();
      if (activeLayer?.type === 'adjustment') {
        this.showAdjustmentControls(activeLayer);
      }
    }, 100);
  }

  clearPanel() {
    this.currentLayer = null;
    this.shadowRoot.getElementById('panel-content').innerHTML = `
      <div class="empty-state">Select an adjustment layer</div>
    `;
  }

  showAdjustmentControls(layer) {
    this.currentLayer = layer;
    const content = this.shadowRoot.getElementById('panel-content');
    const type = layer.adjustment?.type;
    const params = layer.adjustment?.params || {};

    if (!type) {
      this.clearPanel();
      return;
    }

    const typeNames = {
      'brightness-contrast': 'Brightness/Contrast',
      'levels': 'Levels',
      'curves': 'Curves',
      'hue-saturation': 'Hue/Saturation',
      'color-balance': 'Color Balance',
      'vibrance': 'Vibrance',
      'photo-filter': 'Photo Filter',
      'black-white': 'Black & White',
      'invert': 'Invert',
      'posterize': 'Posterize',
      'threshold': 'Threshold'
    };

    let html = `<div class="adjustment-type">${typeNames[type] || type}</div>`;

    switch (type) {
      case AdjustmentType.BRIGHTNESS_CONTRAST:
        html += this.renderBrightnessContrastControls(params);
        break;
      case AdjustmentType.LEVELS:
        html += this.renderLevelsControls(params);
        break;
      case AdjustmentType.HUE_SATURATION:
        html += this.renderHueSaturationControls(params);
        break;
      case AdjustmentType.VIBRANCE:
        html += this.renderVibranceControls(params);
        break;
      case AdjustmentType.THRESHOLD:
        html += this.renderThresholdControls(params);
        break;
      case AdjustmentType.POSTERIZE:
        html += this.renderPosterizeControls(params);
        break;
      case AdjustmentType.INVERT:
        html += `<div class="empty-state" style="padding: 10px 0;">No adjustable parameters</div>`;
        break;
      case AdjustmentType.BLACK_WHITE:
        html += this.renderBlackWhiteControls(params);
        break;
      case AdjustmentType.COLOR_BALANCE:
        html += this.renderColorBalanceControls(params);
        break;
      case AdjustmentType.PHOTO_FILTER:
        html += this.renderPhotoFilterControls(params);
        break;
      case AdjustmentType.CURVES:
        html += `<div class="empty-state" style="padding: 10px 0;">Curves editor coming soon</div>`;
        break;
      default:
        html += `<div class="empty-state">Unknown adjustment type</div>`;
    }

    content.innerHTML = html;
  }

  renderSlider(name, label, value, min, max, step = 1) {
    return `
      <div class="control-group">
        <div class="control-label">
          <span>${label}</span>
          <span class="control-value" data-value-for="${name}">${value}</span>
        </div>
        <input type="range" class="slider-control"
               name="${name}" value="${value}"
               min="${min}" max="${max}" step="${step}">
      </div>
    `;
  }

  renderCheckbox(name, label, checked) {
    return `
      <div class="control-group">
        <label class="checkbox-control">
          <input type="checkbox" name="${name}" ${checked ? 'checked' : ''}>
          ${label}
        </label>
      </div>
    `;
  }

  renderColorPicker(name, label, value) {
    return `
      <div class="control-group">
        <div class="control-label">
          <span>${label}</span>
        </div>
        <div class="color-control">
          <input type="color" class="color-picker" name="${name}" value="${value}">
          <span class="control-value">${value}</span>
        </div>
      </div>
    `;
  }

  renderBrightnessContrastControls(params) {
    return `
      ${this.renderSlider('brightness', 'Brightness', params.brightness, -100, 100)}
      ${this.renderSlider('contrast', 'Contrast', params.contrast, -100, 100)}
    `;
  }

  renderLevelsControls(params) {
    return `
      <div class="control-section">
        <div class="section-title">Input Levels</div>
        ${this.renderSlider('inputBlack', 'Black Point', params.inputBlack, 0, 255)}
        ${this.renderSlider('gamma', 'Gamma', params.gamma, 0.1, 10, 0.01)}
        ${this.renderSlider('inputWhite', 'White Point', params.inputWhite, 0, 255)}
      </div>
      <div class="control-section">
        <div class="section-title">Output Levels</div>
        ${this.renderSlider('outputBlack', 'Output Black', params.outputBlack, 0, 255)}
        ${this.renderSlider('outputWhite', 'Output White', params.outputWhite, 0, 255)}
      </div>
    `;
  }

  renderHueSaturationControls(params) {
    return `
      ${this.renderSlider('hue', 'Hue', params.hue, -180, 180)}
      ${this.renderSlider('saturation', 'Saturation', params.saturation, -100, 100)}
      ${this.renderSlider('lightness', 'Lightness', params.lightness, -100, 100)}
      <div class="control-section">
        ${this.renderCheckbox('colorize', 'Colorize', params.colorize)}
        ${this.renderSlider('colorizeHue', 'Colorize Hue', params.colorizeHue, 0, 360)}
        ${this.renderSlider('colorizeSaturation', 'Colorize Saturation', params.colorizeSaturation, 0, 100)}
      </div>
    `;
  }

  renderVibranceControls(params) {
    return `
      ${this.renderSlider('vibrance', 'Vibrance', params.vibrance, -100, 100)}
      ${this.renderSlider('saturation', 'Saturation', params.saturation, -100, 100)}
    `;
  }

  renderThresholdControls(params) {
    return `
      ${this.renderSlider('level', 'Threshold Level', params.level, 1, 255)}
    `;
  }

  renderPosterizeControls(params) {
    return `
      ${this.renderSlider('levels', 'Levels', params.levels, 2, 255)}
    `;
  }

  renderBlackWhiteControls(params) {
    return `
      <div class="control-section">
        <div class="section-title">Color Weights</div>
        ${this.renderSlider('reds', 'Reds', params.reds, -200, 300)}
        ${this.renderSlider('yellows', 'Yellows', params.yellows, -200, 300)}
        ${this.renderSlider('greens', 'Greens', params.greens, -200, 300)}
        ${this.renderSlider('cyans', 'Cyans', params.cyans, -200, 300)}
        ${this.renderSlider('blues', 'Blues', params.blues, -200, 300)}
        ${this.renderSlider('magentas', 'Magentas', params.magentas, -200, 300)}
      </div>
      <div class="control-section">
        <div class="section-title">Tint</div>
        ${this.renderCheckbox('tint', 'Enable Tint', params.tint)}
        ${this.renderColorPicker('tintColor', 'Tint Color', params.tintColor)}
        ${this.renderSlider('tintAmount', 'Tint Amount', params.tintAmount, 0, 100)}
      </div>
    `;
  }

  renderColorBalanceControls(params) {
    return `
      <div class="control-section">
        <div class="section-title">Shadows</div>
        ${this.renderSlider('shadows.cyan', 'Cyan/Red', params.shadows?.cyan || 0, -100, 100)}
        ${this.renderSlider('shadows.magenta', 'Magenta/Green', params.shadows?.magenta || 0, -100, 100)}
        ${this.renderSlider('shadows.yellow', 'Yellow/Blue', params.shadows?.yellow || 0, -100, 100)}
      </div>
      <div class="control-section">
        <div class="section-title">Midtones</div>
        ${this.renderSlider('midtones.cyan', 'Cyan/Red', params.midtones?.cyan || 0, -100, 100)}
        ${this.renderSlider('midtones.magenta', 'Magenta/Green', params.midtones?.magenta || 0, -100, 100)}
        ${this.renderSlider('midtones.yellow', 'Yellow/Blue', params.midtones?.yellow || 0, -100, 100)}
      </div>
      <div class="control-section">
        <div class="section-title">Highlights</div>
        ${this.renderSlider('highlights.cyan', 'Cyan/Red', params.highlights?.cyan || 0, -100, 100)}
        ${this.renderSlider('highlights.magenta', 'Magenta/Green', params.highlights?.magenta || 0, -100, 100)}
        ${this.renderSlider('highlights.yellow', 'Yellow/Blue', params.highlights?.yellow || 0, -100, 100)}
      </div>
      ${this.renderCheckbox('preserveLuminosity', 'Preserve Luminosity', params.preserveLuminosity)}
    `;
  }

  renderPhotoFilterControls(params) {
    return `
      ${this.renderColorPicker('color', 'Filter Color', params.color || '#ec8a00')}
      ${this.renderSlider('density', 'Density', params.density || 25, 0, 100)}
      ${this.renderCheckbox('preserveLuminosity', 'Preserve Luminosity', params.preserveLuminosity !== false)}
    `;
  }

  handleInputChange(e) {
    if (!this.currentLayer || !this.currentLayer.adjustment) return;

    const input = e.target;
    const name = input.name;
    let value;

    if (input.type === 'checkbox') {
      value = input.checked;
    } else if (input.type === 'range' || input.type === 'number') {
      value = parseFloat(input.value);
    } else {
      value = input.value;
    }

    // Update the value display
    const valueDisplay = this.shadowRoot.querySelector(`[data-value-for="${name}"]`);
    if (valueDisplay) {
      valueDisplay.textContent = value;
    }

    // Handle nested property names (e.g., "shadows.cyan")
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      if (!this.currentLayer.adjustment.params[parent]) {
        this.currentLayer.adjustment.params[parent] = {};
      }
      this.currentLayer.adjustment.params[parent][child] = value;
    } else {
      this.currentLayer.adjustment.params[name] = value;
    }

    // Mark layer as dirty and request re-render
    this.currentLayer.dirty = true;
    this.eventBus.emit(Events.ADJUSTMENT_LAYER_UPDATED, { layer: this.currentLayer });
    this.eventBus.emit(Events.RENDER_REQUEST);
  }

  resetToDefaults() {
    if (!this.currentLayer || !this.currentLayer.adjustment) return;

    const type = this.currentLayer.adjustment.type;
    const defaults = AdjustmentDefaults[type];

    if (defaults) {
      this.currentLayer.adjustment.params = JSON.parse(JSON.stringify(defaults));
      this.showAdjustmentControls(this.currentLayer);
      this.currentLayer.dirty = true;
      this.eventBus.emit(Events.ADJUSTMENT_LAYER_UPDATED, { layer: this.currentLayer });
      this.eventBus.emit(Events.RENDER_REQUEST);
    }
  }
}

customElements.define('adjustments-panel', AdjustmentsPanel);
