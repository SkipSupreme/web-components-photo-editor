/**
 * Export Dialog - Dialog for exporting documents with format options
 */

import { getEventBus, Events } from '../../core/event-bus.js';
import { ExportFormat, exportDocument, exportResized, estimateFileSize } from '../../io/image-export.js';
import { exportAndSavePSD, estimatePSDSize, validateForPSDExport } from '../../io/psd/psd-export.js';

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
      max-width: 500px;
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

    .format-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }

    .format-option {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 12px;
      border: 2px solid var(--border-color, #444);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.15s;
    }

    .format-option:hover {
      border-color: var(--text-secondary, #888);
    }

    .format-option.selected {
      border-color: var(--accent-color, #3b82f6);
      background: rgba(59, 130, 246, 0.1);
    }

    .format-icon {
      font-size: 24px;
      margin-bottom: 4px;
    }

    .format-name {
      font-size: 12px;
      font-weight: 500;
      color: var(--text-primary, #fff);
    }

    .format-ext {
      font-size: 10px;
      color: var(--text-secondary, #888);
    }

    .slider-group {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .slider-group input[type="range"] {
      flex: 1;
      height: 4px;
      border-radius: 2px;
      background: var(--bg-input, #333);
      -webkit-appearance: none;
    }

    .slider-group input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: var(--accent-color, #3b82f6);
      cursor: pointer;
    }

    .slider-value {
      min-width: 40px;
      text-align: right;
      font-size: 12px;
      color: var(--text-primary, #fff);
    }

    .size-options {
      display: flex;
      gap: 8px;
    }

    .size-input {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .size-input input {
      width: 80px;
      padding: 6px 8px;
      background: var(--bg-input, #333);
      border: 1px solid var(--border-color, #444);
      border-radius: 4px;
      color: var(--text-primary, #fff);
      font-size: 12px;
    }

    .size-input label {
      font-size: 11px;
      color: var(--text-secondary, #888);
    }

    .checkbox-group {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: var(--text-primary, #fff);
      cursor: pointer;
    }

    .file-info {
      padding: 12px;
      background: var(--bg-secondary, #333);
      border-radius: 6px;
      font-size: 12px;
    }

    .file-info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
    }

    .file-info-row:last-child {
      margin-bottom: 0;
    }

    .file-info-label {
      color: var(--text-secondary, #888);
    }

    .file-info-value {
      color: var(--text-primary, #fff);
      font-weight: 500;
    }

    .warnings {
      margin-top: 12px;
      padding: 8px 12px;
      background: rgba(245, 158, 11, 0.1);
      border: 1px solid rgba(245, 158, 11, 0.3);
      border-radius: 4px;
      font-size: 11px;
      color: #f59e0b;
    }

    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 16px 20px;
      border-top: 1px solid var(--border-color, #444);
    }

    .btn {
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
    }

    .btn-secondary {
      background: transparent;
      border: 1px solid var(--border-color, #444);
      color: var(--text-primary, #fff);
    }

    .btn-secondary:hover {
      background: var(--bg-hover, #333);
    }

    .btn-primary {
      background: var(--accent-color, #3b82f6);
      border: 1px solid var(--accent-color, #3b82f6);
      color: white;
    }

    .btn-primary:hover {
      background: #2563eb;
      border-color: #2563eb;
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  </style>

  <div class="dialog-backdrop">
    <div class="dialog">
      <div class="dialog-header">
        <span class="dialog-title">Export Image</span>
        <button class="close-btn" id="close-btn">
          <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>
      </div>

      <div class="dialog-content">
        <div class="form-group">
          <label class="form-label">Format</label>
          <div class="format-grid" id="format-grid">
            <div class="format-option selected" data-format="image/png">
              <span class="format-icon">🖼️</span>
              <span class="format-name">PNG</span>
              <span class="format-ext">.png</span>
            </div>
            <div class="format-option" data-format="image/jpeg">
              <span class="format-icon">📷</span>
              <span class="format-name">JPEG</span>
              <span class="format-ext">.jpg</span>
            </div>
            <div class="format-option" data-format="image/webp">
              <span class="format-icon">🌐</span>
              <span class="format-name">WebP</span>
              <span class="format-ext">.webp</span>
            </div>
            <div class="format-option" data-format="psd">
              <span class="format-icon">📄</span>
              <span class="format-name">PSD</span>
              <span class="format-ext">.psd</span>
            </div>
          </div>
        </div>

        <div class="form-group" id="quality-group">
          <label class="form-label">Quality</label>
          <div class="slider-group">
            <input type="range" id="quality-slider" min="0" max="100" value="92">
            <span class="slider-value" id="quality-value">92%</span>
          </div>
        </div>

        <div class="form-group" id="size-group">
          <label class="form-label">Size</label>
          <div class="size-options">
            <div class="size-input">
              <input type="number" id="width-input" min="1" max="16384">
              <label>Width</label>
            </div>
            <div class="size-input">
              <input type="number" id="height-input" min="1" max="16384">
              <label>Height</label>
            </div>
          </div>
          <label class="checkbox-group" style="margin-top: 8px;">
            <input type="checkbox" id="maintain-aspect" checked>
            Maintain aspect ratio
          </label>
        </div>

        <div class="form-group">
          <div class="file-info" id="file-info">
            <div class="file-info-row">
              <span class="file-info-label">Dimensions:</span>
              <span class="file-info-value" id="info-dimensions">1920 × 1080</span>
            </div>
            <div class="file-info-row">
              <span class="file-info-label">Estimated size:</span>
              <span class="file-info-value" id="info-size">Calculating...</span>
            </div>
          </div>
          <div class="warnings" id="warnings" style="display: none;"></div>
        </div>
      </div>

      <div class="dialog-footer">
        <button class="btn btn-secondary" id="cancel-btn">Cancel</button>
        <button class="btn btn-primary" id="export-btn">Export</button>
      </div>
    </div>
  </div>
`;

export class ExportDialog extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this.document = null;
    this.selectedFormat = 'image/png';
    this.quality = 92;
    this.originalWidth = 0;
    this.originalHeight = 0;
    this.aspectRatio = 1;
  }

  connectedCallback() {
    this.setupEventListeners();
  }

  setupEventListeners() {
    const backdrop = this.shadowRoot.querySelector('.dialog-backdrop');
    const closeBtn = this.shadowRoot.getElementById('close-btn');
    const cancelBtn = this.shadowRoot.getElementById('cancel-btn');
    const exportBtn = this.shadowRoot.getElementById('export-btn');
    const formatGrid = this.shadowRoot.getElementById('format-grid');
    const qualitySlider = this.shadowRoot.getElementById('quality-slider');
    const widthInput = this.shadowRoot.getElementById('width-input');
    const heightInput = this.shadowRoot.getElementById('height-input');
    const maintainAspect = this.shadowRoot.getElementById('maintain-aspect');

    // Close handlers
    closeBtn.addEventListener('click', () => this.close());
    cancelBtn.addEventListener('click', () => this.close());
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) this.close();
    });

    // Format selection
    formatGrid.addEventListener('click', (e) => {
      const option = e.target.closest('.format-option');
      if (!option) return;

      formatGrid.querySelectorAll('.format-option').forEach(opt => {
        opt.classList.remove('selected');
      });
      option.classList.add('selected');

      this.selectedFormat = option.dataset.format;
      this.updateUIForFormat();
      this.updateEstimate();
    });

    // Quality slider
    qualitySlider.addEventListener('input', (e) => {
      this.quality = parseInt(e.target.value);
      this.shadowRoot.getElementById('quality-value').textContent = `${this.quality}%`;
      this.updateEstimate();
    });

    // Size inputs
    widthInput.addEventListener('input', () => {
      if (maintainAspect.checked) {
        const width = parseInt(widthInput.value) || this.originalWidth;
        heightInput.value = Math.round(width / this.aspectRatio);
      }
      this.updateEstimate();
    });

    heightInput.addEventListener('input', () => {
      if (maintainAspect.checked) {
        const height = parseInt(heightInput.value) || this.originalHeight;
        widthInput.value = Math.round(height * this.aspectRatio);
      }
      this.updateEstimate();
    });

    // Export button
    exportBtn.addEventListener('click', () => this.doExport());

    // Keyboard shortcuts
    this.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.close();
      } else if (e.key === 'Enter' && !e.target.matches('input')) {
        this.doExport();
      }
    });
  }

  open(document) {
    this.document = document;
    this.originalWidth = document.width;
    this.originalHeight = document.height;
    this.aspectRatio = document.width / document.height;

    // Set initial values
    this.shadowRoot.getElementById('width-input').value = document.width;
    this.shadowRoot.getElementById('height-input').value = document.height;
    this.shadowRoot.getElementById('info-dimensions').textContent =
      `${document.width} × ${document.height}`;

    this.updateUIForFormat();
    this.updateEstimate();

    const backdrop = this.shadowRoot.querySelector('.dialog-backdrop');
    backdrop.classList.add('visible');

    this.focus();
  }

  close() {
    const backdrop = this.shadowRoot.querySelector('.dialog-backdrop');
    backdrop.classList.remove('visible');
    this.document = null;
  }

  updateUIForFormat() {
    const qualityGroup = this.shadowRoot.getElementById('quality-group');
    const sizeGroup = this.shadowRoot.getElementById('size-group');

    // Show/hide quality slider based on format
    if (this.selectedFormat === 'image/png' || this.selectedFormat === 'psd') {
      qualityGroup.style.display = 'none';
    } else {
      qualityGroup.style.display = 'block';
    }

    // Hide size options for PSD
    if (this.selectedFormat === 'psd') {
      sizeGroup.style.display = 'none';
    } else {
      sizeGroup.style.display = 'block';
    }
  }

  async updateEstimate() {
    if (!this.document) return;

    const sizeSpan = this.shadowRoot.getElementById('info-size');
    const warningsDiv = this.shadowRoot.getElementById('warnings');
    sizeSpan.textContent = 'Calculating...';
    warningsDiv.style.display = 'none';

    try {
      let estimate;

      if (this.selectedFormat === 'psd') {
        estimate = estimatePSDSize(this.document);
        sizeSpan.textContent = estimate.formatted;

        // Check for warnings
        const validation = validateForPSDExport(this.document);
        if (validation.warnings.length > 0) {
          warningsDiv.textContent = validation.warnings.join('. ');
          warningsDiv.style.display = 'block';
        }
      } else {
        estimate = await estimateFileSize(this.document, this.selectedFormat, {
          quality: this.quality / 100
        });
        sizeSpan.textContent = estimate.formatted;
      }
    } catch (error) {
      sizeSpan.textContent = 'Unable to estimate';
    }
  }

  async doExport() {
    if (!this.document) return;

    const exportBtn = this.shadowRoot.getElementById('export-btn');
    exportBtn.disabled = true;
    exportBtn.textContent = 'Exporting...';

    try {
      const width = parseInt(this.shadowRoot.getElementById('width-input').value);
      const height = parseInt(this.shadowRoot.getElementById('height-input').value);
      const resized = width !== this.originalWidth || height !== this.originalHeight;

      if (this.selectedFormat === 'psd') {
        await exportAndSavePSD(this.document);
      } else {
        if (resized) {
          // Export with resize
          const blob = await exportResized(
            this.document,
            { width, height },
            this.selectedFormat,
            { quality: this.quality / 100 }
          );
          await this.saveBlob(blob);
        } else {
          await exportDocument(this.document, this.selectedFormat, {
            quality: this.quality / 100
          });
        }
      }

      this.close();
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Export failed:', error);
        alert('Export failed: ' + error.message);
      }
    } finally {
      exportBtn.disabled = false;
      exportBtn.textContent = 'Export';
    }
  }

  async saveBlob(blob) {
    const ext = this.getExtension();
    const suggestedName = `${this.document.name}.${ext}`;

    if ('showSaveFilePicker' in window) {
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [{
          description: `${ext.toUpperCase()} Image`,
          accept: { [this.selectedFormat]: [`.${ext}`] }
        }]
      });

      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = suggestedName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }
  }

  getExtension() {
    const extensions = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/webp': 'webp',
      'psd': 'psd'
    };
    return extensions[this.selectedFormat] || 'png';
  }
}

customElements.define('export-dialog', ExportDialog);

/**
 * Show the export dialog
 * @param {Document} document - The document to export
 */
export function showExportDialog(document) {
  let dialog = window.document.querySelector('export-dialog');
  if (!dialog) {
    dialog = window.document.createElement('export-dialog');
    window.document.body.appendChild(dialog);
  }
  dialog.open(document);
}
