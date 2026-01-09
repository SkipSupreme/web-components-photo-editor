/**
 * Layers Panel - Displays and manages document layers
 */

import { getStore } from '../../core/store.js';
import { getEventBus, Events } from '../../core/event-bus.js';

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
      cursor: pointer;
      border-bottom: 1px solid var(--border-color);
      transition: background-color 0.15s;
    }

    .layer-item:hover {
      background: var(--layer-hover);
    }

    .layer-item.selected {
      background: var(--layer-selected);
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
  </style>

  <div class="panel-header">
    <span class="panel-title">Layers</span>
    <div class="panel-actions">
      <button class="action-btn" data-action="add" title="New Layer">
        <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
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

      if (visibilityBtn && layerItem) {
        e.stopPropagation();
        this.toggleLayerVisibility(layerItem.dataset.id);
        return;
      }

      if (layerItem) {
        this.selectLayer(layerItem.dataset.id);
      }
    });
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
    }
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

    layersList.innerHTML = layers.map(layer => `
      <div class="layer-item ${layer.id === activeId ? 'selected' : ''}"
           data-id="${layer.id}">
        <button class="layer-visibility ${layer.visible ? '' : 'hidden'}" title="Toggle Visibility">
          <svg viewBox="0 0 24 24">
            ${layer.visible
              ? '<path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>'
              : '<path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>'
            }
          </svg>
        </button>
        <div class="layer-thumbnail" id="thumb-${layer.id}"></div>
        <div class="layer-info">
          <div class="layer-name">${layer.name}</div>
          <div class="layer-meta">${layer.blendMode}${layer.opacity < 1 ? `, ${Math.round(layer.opacity * 100)}%` : ''}</div>
        </div>
      </div>
    `).join('');

    // Update thumbnails
    requestAnimationFrame(() => {
      layers.forEach(layer => {
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
      });
    });
  }
}

customElements.define('layers-panel', LayersPanel);
