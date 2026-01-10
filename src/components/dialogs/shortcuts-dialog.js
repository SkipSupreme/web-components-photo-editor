/**
 * Shortcuts Dialog - Keyboard shortcut customization
 * Allows users to view and customize keyboard shortcuts
 */

import { getEventBus, Events } from '../../core/event-bus.js';
import { getShortcuts } from '../../core/shortcuts.js';
import { saveSetting, getSetting } from '../../storage/project-store.js';

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
      background: rgba(0, 0, 0, 0.7);
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
      border-radius: 12px;
      box-shadow: 0 12px 48px rgba(0, 0, 0, 0.5);
      width: 700px;
      max-width: 90vw;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      transform: translateY(-20px) scale(0.95);
      transition: transform 0.2s;
    }

    .dialog-backdrop.visible .dialog {
      transform: translateY(0) scale(1);
    }

    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 24px;
      border-bottom: 1px solid var(--border-color, #444);
    }

    .dialog-title {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-primary, #fff);
    }

    .close-btn {
      width: 32px;
      height: 32px;
      border: none;
      background: transparent;
      border-radius: 6px;
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
      width: 20px;
      height: 20px;
      fill: currentColor;
    }

    /* Search */
    .search-container {
      padding: 16px 24px;
      border-bottom: 1px solid var(--border-color, #444);
    }

    .search-input {
      width: 100%;
      padding: 10px 14px;
      background: var(--bg-input, #333);
      border: 1px solid var(--border-color, #444);
      border-radius: 6px;
      color: var(--text-primary, #fff);
      font-size: 14px;
    }

    .search-input::placeholder {
      color: var(--text-secondary, #888);
    }

    .search-input:focus {
      outline: none;
      border-color: var(--accent-color, #3b82f6);
    }

    /* Content */
    .dialog-content {
      flex: 1;
      overflow-y: auto;
      padding: 0;
    }

    /* Category */
    .category {
      border-bottom: 1px solid var(--border-color, #444);
    }

    .category:last-child {
      border-bottom: none;
    }

    .category-header {
      display: flex;
      align-items: center;
      padding: 12px 24px;
      background: var(--bg-secondary, #333);
      cursor: pointer;
      user-select: none;
    }

    .category-header:hover {
      background: var(--bg-hover, #3a3a3a);
    }

    .category-arrow {
      width: 16px;
      height: 16px;
      fill: var(--text-secondary, #888);
      margin-right: 8px;
      transition: transform 0.2s;
    }

    .category.collapsed .category-arrow {
      transform: rotate(-90deg);
    }

    .category-name {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-secondary, #888);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .category-content {
      max-height: 1000px;
      overflow: hidden;
      transition: max-height 0.3s;
    }

    .category.collapsed .category-content {
      max-height: 0;
    }

    /* Shortcut row */
    .shortcut-row {
      display: flex;
      align-items: center;
      padding: 10px 24px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }

    .shortcut-row:last-child {
      border-bottom: none;
    }

    .shortcut-row:hover {
      background: rgba(255, 255, 255, 0.02);
    }

    .shortcut-action {
      flex: 1;
      font-size: 13px;
      color: var(--text-primary, #fff);
    }

    .shortcut-keys {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .key {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 24px;
      height: 24px;
      padding: 0 8px;
      background: var(--bg-input, #333);
      border: 1px solid var(--border-color, #444);
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
      color: var(--text-primary, #fff);
      font-family: monospace;
    }

    .key-separator {
      color: var(--text-secondary, #888);
      font-size: 11px;
    }

    .edit-btn {
      margin-left: 12px;
      width: 28px;
      height: 28px;
      border: none;
      background: transparent;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-secondary, #888);
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.15s, background 0.15s;
    }

    .shortcut-row:hover .edit-btn {
      opacity: 1;
    }

    .edit-btn:hover {
      background: var(--bg-hover, #333);
      color: var(--accent-color, #3b82f6);
    }

    .edit-btn svg {
      width: 14px;
      height: 14px;
      fill: currentColor;
    }

    /* Recording state */
    .shortcut-row.recording {
      background: rgba(59, 130, 246, 0.1);
    }

    .shortcut-row.recording .shortcut-keys {
      display: none;
    }

    .recording-indicator {
      display: none;
      padding: 6px 12px;
      background: var(--accent-color, #3b82f6);
      border-radius: 4px;
      font-size: 12px;
      color: white;
      animation: pulse 1.5s infinite;
    }

    .shortcut-row.recording .recording-indicator {
      display: block;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }

    /* Footer */
    .dialog-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      border-top: 1px solid var(--border-color, #444);
    }

    .btn {
      padding: 10px 20px;
      border-radius: 6px;
      font-size: 14px;
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

    .btn-text {
      background: transparent;
      border: none;
      color: var(--text-secondary, #888);
      padding: 10px 16px;
    }

    .btn-text:hover {
      color: var(--text-primary, #fff);
    }
  </style>

  <div class="dialog-backdrop">
    <div class="dialog">
      <div class="dialog-header">
        <span class="dialog-title">Keyboard Shortcuts</span>
        <button class="close-btn" id="close-btn">
          <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>
      </div>

      <div class="search-container">
        <input type="text" class="search-input" id="search-input" placeholder="Search shortcuts...">
      </div>

      <div class="dialog-content" id="content">
        <!-- Shortcuts populated dynamically -->
      </div>

      <div class="dialog-footer">
        <button class="btn btn-text" id="reset-btn">Reset to Defaults</button>
        <div>
          <button class="btn btn-secondary" id="cancel-btn">Cancel</button>
          <button class="btn btn-primary" id="save-btn">Save Changes</button>
        </div>
      </div>
    </div>
  </div>
`;

// Shortcut categories and defaults
const SHORTCUT_CATEGORIES = {
  tools: {
    name: 'Tools',
    shortcuts: [
      { id: 'tool.brush', action: 'Brush Tool', default: 'B' },
      { id: 'tool.eraser', action: 'Eraser Tool', default: 'E' },
      { id: 'tool.move', action: 'Move Tool', default: 'V' },
      { id: 'tool.marquee', action: 'Marquee Selection', default: 'M' },
      { id: 'tool.lasso', action: 'Lasso Selection', default: 'L' },
      { id: 'tool.wand', action: 'Magic Wand', default: 'W' },
      { id: 'tool.eyedropper', action: 'Eyedropper', default: 'I' },
      { id: 'tool.fill', action: 'Fill Tool', default: 'G' },
      { id: 'tool.gradient', action: 'Gradient Tool', default: 'Shift+G' },
      { id: 'tool.crop', action: 'Crop Tool', default: 'C' }
    ]
  },
  file: {
    name: 'File',
    shortcuts: [
      { id: 'file.new', action: 'New Document', default: 'Ctrl+N' },
      { id: 'file.open', action: 'Open File', default: 'Ctrl+O' },
      { id: 'file.save', action: 'Save', default: 'Ctrl+S' },
      { id: 'file.export', action: 'Export', default: 'Ctrl+Shift+E' }
    ]
  },
  edit: {
    name: 'Edit',
    shortcuts: [
      { id: 'edit.undo', action: 'Undo', default: 'Ctrl+Z' },
      { id: 'edit.redo', action: 'Redo', default: 'Ctrl+Shift+Z' },
      { id: 'edit.cut', action: 'Cut', default: 'Ctrl+X' },
      { id: 'edit.copy', action: 'Copy', default: 'Ctrl+C' },
      { id: 'edit.paste', action: 'Paste', default: 'Ctrl+V' },
      { id: 'edit.delete', action: 'Delete', default: 'Delete' },
      { id: 'edit.transform', action: 'Free Transform', default: 'Ctrl+T' }
    ]
  },
  selection: {
    name: 'Selection',
    shortcuts: [
      { id: 'select.all', action: 'Select All', default: 'Ctrl+A' },
      { id: 'select.deselect', action: 'Deselect', default: 'Ctrl+D' },
      { id: 'select.inverse', action: 'Inverse Selection', default: 'Ctrl+Shift+I' }
    ]
  },
  view: {
    name: 'View',
    shortcuts: [
      { id: 'view.zoomIn', action: 'Zoom In', default: 'Ctrl+=' },
      { id: 'view.zoomOut', action: 'Zoom Out', default: 'Ctrl+-' },
      { id: 'view.fit', action: 'Fit to Screen', default: 'Ctrl+0' },
      { id: 'view.actualSize', action: 'Actual Size', default: 'Ctrl+1' }
    ]
  },
  brush: {
    name: 'Brush',
    shortcuts: [
      { id: 'brush.sizeUp', action: 'Increase Size', default: ']' },
      { id: 'brush.sizeDown', action: 'Decrease Size', default: '[' },
      { id: 'brush.opacityUp', action: 'Increase Opacity', default: 'Shift+]' },
      { id: 'brush.opacityDown', action: 'Decrease Opacity', default: 'Shift+[' }
    ]
  },
  colors: {
    name: 'Colors',
    shortcuts: [
      { id: 'color.swap', action: 'Swap Colors', default: 'X' },
      { id: 'color.reset', action: 'Reset Colors', default: 'D' }
    ]
  }
};

export class ShortcutsDialog extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this.customShortcuts = {};
    this.recordingId = null;
  }

  connectedCallback() {
    this.setupEventListeners();
  }

  setupEventListeners() {
    const backdrop = this.shadowRoot.querySelector('.dialog-backdrop');
    const closeBtn = this.shadowRoot.getElementById('close-btn');
    const cancelBtn = this.shadowRoot.getElementById('cancel-btn');
    const saveBtn = this.shadowRoot.getElementById('save-btn');
    const resetBtn = this.shadowRoot.getElementById('reset-btn');
    const searchInput = this.shadowRoot.getElementById('search-input');

    closeBtn.addEventListener('click', () => this.close());
    cancelBtn.addEventListener('click', () => this.close());
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) this.close();
    });

    saveBtn.addEventListener('click', () => this.saveAndClose());
    resetBtn.addEventListener('click', () => this.resetToDefaults());

    searchInput.addEventListener('input', (e) => this.filterShortcuts(e.target.value));

    // Global keyboard listener for recording
    this.keyHandler = (e) => this.handleKeyDown(e);
  }

  async open() {
    // Load custom shortcuts
    this.customShortcuts = await getSetting('customShortcuts', {});

    this.render();

    const backdrop = this.shadowRoot.querySelector('.dialog-backdrop');
    backdrop.classList.add('visible');

    this.shadowRoot.getElementById('search-input').focus();
  }

  close() {
    this.stopRecording();
    const backdrop = this.shadowRoot.querySelector('.dialog-backdrop');
    backdrop.classList.remove('visible');
  }

  async saveAndClose() {
    await saveSetting('customShortcuts', this.customShortcuts);

    // Apply shortcuts to manager
    const shortcuts = getShortcuts();
    shortcuts.loadCustomShortcuts(this.customShortcuts);

    getEventBus().emit('shortcuts:updated', this.customShortcuts);

    this.close();
  }

  resetToDefaults() {
    if (!confirm('Reset all shortcuts to defaults?')) return;

    this.customShortcuts = {};
    this.render();
  }

  render() {
    const content = this.shadowRoot.getElementById('content');
    content.innerHTML = '';

    for (const [categoryId, category] of Object.entries(SHORTCUT_CATEGORIES)) {
      const categoryEl = document.createElement('div');
      categoryEl.className = 'category';
      categoryEl.innerHTML = `
        <div class="category-header" data-category="${categoryId}">
          <svg class="category-arrow" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>
          <span class="category-name">${category.name}</span>
        </div>
        <div class="category-content">
          ${category.shortcuts.map(shortcut => this.renderShortcutRow(shortcut)).join('')}
        </div>
      `;

      // Toggle collapse
      const header = categoryEl.querySelector('.category-header');
      header.addEventListener('click', () => {
        categoryEl.classList.toggle('collapsed');
      });

      content.appendChild(categoryEl);
    }

    // Attach row listeners
    content.querySelectorAll('.shortcut-row').forEach(row => {
      const editBtn = row.querySelector('.edit-btn');
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.startRecording(row.dataset.id);
      });
    });
  }

  renderShortcutRow(shortcut) {
    const currentKeys = this.customShortcuts[shortcut.id] || shortcut.default;
    const keys = this.formatKeys(currentKeys);

    return `
      <div class="shortcut-row" data-id="${shortcut.id}">
        <span class="shortcut-action">${shortcut.action}</span>
        <div class="shortcut-keys">${keys}</div>
        <div class="recording-indicator">Press new shortcut...</div>
        <button class="edit-btn" title="Edit shortcut">
          <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
        </button>
      </div>
    `;
  }

  formatKeys(shortcut) {
    if (!shortcut) return '<span class="key">None</span>';

    return shortcut.split('+').map(key => {
      const displayKey = key.trim()
        .replace('Ctrl', 'Ctrl')
        .replace('Shift', 'Shift')
        .replace('Alt', 'Alt')
        .replace('Meta', 'Cmd');
      return `<span class="key">${displayKey}</span>`;
    }).join('<span class="key-separator">+</span>');
  }

  startRecording(shortcutId) {
    this.stopRecording();

    this.recordingId = shortcutId;
    const row = this.shadowRoot.querySelector(`[data-id="${shortcutId}"]`);
    if (row) {
      row.classList.add('recording');
    }

    document.addEventListener('keydown', this.keyHandler);
  }

  stopRecording() {
    if (this.recordingId) {
      const row = this.shadowRoot.querySelector(`[data-id="${this.recordingId}"]`);
      if (row) {
        row.classList.remove('recording');
      }
      this.recordingId = null;
    }

    document.removeEventListener('keydown', this.keyHandler);
  }

  handleKeyDown(e) {
    if (!this.recordingId) return;

    e.preventDefault();
    e.stopPropagation();

    // Ignore modifier-only keys
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
      return;
    }

    // Build shortcut string
    const parts = [];
    if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
    if (e.shiftKey) parts.push('Shift');
    if (e.altKey) parts.push('Alt');

    // Get key name
    let key = e.key;
    if (key === ' ') key = 'Space';
    else if (key.length === 1) key = key.toUpperCase();

    parts.push(key);

    const shortcut = parts.join('+');

    // Check for conflicts
    const conflict = this.findConflict(shortcut, this.recordingId);
    if (conflict) {
      if (!confirm(`"${shortcut}" is already assigned to "${conflict.action}". Replace it?`)) {
        this.stopRecording();
        return;
      }
      // Remove from conflicting shortcut
      delete this.customShortcuts[conflict.id];
    }

    // Save custom shortcut
    this.customShortcuts[this.recordingId] = shortcut;

    this.stopRecording();
    this.render();
  }

  findConflict(shortcut, excludeId) {
    // Check default shortcuts
    for (const category of Object.values(SHORTCUT_CATEGORIES)) {
      for (const sc of category.shortcuts) {
        if (sc.id === excludeId) continue;

        const current = this.customShortcuts[sc.id] || sc.default;
        if (current === shortcut) {
          return { id: sc.id, action: sc.action };
        }
      }
    }
    return null;
  }

  filterShortcuts(query) {
    const rows = this.shadowRoot.querySelectorAll('.shortcut-row');
    const lowerQuery = query.toLowerCase();

    rows.forEach(row => {
      const action = row.querySelector('.shortcut-action').textContent.toLowerCase();
      const keys = row.querySelector('.shortcut-keys').textContent.toLowerCase();

      const matches = action.includes(lowerQuery) || keys.includes(lowerQuery);
      row.style.display = matches ? '' : 'none';
    });

    // Show categories that have visible rows
    this.shadowRoot.querySelectorAll('.category').forEach(cat => {
      const visibleRows = cat.querySelectorAll('.shortcut-row[style=""], .shortcut-row:not([style])');
      cat.style.display = visibleRows.length > 0 ? '' : 'none';
    });
  }
}

customElements.define('shortcuts-dialog', ShortcutsDialog);

/**
 * Show the shortcuts dialog
 */
export function showShortcutsDialog() {
  let dialog = document.querySelector('shortcuts-dialog');
  if (!dialog) {
    dialog = document.createElement('shortcuts-dialog');
    document.body.appendChild(dialog);
  }
  dialog.open();
}
