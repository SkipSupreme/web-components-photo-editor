/**
 * New Document Dialog - Dialog for creating new documents with size presets
 */

import { getEventBus, Events } from '../../core/event-bus.js';

const PRESETS = [
  { name: 'HD 1920x1080', width: 1920, height: 1080 },
  { name: '4K 3840x2160', width: 3840, height: 2160 },
  { name: 'Instagram Square 1080x1080', width: 1080, height: 1080 },
  { name: 'Instagram Story 1080x1920', width: 1080, height: 1920 },
  { name: 'Twitter Header 1500x500', width: 1500, height: 500 },
  { name: 'A4 Print (300dpi) 2480x3508', width: 2480, height: 3508 },
  { name: 'Letter Print (300dpi) 2550x3300', width: 2550, height: 3300 },
  { name: 'Web Banner 728x90', width: 728, height: 90 },
  { name: 'Custom', width: 0, height: 0, custom: true }
];

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: contents;
    }

    .dialog-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.2s, visibility 0.2s;
    }

    .dialog-backdrop.visible {
      opacity: 1;
      visibility: visible;
    }

    .dialog {
      background: var(--bg-panel, #2a2a2a);
      border: 1px solid var(--border-color, #444);
      border-radius: 8px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      min-width: 400px;
      max-width: 450px;
      transform: translateY(-20px);
      transition: transform 0.2s;
    }

    .dialog-backdrop.visible .dialog {
      transform: translateY(0);
    }

    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid var(--border-color, #444);
    }

    .dialog-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary, #fff);
    }

    .close-btn {
      width: 28px;
      height: 28px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-secondary, #888);
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
      background: transparent;
      border: none;
    }

    .close-btn:hover {
      background: var(--bg-hover, #333);
      color: var(--text-primary, #fff);
    }

    .close-btn svg {
      width: 18px;
      height: 18px;
      fill: currentColor;
    }

    .dialog-content {
      padding: 20px;
    }

    .form-group {
      margin-bottom: 16px;
    }

    .form-label {
      display: block;
      margin-bottom: 6px;
      font-size: 12px;
      font-weight: 500;
      color: var(--text-secondary, #888);
    }

    input, select {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid var(--border-color, #444);
      border-radius: 4px;
      background: var(--bg-input, #1a1a1a);
      color: var(--text-primary, #fff);
      font-size: 13px;
    }

    input:focus, select:focus {
      outline: none;
      border-color: var(--accent-color, #3b82f6);
    }

    .size-inputs {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      gap: 10px;
      align-items: center;
    }

    .size-inputs span {
      color: var(--text-secondary, #888);
      font-size: 14px;
    }

    .color-row {
      display: flex;
      gap: 10px;
      align-items: center;
    }

    .color-preview {
      width: 40px;
      height: 32px;
      border-radius: 4px;
      border: 1px solid var(--border-color, #444);
      cursor: pointer;
    }

    .color-input {
      flex: 1;
    }

    .checkbox-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 8px;
    }

    .checkbox-row input {
      width: auto;
    }

    .checkbox-row label {
      font-size: 13px;
      color: var(--text-primary, #fff);
    }

    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 16px 20px;
      border-top: 1px solid var(--border-color, #444);
    }

    .btn {
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s;
      border: none;
    }

    .btn-secondary {
      background: var(--bg-secondary, #333);
      color: var(--text-primary, #fff);
      border: 1px solid var(--border-color, #444);
    }

    .btn-secondary:hover {
      background: var(--bg-hover, #3a3a3a);
    }

    .btn-primary {
      background: var(--accent-color, #3b82f6);
      color: #fff;
    }

    .btn-primary:hover {
      background: var(--accent-hover, #2563eb);
    }
  </style>

  <div class="dialog-backdrop">
    <div class="dialog">
      <div class="dialog-header">
        <span class="dialog-title">New Document</span>
        <button class="close-btn">
          <svg viewBox="0 0 24 24">
            <path d="M18.3 5.7a1 1 0 00-1.4 0L12 10.6 7.1 5.7a1 1 0 00-1.4 1.4L10.6 12l-4.9 4.9a1 1 0 101.4 1.4l4.9-4.9 4.9 4.9a1 1 0 001.4-1.4L13.4 12l4.9-4.9a1 1 0 000-1.4z"/>
          </svg>
        </button>
      </div>
      <div class="dialog-content">
        <div class="form-group">
          <label class="form-label">Name</label>
          <input type="text" id="doc-name" value="Untitled" />
        </div>

        <div class="form-group">
          <label class="form-label">Preset</label>
          <select id="preset">
            ${PRESETS.map((p, i) => `<option value="${i}">${p.name}</option>`).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Size (pixels)</label>
          <div class="size-inputs">
            <input type="number" id="width" value="1920" min="1" max="16000" />
            <span>x</span>
            <input type="number" id="height" value="1080" min="1" max="16000" />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Background</label>
          <div class="color-row">
            <input type="color" class="color-preview" id="bg-color" value="#ffffff" />
            <input type="text" class="color-input" id="bg-color-text" value="#ffffff" />
          </div>
          <div class="checkbox-row">
            <input type="checkbox" id="transparent" />
            <label for="transparent">Transparent background</label>
          </div>
        </div>
      </div>
      <div class="dialog-footer">
        <button class="btn btn-secondary" id="cancel">Cancel</button>
        <button class="btn btn-primary" id="create">Create</button>
      </div>
    </div>
  </div>
`;

class NewDocumentDialog extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));
    this.eventBus = getEventBus();
  }

  connectedCallback() {
    this.setupElements();
    this.setupEventListeners();
  }

  setupElements() {
    this.backdrop = this.shadowRoot.querySelector('.dialog-backdrop');
    this.nameInput = this.shadowRoot.querySelector('#doc-name');
    this.presetSelect = this.shadowRoot.querySelector('#preset');
    this.widthInput = this.shadowRoot.querySelector('#width');
    this.heightInput = this.shadowRoot.querySelector('#height');
    this.bgColorPreview = this.shadowRoot.querySelector('#bg-color');
    this.bgColorText = this.shadowRoot.querySelector('#bg-color-text');
    this.transparentCheck = this.shadowRoot.querySelector('#transparent');
  }

  setupEventListeners() {
    // Close button
    this.shadowRoot.querySelector('.close-btn').addEventListener('click', () => this.hide());
    this.shadowRoot.querySelector('#cancel').addEventListener('click', () => this.hide());

    // Backdrop click
    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop) this.hide();
    });

    // Create button
    this.shadowRoot.querySelector('#create').addEventListener('click', () => this.create());

    // Preset selection
    this.presetSelect.addEventListener('change', () => {
      const preset = PRESETS[parseInt(this.presetSelect.value)];
      if (!preset.custom) {
        this.widthInput.value = preset.width;
        this.heightInput.value = preset.height;
      }
    });

    // Color sync
    this.bgColorPreview.addEventListener('input', () => {
      this.bgColorText.value = this.bgColorPreview.value;
    });

    this.bgColorText.addEventListener('input', () => {
      if (/^#[0-9a-fA-F]{6}$/.test(this.bgColorText.value)) {
        this.bgColorPreview.value = this.bgColorText.value;
      }
    });

    // Transparent checkbox
    this.transparentCheck.addEventListener('change', () => {
      this.bgColorPreview.disabled = this.transparentCheck.checked;
      this.bgColorText.disabled = this.transparentCheck.checked;
    });

    // Keyboard
    this.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.hide();
      if (e.key === 'Enter') this.create();
    });
  }

  show() {
    this.backdrop.classList.add('visible');
    this.nameInput.focus();
    this.nameInput.select();
  }

  hide() {
    this.backdrop.classList.remove('visible');
  }

  create() {
    const options = {
      name: this.nameInput.value || 'Untitled',
      width: parseInt(this.widthInput.value) || 1920,
      height: parseInt(this.heightInput.value) || 1080,
      backgroundColor: this.bgColorText.value || '#ffffff',
      transparentBackground: this.transparentCheck.checked
    };

    // Validate
    if (options.width < 1 || options.width > 16000 ||
        options.height < 1 || options.height > 16000) {
      alert('Size must be between 1 and 16000 pixels');
      return;
    }

    this.eventBus.emit('new-document:create', options);
    this.hide();
  }
}

customElements.define('new-document-dialog', NewDocumentDialog);

// Singleton instance
let dialogInstance = null;

/**
 * Show the new document dialog
 */
export function showNewDocumentDialog() {
  if (!dialogInstance) {
    dialogInstance = document.createElement('new-document-dialog');
    document.body.appendChild(dialogInstance);
  }
  dialogInstance.show();
}

export { NewDocumentDialog };
