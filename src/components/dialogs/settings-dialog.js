/**
 * Settings Dialog - Application preferences
 * Theme, autosave, performance settings, etc.
 */

import { getEventBus, Events } from '../../core/event-bus.js';
import { getThemeManager, THEMES } from '../../core/theme-manager.js';
import { saveSetting, getSetting, getAllSettings } from '../../storage/project-store.js';
import { getStorageEstimate, isStoragePersistent, requestPersistentStorage } from '../../storage/db.js';

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
      width: 500px;
      max-width: 90vw;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
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

    .dialog-content {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
    }

    .section {
      margin-bottom: 28px;
    }

    .section:last-child {
      margin-bottom: 0;
    }

    .section-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-secondary, #888);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 16px;
    }

    .setting-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }

    .setting-row:last-child {
      border-bottom: none;
    }

    .setting-info {
      flex: 1;
      margin-right: 16px;
    }

    .setting-label {
      font-size: 14px;
      color: var(--text-primary, #fff);
      margin-bottom: 4px;
    }

    .setting-description {
      font-size: 12px;
      color: var(--text-secondary, #888);
    }

    /* Theme selector */
    .theme-options {
      display: flex;
      gap: 8px;
    }

    .theme-option {
      width: 80px;
      padding: 12px 8px;
      border: 2px solid var(--border-color, #444);
      border-radius: 8px;
      background: var(--bg-secondary, #333);
      cursor: pointer;
      transition: all 0.15s;
      text-align: center;
    }

    .theme-option:hover {
      border-color: var(--text-secondary, #888);
    }

    .theme-option.selected {
      border-color: var(--accent-color, #3b82f6);
      background: rgba(59, 130, 246, 0.1);
    }

    .theme-preview {
      width: 40px;
      height: 28px;
      border-radius: 4px;
      margin: 0 auto 8px;
      display: flex;
      overflow: hidden;
    }

    .theme-preview.dark {
      background: #1a1a1a;
      border: 1px solid #444;
    }

    .theme-preview.light {
      background: #f5f5f5;
      border: 1px solid #ddd;
    }

    .theme-preview.system {
      background: linear-gradient(90deg, #1a1a1a 50%, #f5f5f5 50%);
      border: 1px solid #888;
    }

    .theme-label {
      font-size: 11px;
      color: var(--text-primary, #fff);
    }

    /* Toggle switch */
    .toggle {
      position: relative;
      width: 48px;
      height: 26px;
    }

    .toggle input {
      opacity: 0;
      width: 0;
      height: 0;
    }

    .toggle-slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: var(--bg-secondary, #333);
      border-radius: 26px;
      transition: 0.3s;
    }

    .toggle-slider:before {
      position: absolute;
      content: "";
      height: 20px;
      width: 20px;
      left: 3px;
      bottom: 3px;
      background: white;
      border-radius: 50%;
      transition: 0.3s;
    }

    .toggle input:checked + .toggle-slider {
      background: var(--accent-color, #3b82f6);
    }

    .toggle input:checked + .toggle-slider:before {
      transform: translateX(22px);
    }

    /* Select */
    .select {
      padding: 8px 12px;
      background: var(--bg-input, #333);
      border: 1px solid var(--border-color, #444);
      border-radius: 6px;
      color: var(--text-primary, #fff);
      font-size: 13px;
      cursor: pointer;
      min-width: 120px;
    }

    .select:focus {
      outline: none;
      border-color: var(--accent-color, #3b82f6);
    }

    /* Storage info */
    .storage-bar {
      width: 100%;
      height: 8px;
      background: var(--bg-secondary, #333);
      border-radius: 4px;
      overflow: hidden;
      margin-top: 8px;
    }

    .storage-used {
      height: 100%;
      background: var(--accent-color, #3b82f6);
      border-radius: 4px;
      transition: width 0.3s;
    }

    .storage-text {
      font-size: 12px;
      color: var(--text-secondary, #888);
      margin-top: 8px;
    }

    .btn-link {
      background: none;
      border: none;
      color: var(--accent-color, #3b82f6);
      font-size: 12px;
      cursor: pointer;
      padding: 0;
      text-decoration: underline;
    }

    .btn-link:hover {
      color: #60a5fa;
    }

    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      padding: 16px 24px;
      border-top: 1px solid var(--border-color, #444);
    }

    .btn {
      padding: 10px 24px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
    }

    .btn-primary {
      background: var(--accent-color, #3b82f6);
      border: none;
      color: white;
    }

    .btn-primary:hover {
      background: #2563eb;
    }
  </style>

  <div class="dialog-backdrop">
    <div class="dialog">
      <div class="dialog-header">
        <span class="dialog-title">Settings</span>
        <button class="close-btn" id="close-btn">
          <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>
      </div>

      <div class="dialog-content">
        <!-- Appearance -->
        <div class="section">
          <div class="section-title">Appearance</div>

          <div class="setting-row">
            <div class="setting-info">
              <div class="setting-label">Theme</div>
              <div class="setting-description">Choose your preferred color scheme</div>
            </div>
            <div class="theme-options" id="theme-options">
              <div class="theme-option" data-theme="dark">
                <div class="theme-preview dark"></div>
                <span class="theme-label">Dark</span>
              </div>
              <div class="theme-option" data-theme="light">
                <div class="theme-preview light"></div>
                <span class="theme-label">Light</span>
              </div>
              <div class="theme-option" data-theme="system">
                <div class="theme-preview system"></div>
                <span class="theme-label">System</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Saving -->
        <div class="section">
          <div class="section-title">Saving</div>

          <div class="setting-row">
            <div class="setting-info">
              <div class="setting-label">Auto-save</div>
              <div class="setting-description">Automatically save your work periodically</div>
            </div>
            <label class="toggle">
              <input type="checkbox" id="autosave-toggle" checked>
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <div class="setting-label">Auto-save interval</div>
              <div class="setting-description">How often to save automatically</div>
            </div>
            <select class="select" id="autosave-interval">
              <option value="30000">30 seconds</option>
              <option value="60000" selected>1 minute</option>
              <option value="120000">2 minutes</option>
              <option value="300000">5 minutes</option>
            </select>
          </div>
        </div>

        <!-- Performance -->
        <div class="section">
          <div class="section-title">Performance</div>

          <div class="setting-row">
            <div class="setting-info">
              <div class="setting-label">Hardware acceleration</div>
              <div class="setting-description">Use GPU for faster rendering</div>
            </div>
            <label class="toggle">
              <input type="checkbox" id="gpu-toggle" checked>
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <div class="setting-label">Tile size</div>
              <div class="setting-description">Larger tiles use more memory but may be faster</div>
            </div>
            <select class="select" id="tile-size">
              <option value="128">128px (Low memory)</option>
              <option value="256" selected>256px (Balanced)</option>
              <option value="512">512px (High performance)</option>
            </select>
          </div>
        </div>

        <!-- Storage -->
        <div class="section">
          <div class="section-title">Storage</div>

          <div class="setting-row">
            <div class="setting-info">
              <div class="setting-label">Storage usage</div>
              <div class="storage-bar">
                <div class="storage-used" id="storage-bar" style="width: 0%"></div>
              </div>
              <div class="storage-text" id="storage-text">Calculating...</div>
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <div class="setting-label">Persistent storage</div>
              <div class="setting-description" id="persist-status">Checking...</div>
            </div>
            <button class="btn-link" id="persist-btn" style="display: none;">Request</button>
          </div>
        </div>
      </div>

      <div class="dialog-footer">
        <button class="btn btn-primary" id="done-btn">Done</button>
      </div>
    </div>
  </div>
`;

export class SettingsDialog extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));
  }

  connectedCallback() {
    this.setupEventListeners();
  }

  setupEventListeners() {
    const backdrop = this.shadowRoot.querySelector('.dialog-backdrop');
    const closeBtn = this.shadowRoot.getElementById('close-btn');
    const doneBtn = this.shadowRoot.getElementById('done-btn');
    const themeOptions = this.shadowRoot.getElementById('theme-options');
    const autosaveToggle = this.shadowRoot.getElementById('autosave-toggle');
    const autosaveInterval = this.shadowRoot.getElementById('autosave-interval');
    const gpuToggle = this.shadowRoot.getElementById('gpu-toggle');
    const tileSize = this.shadowRoot.getElementById('tile-size');
    const persistBtn = this.shadowRoot.getElementById('persist-btn');

    closeBtn.addEventListener('click', () => this.close());
    doneBtn.addEventListener('click', () => this.close());
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) this.close();
    });

    // Theme selection
    themeOptions.addEventListener('click', (e) => {
      const option = e.target.closest('.theme-option');
      if (!option) return;

      themeOptions.querySelectorAll('.theme-option').forEach(opt => {
        opt.classList.remove('selected');
      });
      option.classList.add('selected');

      const theme = option.dataset.theme;
      getThemeManager().setTheme(theme);
    });

    // Auto-save toggle
    autosaveToggle.addEventListener('change', async (e) => {
      await saveSetting('autosaveEnabled', e.target.checked);
      getEventBus().emit('settings:autosave', { enabled: e.target.checked });
    });

    // Auto-save interval
    autosaveInterval.addEventListener('change', async (e) => {
      await saveSetting('autosaveInterval', parseInt(e.target.value));
      getEventBus().emit('settings:autosaveInterval', { interval: parseInt(e.target.value) });
    });

    // GPU toggle
    gpuToggle.addEventListener('change', async (e) => {
      await saveSetting('gpuAcceleration', e.target.checked);
    });

    // Tile size
    tileSize.addEventListener('change', async (e) => {
      await saveSetting('tileSize', parseInt(e.target.value));
    });

    // Persistent storage
    persistBtn.addEventListener('click', async () => {
      const granted = await requestPersistentStorage();
      this.updatePersistStatus(granted);
    });
  }

  async open() {
    await this.loadSettings();
    await this.updateStorageInfo();

    const backdrop = this.shadowRoot.querySelector('.dialog-backdrop');
    backdrop.classList.add('visible');
  }

  close() {
    const backdrop = this.shadowRoot.querySelector('.dialog-backdrop');
    backdrop.classList.remove('visible');
  }

  async loadSettings() {
    const settings = await getAllSettings();
    const themeManager = getThemeManager();

    // Theme
    const currentTheme = themeManager.getTheme();
    this.shadowRoot.querySelectorAll('.theme-option').forEach(opt => {
      opt.classList.toggle('selected', opt.dataset.theme === currentTheme);
    });

    // Auto-save
    const autosaveEnabled = settings.autosaveEnabled !== false;
    this.shadowRoot.getElementById('autosave-toggle').checked = autosaveEnabled;

    const autosaveInterval = settings.autosaveInterval || 60000;
    this.shadowRoot.getElementById('autosave-interval').value = autosaveInterval;

    // GPU
    const gpuEnabled = settings.gpuAcceleration !== false;
    this.shadowRoot.getElementById('gpu-toggle').checked = gpuEnabled;

    // Tile size
    const tileSize = settings.tileSize || 256;
    this.shadowRoot.getElementById('tile-size').value = tileSize;

    // Persistent storage status
    const persisted = await isStoragePersistent();
    this.updatePersistStatus(persisted);
  }

  async updateStorageInfo() {
    const estimate = await getStorageEstimate();

    const storageBar = this.shadowRoot.getElementById('storage-bar');
    const storageText = this.shadowRoot.getElementById('storage-text');

    storageBar.style.width = `${estimate.percentUsed}%`;
    storageText.textContent = `${estimate.usageFormatted} used of ${estimate.quotaFormatted}`;
  }

  updatePersistStatus(persisted) {
    const statusEl = this.shadowRoot.getElementById('persist-status');
    const persistBtn = this.shadowRoot.getElementById('persist-btn');

    if (persisted) {
      statusEl.textContent = 'Storage is persistent. Your data is protected.';
      persistBtn.style.display = 'none';
    } else {
      statusEl.textContent = 'Storage may be cleared by the browser.';
      persistBtn.style.display = 'inline';
    }
  }
}

customElements.define('settings-dialog', SettingsDialog);

/**
 * Show the settings dialog
 */
export function showSettingsDialog() {
  let dialog = document.querySelector('settings-dialog');
  if (!dialog) {
    dialog = document.createElement('settings-dialog');
    document.body.appendChild(dialog);
  }
  dialog.open();
}
