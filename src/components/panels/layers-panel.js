/**
 * Layers Panel - Displays and manages document layers
 */

import { getStore } from '../../core/store.js';
import { getEventBus, Events } from '../../core/event-bus.js';
import { getMaskManager } from '../../document/mask.js';
import { createAdjustmentLayer } from '../../document/layer.js';
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

    .layers-list {
      max-height: 200px;
      overflow-y: auto;
    }

    .layer-item {
      display: flex;
      align-items: center;
      padding: 6px 8px;
      gap: 8px;
      cursor: grab;
      border-bottom: 1px solid var(--border-color);
      transition: background-color 0.15s, transform 0.15s, box-shadow 0.15s;
      user-select: none;
    }

    .layer-item:hover {
      background: var(--layer-hover);
    }

    .layer-item.selected {
      background: var(--layer-selected);
    }

    .layer-item.dragging {
      opacity: 0.8;
      transform: scale(1.02);
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      cursor: grabbing;
      z-index: 100;
    }

    .layer-item.drag-over {
      border-top: 2px solid var(--accent-color);
    }

    .layer-item.drag-over-bottom {
      border-bottom: 2px solid var(--accent-color);
    }

    .layer-group {
      margin-left: 16px;
    }

    .group-header {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .group-toggle {
      width: 16px;
      height: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }

    .group-toggle svg {
      width: 12px;
      height: 12px;
      fill: var(--text-secondary);
      transition: transform 0.15s;
    }

    .group-toggle.collapsed svg {
      transform: rotate(-90deg);
    }

    .layer-visibility {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      border-radius: 4px;
      color: var(--text-secondary);
    }

    .layer-visibility:hover {
      background: var(--bg-hover);
    }

    .layer-visibility.hidden {
      opacity: 0.3;
    }

    .layer-visibility svg {
      width: 14px;
      height: 14px;
      fill: currentColor;
    }

    .layer-thumbnail {
      width: 32px;
      height: 32px;
      border: 1px solid var(--border-color);
      border-radius: 2px;
      background-image:
        linear-gradient(45deg, #444 25%, transparent 25%),
        linear-gradient(-45deg, #444 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #444 75%),
        linear-gradient(-45deg, transparent 75%, #444 75%);
      background-size: 8px 8px;
      background-position: 0 0, 0 4px, 4px -4px, -4px 0px;
      background-color: #333;
      overflow: hidden;
    }

    .layer-thumbnail img,
    .layer-thumbnail canvas {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .layer-info {
      flex: 1;
      min-width: 0;
    }

    .layer-name {
      font-size: 12px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .layer-meta {
      font-size: 10px;
      color: var(--text-secondary);
      margin-top: 2px;
    }

    .blend-mode-select {
      padding: 4px 8px;
      font-size: 11px;
      background: var(--bg-input);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      color: var(--text-primary);
      margin: 8px;
    }

    .opacity-control {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 8px 8px;
      font-size: 11px;
    }

    .opacity-control label {
      color: var(--text-secondary);
    }

    .opacity-control input[type="range"] {
      flex: 1;
    }

    .empty-state {
      padding: 20px;
      text-align: center;
      color: var(--text-secondary);
      font-size: 12px;
    }

    .mask-thumbnail {
      width: 24px;
      height: 24px;
      border: 1px solid var(--border-color);
      border-radius: 2px;
      background: #333;
      cursor: pointer;
      position: relative;
    }

    .mask-thumbnail.editing {
      border-color: var(--accent-color);
      box-shadow: 0 0 0 1px var(--accent-color);
    }

    .mask-thumbnail.disabled {
      opacity: 0.4;
    }

    .mask-thumbnail canvas {
      width: 100%;
      height: 100%;
    }

    .mask-link {
      width: 12px;
      height: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: var(--text-secondary);
    }

    .mask-link:hover {
      color: var(--text-primary);
    }

    .mask-link.unlinked {
      opacity: 0.3;
    }

    .mask-link svg {
      width: 10px;
      height: 10px;
      fill: currentColor;
    }

    .layer-thumbnails {
      display: flex;
      align-items: center;
      gap: 2px;
    }

    .add-mask-btn {
      width: 24px;
      height: 24px;
      border: 1px dashed var(--border-color);
      border-radius: 2px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: var(--text-secondary);
      background: transparent;
    }

    .add-mask-btn:hover {
      border-color: var(--text-secondary);
      color: var(--text-primary);
    }

    .add-mask-btn svg {
      width: 12px;
      height: 12px;
      fill: currentColor;
    }

    /* Clipping mask styles */
    .layer-item.clipped {
      margin-left: 16px;
      border-left: 2px solid var(--accent-color);
    }

    .layer-item.clipped::before {
      content: '';
      position: absolute;
      left: -16px;
      top: 50%;
      width: 14px;
      height: 2px;
      background: var(--accent-color);
    }

    .clip-indicator {
      font-size: 10px;
      color: var(--accent-color);
      margin-left: 4px;
    }

    .layer-item {
      position: relative;
    }

    /* Adjustment layer styles */
    .layer-item.adjustment {
      background: linear-gradient(to right, rgba(128, 0, 255, 0.1), transparent);
    }

    .layer-item.adjustment .layer-thumbnail {
      background: linear-gradient(135deg, #8b5cf6, #6366f1);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .layer-item.adjustment .layer-thumbnail svg {
      width: 20px;
      height: 20px;
      fill: white;
    }

    .adjustment-type-badge {
      font-size: 9px;
      color: #a78bfa;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* Adjustment dropdown menu */
    .adjustment-menu {
      position: relative;
    }

    .adjustment-dropdown {
      position: absolute;
      top: 100%;
      right: 0;
      min-width: 180px;
      background: var(--bg-panel);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
      z-index: 1000;
      display: none;
      padding: 4px 0;
    }

    .adjustment-dropdown.visible {
      display: block;
    }

    .adjustment-dropdown-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      cursor: pointer;
      color: var(--text-primary);
      font-size: 12px;
      transition: background 0.15s;
    }

    .adjustment-dropdown-item:hover {
      background: var(--bg-hover);
    }

    .adjustment-dropdown-item svg {
      width: 16px;
      height: 16px;
      fill: currentColor;
      opacity: 0.7;
    }

    .adjustment-dropdown-divider {
      height: 1px;
      background: var(--border-color);
      margin: 4px 0;
    }
  </style>

  <div class="panel-header">
    <span class="panel-title">Layers</span>
    <div class="panel-actions">
      <button class="action-btn" data-action="add" title="New Layer">
        <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
      </button>
      <div class="adjustment-menu">
        <button class="action-btn" data-action="toggle-adjustment-menu" title="Add Adjustment Layer">
          <svg viewBox="0 0 24 24"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>
        </button>
        <div class="adjustment-dropdown" id="adjustment-dropdown">
          <div class="adjustment-dropdown-item" data-adjustment="brightness-contrast">
            <svg viewBox="0 0 24 24"><path d="M20 15.31L23.31 12 20 8.69V4h-4.69L12 .69 8.69 4H4v4.69L.69 12 4 15.31V20h4.69L12 23.31 15.31 20H20v-4.69zM12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"/></svg>
            Brightness/Contrast
          </div>
          <div class="adjustment-dropdown-item" data-adjustment="levels">
            <svg viewBox="0 0 24 24"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm2 4v-2H3a2 2 0 002 2zM3 9h2V7H3v2zm12 12h2v-2h-2v2zm4-18H9a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2zm0 12H9V5h10v10zm-8 6h2v-2h-2v2zm-4 0h2v-2H7v2z"/></svg>
            Levels
          </div>
          <div class="adjustment-dropdown-item" data-adjustment="curves">
            <svg viewBox="0 0 24 24"><path d="M16.5 3c-2.49 0-4.5 2.01-4.5 4.5 0 .33.04.66.09.98L5.5 15.5V19h3.5l7.02-6.59c.32.05.65.09.98.09 2.49 0 4.5-2.01 4.5-4.5S18.99 3 16.5 3zm0 7c-1.38 0-2.5-1.12-2.5-2.5S15.12 5 16.5 5 19 6.12 19 7.5 17.88 10 16.5 10z"/></svg>
            Curves
          </div>
          <div class="adjustment-dropdown-divider"></div>
          <div class="adjustment-dropdown-item" data-adjustment="hue-saturation">
            <svg viewBox="0 0 24 24"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8z"/></svg>
            Hue/Saturation
          </div>
          <div class="adjustment-dropdown-item" data-adjustment="color-balance">
            <svg viewBox="0 0 24 24"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9zm0 16c-3.86 0-7-3.14-7-7s3.14-7 7-7 7 3.14 7 7-3.14 7-7 7z"/></svg>
            Color Balance
          </div>
          <div class="adjustment-dropdown-item" data-adjustment="vibrance">
            <svg viewBox="0 0 24 24"><path d="M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10 10-4.49 10-10S17.51 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3-8c0 1.66-1.34 3-3 3s-3-1.34-3-3 1.34-3 3-3 3 1.34 3 3z"/></svg>
            Vibrance
          </div>
          <div class="adjustment-dropdown-item" data-adjustment="photo-filter">
            <svg viewBox="0 0 24 24"><path d="M20 4h-3.17L15 2H9L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h4.05l1.83-2h4.24l1.83 2H20v12zM12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5z"/></svg>
            Photo Filter
          </div>
          <div class="adjustment-dropdown-divider"></div>
          <div class="adjustment-dropdown-item" data-adjustment="black-white">
            <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18V4c4.41 0 8 3.59 8 8s-3.59 8-8 8z"/></svg>
            Black & White
          </div>
          <div class="adjustment-dropdown-item" data-adjustment="invert">
            <svg viewBox="0 0 24 24"><path d="M17.66 7.93L12 2.27 6.34 7.93c-3.12 3.12-3.12 8.19 0 11.31C7.9 20.8 9.95 21.58 12 21.58c2.05 0 4.1-.78 5.66-2.34 3.12-3.12 3.12-8.19 0-11.31zM12 19.59c-1.6 0-3.11-.62-4.24-1.76C6.62 16.69 6 15.19 6 13.59s.62-3.11 1.76-4.24L12 5.1v14.49z"/></svg>
            Invert
          </div>
          <div class="adjustment-dropdown-item" data-adjustment="posterize">
            <svg viewBox="0 0 24 24"><path d="M3 5H1v16c0 1.1.9 2 2 2h16v-2H3V5zm18-4H7c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V3c0-1.1-.9-2-2-2zm0 16H7V3h14v14z"/></svg>
            Posterize
          </div>
          <div class="adjustment-dropdown-item" data-adjustment="threshold">
            <svg viewBox="0 0 24 24"><path d="M12 4c4.41 0 8 3.59 8 8s-3.59 8-8 8-8-3.59-8-8 3.59-8 8-8m0-2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14c-2.21 0-4-1.79-4-4h8c0 2.21-1.79 4-4 4z"/></svg>
            Threshold
          </div>
        </div>
      </div>
      <button class="action-btn" data-action="add-mask" title="Add Layer Mask">
        <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6z"/></svg>
      </button>
      <button class="action-btn" data-action="duplicate" title="Duplicate Layer">
        <svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
      </button>
      <button class="action-btn" data-action="delete" title="Delete Layer">
        <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
      </button>
    </div>
  </div>

  <select class="blend-mode-select" id="blend-mode">
    <option value="normal">Normal</option>
    <option value="multiply">Multiply</option>
    <option value="screen">Screen</option>
    <option value="overlay">Overlay</option>
    <option value="darken">Darken</option>
    <option value="lighten">Lighten</option>
    <option value="color-dodge">Color Dodge</option>
    <option value="color-burn">Color Burn</option>
    <option value="hard-light">Hard Light</option>
    <option value="soft-light">Soft Light</option>
    <option value="difference">Difference</option>
    <option value="exclusion">Exclusion</option>
  </select>

  <div class="opacity-control">
    <label>Opacity:</label>
    <input type="range" id="layer-opacity" min="0" max="100" value="100">
    <span id="opacity-value">100%</span>
  </div>

  <div class="layers-list" id="layers-list">
    <div class="empty-state">No layers</div>
  </div>
`;

export class LayersPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this.store = null;
    this.eventBus = null;
    this.unsubscribers = [];

    // Drag state
    this.draggedLayerId = null;
    this.dragOverLayerId = null;
    this.dragPosition = null; // 'above' or 'below'
  }

  connectedCallback() {
    this.store = getStore();
    this.eventBus = getEventBus();

    this.setupEventListeners();
    this.subscribeToState();
  }

  disconnectedCallback() {
    this.unsubscribers.forEach(unsub => unsub());
  }

  setupEventListeners() {
    // Panel actions
    this.shadowRoot.querySelector('.panel-actions').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      this.handleAction(action);
    });

    // Adjustment dropdown menu
    const adjustmentDropdown = this.shadowRoot.getElementById('adjustment-dropdown');

    adjustmentDropdown.addEventListener('click', (e) => {
      const item = e.target.closest('[data-adjustment]');
      if (!item) return;

      e.stopPropagation();
      const adjustmentType = item.dataset.adjustment;
      this.addAdjustmentLayer(adjustmentType);
      adjustmentDropdown.classList.remove('visible');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.shadowRoot.contains(e.target)) {
        adjustmentDropdown.classList.remove('visible');
      }
    });

    // Blend mode
    const blendSelect = this.shadowRoot.getElementById('blend-mode');
    blendSelect.addEventListener('change', (e) => {
      this.updateActiveLayerBlendMode(e.target.value);
    });

    // Opacity
    const opacitySlider = this.shadowRoot.getElementById('layer-opacity');
    const opacityValue = this.shadowRoot.getElementById('opacity-value');

    opacitySlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      opacityValue.textContent = `${value}%`;
      this.updateActiveLayerOpacity(value / 100);
    });

    // Layer list clicks
    const layersList = this.shadowRoot.getElementById('layers-list');
    layersList.addEventListener('click', (e) => {
      const layerItem = e.target.closest('.layer-item');
      const visibilityBtn = e.target.closest('.layer-visibility');
      const maskAction = e.target.closest('[data-action]');

      if (visibilityBtn && layerItem) {
        e.stopPropagation();
        this.toggleLayerVisibility(layerItem.dataset.id);
        return;
      }

      // Handle mask actions
      if (maskAction && maskAction.dataset.layerId) {
        e.stopPropagation();
        this.handleMaskAction(maskAction.dataset.action, maskAction.dataset.layerId, e);
        return;
      }

      if (layerItem) {
        if (event.altKey) {
          // Alt+click toggles clipping mask
          const maskManager = getMaskManager();
          maskManager.toggleClipping(layerItem.dataset.id);
        } else {
          this.selectLayer(layerItem.dataset.id);
        }
      }
    });

    // Drag and drop for layer reordering
    layersList.addEventListener('pointerdown', (e) => {
      const layerItem = e.target.closest('.layer-item');
      if (!layerItem || e.target.closest('.layer-visibility')) return;

      this.draggedLayerId = layerItem.dataset.id;
      layerItem.classList.add('dragging');
      layerItem.setPointerCapture(e.pointerId);
    });

    layersList.addEventListener('pointermove', (e) => {
      if (!this.draggedLayerId) return;

      const layerItem = e.target.closest('.layer-item');
      if (!layerItem || layerItem.dataset.id === this.draggedLayerId) {
        this.clearDragOver();
        return;
      }

      // Determine if above or below center
      const rect = layerItem.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const position = e.clientY < midY ? 'above' : 'below';

      if (this.dragOverLayerId !== layerItem.dataset.id || this.dragPosition !== position) {
        this.clearDragOver();
        this.dragOverLayerId = layerItem.dataset.id;
        this.dragPosition = position;

        layerItem.classList.add(position === 'above' ? 'drag-over' : 'drag-over-bottom');
      }
    });

    layersList.addEventListener('pointerup', (e) => {
      if (!this.draggedLayerId) return;

      const draggedItem = layersList.querySelector(`[data-id="${this.draggedLayerId}"]`);
      if (draggedItem) {
        draggedItem.classList.remove('dragging');
      }

      // Perform the move if we have a valid target
      if (this.dragOverLayerId && this.draggedLayerId !== this.dragOverLayerId) {
        this.moveLayer(this.draggedLayerId, this.dragOverLayerId, this.dragPosition);
      }

      this.clearDragOver();
      this.draggedLayerId = null;
    });

    layersList.addEventListener('pointercancel', () => {
      this.clearDragState();
    });
  }

  clearDragOver() {
    const items = this.shadowRoot.querySelectorAll('.drag-over, .drag-over-bottom');
    items.forEach(item => {
      item.classList.remove('drag-over', 'drag-over-bottom');
    });
    this.dragOverLayerId = null;
    this.dragPosition = null;
  }

  clearDragState() {
    this.clearDragOver();
    const draggedItem = this.shadowRoot.querySelector('.dragging');
    if (draggedItem) {
      draggedItem.classList.remove('dragging');
    }
    this.draggedLayerId = null;
  }

  moveLayer(draggedId, targetId, position) {
    const app = window.photoEditorApp;
    if (!app || !app.document) return;

    const doc = app.document;
    const draggedIndex = doc.layers.findIndex(l => l.id === draggedId);
    const targetIndex = doc.layers.findIndex(l => l.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    // Calculate new index (remember: UI shows layers in reverse order)
    // In UI: top layer is first, in array: top layer is last
    let newIndex = targetIndex;
    if (position === 'above') {
      // Moving above in UI = moving to higher index in array
      newIndex = targetIndex + 1;
    }

    // Adjust if dragging from above the target
    if (draggedIndex > targetIndex) {
      newIndex = position === 'above' ? targetIndex + 1 : targetIndex;
    } else {
      newIndex = position === 'above' ? targetIndex : targetIndex - 1;
    }

    doc.moveLayer(draggedId, newIndex);
    this.eventBus.emit(Events.RENDER_REQUEST);
  }

  subscribeToState() {
    // Re-render when layers change
    this.unsubscribers.push(
      this.eventBus.on(Events.LAYER_ADDED, () => this.render()),
      this.eventBus.on(Events.LAYER_REMOVED, () => this.render()),
      this.eventBus.on(Events.LAYER_SELECTED, () => this.render()),
      this.eventBus.on(Events.LAYER_UPDATED, () => this.render()),
      this.eventBus.on(Events.LAYER_REORDERED, () => this.render()),
      this.eventBus.on(Events.LAYER_VISIBILITY_CHANGED, () => this.render()),
      this.eventBus.on(Events.DOCUMENT_CREATED, () => this.render()),
      this.eventBus.on(Events.DOCUMENT_OPENED, () => this.render())
    );
  }

  handleAction(action) {
    const app = window.photoEditorApp;
    if (!app || !app.document) return;

    const maskManager = getMaskManager();
    const activeLayer = app.document.getActiveLayer();

    switch (action) {
      case 'add':
        app.addLayer();
        break;
      case 'duplicate':
        app.duplicateLayer();
        break;
      case 'delete':
        app.deleteLayer();
        break;
      case 'toggle-adjustment-menu':
        const dropdown = this.shadowRoot.getElementById('adjustment-dropdown');
        dropdown.classList.toggle('visible');
        break;
      case 'add-mask':
        if (activeLayer && !activeLayer.mask) {
          maskManager.addMask(activeLayer.id, true);
        }
        break;
      case 'delete-mask':
        if (activeLayer && activeLayer.mask) {
          maskManager.deleteMask(activeLayer.id);
        }
        break;
      case 'apply-mask':
        if (activeLayer && activeLayer.mask) {
          maskManager.applyMask(activeLayer.id);
        }
        break;
    }
  }

  addAdjustmentLayer(type) {
    const app = window.photoEditorApp;
    if (!app || !app.document) return;

    const doc = app.document;

    // Get default params for this adjustment type
    const defaultParams = AdjustmentDefaults[type] || {};

    // Create adjustment layer with nice name
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

    const layer = createAdjustmentLayer(type, { ...defaultParams });
    layer.name = typeNames[type] || type;

    // Add layer above active layer
    const activeIndex = doc.layers.indexOf(doc.getActiveLayer());
    doc.addLayer(layer, activeIndex + 1);
    doc.setActiveLayer(layer.id);

    // Emit event to open properties panel
    this.eventBus.emit(Events.ADJUSTMENT_LAYER_CREATED, { layer });
    this.eventBus.emit(Events.RENDER_REQUEST);
  }

  selectLayer(layerId) {
    const app = window.photoEditorApp;
    if (!app || !app.document) return;

    app.document.setActiveLayer(layerId);
  }

  toggleLayerVisibility(layerId) {
    const app = window.photoEditorApp;
    if (!app || !app.document) return;

    const layer = app.document.getLayer(layerId);
    if (layer) {
      layer.visible = !layer.visible;
      layer.dirty = true;
      this.eventBus.emit(Events.LAYER_VISIBILITY_CHANGED, { layer });
      this.render();
    }
  }

  updateActiveLayerBlendMode(blendMode) {
    const app = window.photoEditorApp;
    if (!app || !app.document) return;

    const layer = app.document.getActiveLayer();
    if (layer) {
      layer.blendMode = blendMode;
      layer.dirty = true;
      this.eventBus.emit(Events.LAYER_UPDATED, { layer });
    }
  }

  updateActiveLayerOpacity(opacity) {
    const app = window.photoEditorApp;
    if (!app || !app.document) return;

    const layer = app.document.getActiveLayer();
    if (layer) {
      layer.opacity = opacity;
      layer.dirty = true;
      this.eventBus.emit(Events.LAYER_UPDATED, { layer });
    }
  }

  render() {
    const app = window.photoEditorApp;
    const layersList = this.shadowRoot.getElementById('layers-list');

    if (!app || !app.document || app.document.layers.length === 0) {
      layersList.innerHTML = '<div class="empty-state">No layers</div>';
      return;
    }

    const doc = app.document;
    const activeId = doc.activeLayerId;

    // Update blend mode and opacity for active layer
    const activeLayer = doc.getActiveLayer();
    if (activeLayer) {
      this.shadowRoot.getElementById('blend-mode').value = activeLayer.blendMode;
      this.shadowRoot.getElementById('layer-opacity').value = activeLayer.opacity * 100;
      this.shadowRoot.getElementById('opacity-value').textContent =
        `${Math.round(activeLayer.opacity * 100)}%`;
    }

    // Render layers (reverse order - top layer first)
    const layers = [...doc.layers].reverse();
    const maskManager = getMaskManager();
    const editingMaskLayerId = maskManager.getEditingLayerId();

    layersList.innerHTML = layers.map((layer, index) => {
      const hasMask = !!layer.mask;
      const isEditingMask = editingMaskLayerId === layer.id;
      const isClipped = layer.clipped;
      const isAdjustment = layer.type === 'adjustment';
      // Check if this is the bottom layer (can't clip to nothing)
      const isBottomLayer = index === layers.length - 1;

      // Adjustment layer icon based on type
      const adjustmentIcon = layer.adjustment ? this.getAdjustmentIcon(layer.adjustment.type) : '';

      return `
      <div class="layer-item ${layer.id === activeId ? 'selected' : ''} ${isClipped ? 'clipped' : ''} ${isAdjustment ? 'adjustment' : ''}"
           data-id="${layer.id}"
           data-type="${layer.type}">
        <button class="layer-visibility ${layer.visible ? '' : 'hidden'}" title="Toggle Visibility">
          <svg viewBox="0 0 24 24">
            ${layer.visible
              ? '<path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>'
              : '<path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>'
            }
          </svg>
        </button>
        <div class="layer-thumbnails">
          ${isAdjustment ? `
            <div class="layer-thumbnail">
              <svg viewBox="0 0 24 24">${adjustmentIcon}</svg>
            </div>
          ` : `
            <div class="layer-thumbnail" id="thumb-${layer.id}"></div>
          `}
          ${hasMask ? `
            <span class="mask-link ${layer.maskLinked ? '' : 'unlinked'}"
                  data-action="toggle-mask-link"
                  data-layer-id="${layer.id}"
                  title="${layer.maskLinked ? 'Linked' : 'Unlinked'}">
              <svg viewBox="0 0 24 24"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>
            </span>
            <div class="mask-thumbnail ${isEditingMask ? 'editing' : ''} ${layer.maskEnabled ? '' : 'disabled'}"
                 id="mask-thumb-${layer.id}"
                 data-action="edit-mask"
                 data-layer-id="${layer.id}"
                 title="Click to edit mask, Shift+Click to disable">
            </div>
          ` : ''}
        </div>
        <div class="layer-info">
          <div class="layer-name">${layer.name}${isClipped ? '<span class="clip-indicator">⤷</span>' : ''}</div>
          <div class="layer-meta">
            ${isAdjustment ? `<span class="adjustment-type-badge">${layer.adjustment?.type || 'Adjustment'}</span>` : layer.blendMode}${layer.opacity < 1 ? `, ${Math.round(layer.opacity * 100)}%` : ''}${hasMask ? ' • Mask' : ''}${isClipped ? ' • Clipped' : ''}
          </div>
        </div>
      </div>
    `}).join('');

    // Update thumbnails
    requestAnimationFrame(() => {
      layers.forEach(layer => {
        // Layer thumbnail
        const thumbContainer = this.shadowRoot.getElementById(`thumb-${layer.id}`);
        if (thumbContainer && layer.thumbnail) {
          thumbContainer.innerHTML = '';
          const canvas = document.createElement('canvas');
          canvas.width = 40;
          canvas.height = 40;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(layer.thumbnail, 0, 0);
          thumbContainer.appendChild(canvas);
        }

        // Mask thumbnail
        if (layer.mask && layer.mask.thumbnail) {
          const maskThumbContainer = this.shadowRoot.getElementById(`mask-thumb-${layer.id}`);
          if (maskThumbContainer) {
            maskThumbContainer.innerHTML = '';
            const maskCanvas = document.createElement('canvas');
            maskCanvas.width = 32;
            maskCanvas.height = 32;
            const maskCtx = maskCanvas.getContext('2d');
            maskCtx.drawImage(layer.mask.thumbnail, 0, 0);
            maskThumbContainer.appendChild(maskCanvas);
          }
        }
      });
    });
  }

  handleMaskAction(action, layerId, event) {
    const maskManager = getMaskManager();

    switch (action) {
      case 'edit-mask':
        if (event.shiftKey) {
          // Shift+click toggles mask enabled
          maskManager.toggleMaskEnabled(layerId);
        } else {
          // Regular click enters mask editing mode
          if (maskManager.isEditing() && maskManager.getEditingLayerId() === layerId) {
            maskManager.exitMaskEditMode();
          } else {
            maskManager.enterMaskEditMode(layerId);
          }
        }
        this.render();
        break;
      case 'toggle-mask-link':
        maskManager.toggleMaskLinked(layerId);
        this.render();
        break;
    }
  }

  getAdjustmentIcon(type) {
    const icons = {
      'brightness-contrast': '<path d="M20 15.31L23.31 12 20 8.69V4h-4.69L12 .69 8.69 4H4v4.69L.69 12 4 15.31V20h4.69L12 23.31 15.31 20H20v-4.69zM12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"/>',
      'levels': '<path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm2 4v-2H3a2 2 0 002 2zM3 9h2V7H3v2zm12 12h2v-2h-2v2zm4-18H9a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2zm0 12H9V5h10v10zm-8 6h2v-2h-2v2zm-4 0h2v-2H7v2z"/>',
      'curves': '<path d="M16.5 3c-2.49 0-4.5 2.01-4.5 4.5 0 .33.04.66.09.98L5.5 15.5V19h3.5l7.02-6.59c.32.05.65.09.98.09 2.49 0 4.5-2.01 4.5-4.5S18.99 3 16.5 3zm0 7c-1.38 0-2.5-1.12-2.5-2.5S15.12 5 16.5 5 19 6.12 19 7.5 17.88 10 16.5 10z"/>',
      'hue-saturation': '<path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8z"/>',
      'color-balance': '<path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9zm0 16c-3.86 0-7-3.14-7-7s3.14-7 7-7 7 3.14 7 7-3.14 7-7 7z"/>',
      'vibrance': '<path d="M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10 10-4.49 10-10S17.51 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3-8c0 1.66-1.34 3-3 3s-3-1.34-3-3 1.34-3 3-3 3 1.34 3 3z"/>',
      'photo-filter': '<path d="M20 4h-3.17L15 2H9L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h4.05l1.83-2h4.24l1.83 2H20v12zM12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5z"/>',
      'black-white': '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18V4c4.41 0 8 3.59 8 8s-3.59 8-8 8z"/>',
      'invert': '<path d="M17.66 7.93L12 2.27 6.34 7.93c-3.12 3.12-3.12 8.19 0 11.31C7.9 20.8 9.95 21.58 12 21.58c2.05 0 4.1-.78 5.66-2.34 3.12-3.12 3.12-8.19 0-11.31zM12 19.59c-1.6 0-3.11-.62-4.24-1.76C6.62 16.69 6 15.19 6 13.59s.62-3.11 1.76-4.24L12 5.1v14.49z"/>',
      'posterize': '<path d="M3 5H1v16c0 1.1.9 2 2 2h16v-2H3V5zm18-4H7c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V3c0-1.1-.9-2-2-2zm0 16H7V3h14v14z"/>',
      'threshold': '<path d="M12 4c4.41 0 8 3.59 8 8s-3.59 8-8 8-8-3.59-8-8 3.59-8 8-8m0-2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14c-2.21 0-4-1.79-4-4h8c0 2.21-1.79 4-4 4z"/>'
    };
    return icons[type] || '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>';
  }
}

customElements.define('layers-panel', LayersPanel);
