/**
 * Loading Indicator - Progress and loading states
 * Shows loading spinners, progress bars, and status messages
 */

import { getEventBus, Events } from '../../core/event-bus.js';

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: contents;
    }

    .loading-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 20000;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.2s, visibility 0.2s;
    }

    .loading-overlay.visible {
      opacity: 1;
      visibility: visible;
    }

    .loading-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
    }

    /* Spinner */
    .spinner {
      width: 48px;
      height: 48px;
      border: 3px solid rgba(255, 255, 255, 0.1);
      border-top-color: var(--accent-color, #3b82f6);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Progress bar */
    .progress-container {
      width: 300px;
      height: 4px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 2px;
      overflow: hidden;
    }

    .progress-bar {
      height: 100%;
      background: var(--accent-color, #3b82f6);
      border-radius: 2px;
      transition: width 0.2s ease-out;
      width: 0%;
    }

    .progress-bar.indeterminate {
      width: 30%;
      animation: indeterminate 1.5s infinite ease-in-out;
    }

    @keyframes indeterminate {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(400%); }
    }

    /* Status text */
    .status-text {
      color: var(--text-primary, #fff);
      font-size: 14px;
      font-weight: 500;
      text-align: center;
    }

    .status-detail {
      color: var(--text-secondary, #888);
      font-size: 12px;
      text-align: center;
      margin-top: 4px;
    }

    /* Cancel button */
    .cancel-btn {
      margin-top: 12px;
      padding: 8px 20px;
      background: transparent;
      border: 1px solid rgba(255, 255, 255, 0.3);
      color: var(--text-secondary, #888);
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.15s;
    }

    .cancel-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.5);
      color: var(--text-primary, #fff);
    }

    /* Toast notifications */
    .toast-container {
      position: fixed;
      bottom: 20px;
      right: 20px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      z-index: 15000;
      pointer-events: none;
    }

    .toast {
      background: var(--bg-panel, #2a2a2a);
      border: 1px solid var(--border-color, #444);
      border-radius: 8px;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      pointer-events: auto;
      animation: slideIn 0.3s ease-out;
      max-width: 400px;
    }

    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    .toast.leaving {
      animation: slideOut 0.3s ease-in forwards;
    }

    @keyframes slideOut {
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }

    .toast-icon {
      width: 20px;
      height: 20px;
      flex-shrink: 0;
    }

    .toast-icon.success { fill: #22c55e; }
    .toast-icon.error { fill: #ef4444; }
    .toast-icon.warning { fill: #f59e0b; }
    .toast-icon.info { fill: #3b82f6; }

    .toast-content {
      flex: 1;
    }

    .toast-title {
      font-size: 13px;
      font-weight: 500;
      color: var(--text-primary, #fff);
    }

    .toast-message {
      font-size: 12px;
      color: var(--text-secondary, #888);
      margin-top: 2px;
    }

    .toast-close {
      width: 20px;
      height: 20px;
      border: none;
      background: transparent;
      color: var(--text-secondary, #888);
      cursor: pointer;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: background 0.15s;
    }

    .toast-close:hover {
      background: var(--bg-hover, #333);
    }

    .toast-close svg {
      width: 14px;
      height: 14px;
      fill: currentColor;
    }
  </style>

  <div class="loading-overlay">
    <div class="loading-content">
      <div class="spinner"></div>
      <div class="progress-container">
        <div class="progress-bar"></div>
      </div>
      <div class="status-text">Loading...</div>
      <div class="status-detail"></div>
      <button class="cancel-btn" style="display: none;">Cancel</button>
    </div>
  </div>

  <div class="toast-container"></div>
`;

const ICONS = {
  success: `<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`,
  error: `<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`,
  warning: `<svg viewBox="0 0 24 24"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>`,
  info: `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>`
};

export class LoadingIndicator extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this.overlay = this.shadowRoot.querySelector('.loading-overlay');
    this.progressBar = this.shadowRoot.querySelector('.progress-bar');
    this.statusText = this.shadowRoot.querySelector('.status-text');
    this.statusDetail = this.shadowRoot.querySelector('.status-detail');
    this.cancelBtn = this.shadowRoot.querySelector('.cancel-btn');
    this.toastContainer = this.shadowRoot.querySelector('.toast-container');

    this.cancelCallback = null;
  }

  connectedCallback() {
    this.setupEventListeners();
    this.setupEventBusListeners();
  }

  setupEventListeners() {
    this.cancelBtn.addEventListener('click', () => {
      if (this.cancelCallback) {
        this.cancelCallback();
      }
      this.hide();
    });
  }

  setupEventBusListeners() {
    const eventBus = getEventBus();

    // File import events
    eventBus.on(Events.FILE_IMPORT_START, (data) => {
      this.show(`Opening ${data.format || 'file'}...`);
    });

    eventBus.on(Events.FILE_IMPORT_PROGRESS, (data) => {
      this.setProgress(data.progress, data.status);
    });

    eventBus.on(Events.FILE_IMPORT_COMPLETE, () => {
      this.hide();
      this.showToast('success', 'File opened', 'Document loaded successfully');
    });

    eventBus.on(Events.FILE_IMPORT_ERROR, (data) => {
      this.hide();
      this.showToast('error', 'Import failed', data.error?.message || 'Unknown error');
    });

    // File export events
    eventBus.on(Events.FILE_EXPORT_START, (data) => {
      this.show(`Exporting ${data.format || 'file'}...`);
    });

    eventBus.on(Events.FILE_EXPORT_COMPLETE, () => {
      this.hide();
      this.showToast('success', 'Export complete', 'File saved successfully');
    });

    eventBus.on(Events.FILE_EXPORT_ERROR, (data) => {
      this.hide();
      this.showToast('error', 'Export failed', data.error?.message || 'Unknown error');
    });

    // Autosave events
    eventBus.on('autosave:complete', () => {
      this.showToast('info', 'Auto-saved', 'Your work has been saved', 2000);
    });

    eventBus.on('autosave:error', (data) => {
      this.showToast('warning', 'Auto-save failed', data.error?.message || 'Could not save');
    });
  }

  /**
   * Show the loading overlay
   */
  show(message = 'Loading...', options = {}) {
    this.statusText.textContent = message;
    this.statusDetail.textContent = options.detail || '';

    if (options.indeterminate !== false) {
      this.progressBar.classList.add('indeterminate');
      this.progressBar.style.width = '';
    } else {
      this.progressBar.classList.remove('indeterminate');
      this.progressBar.style.width = '0%';
    }

    if (options.cancellable) {
      this.cancelBtn.style.display = 'block';
      this.cancelCallback = options.onCancel;
    } else {
      this.cancelBtn.style.display = 'none';
      this.cancelCallback = null;
    }

    this.overlay.classList.add('visible');
  }

  /**
   * Hide the loading overlay
   */
  hide() {
    this.overlay.classList.remove('visible');
    this.cancelCallback = null;
  }

  /**
   * Set progress (0-100)
   */
  setProgress(progress, status = null) {
    this.progressBar.classList.remove('indeterminate');
    this.progressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;

    if (status) {
      this.statusDetail.textContent = status;
    }
  }

  /**
   * Update status message
   */
  setStatus(message, detail = null) {
    this.statusText.textContent = message;
    if (detail !== null) {
      this.statusDetail.textContent = detail;
    }
  }

  /**
   * Show a toast notification
   */
  showToast(type, title, message = '', duration = 4000) {
    const toast = document.createElement('div');
    toast.className = 'toast';

    toast.innerHTML = `
      <div class="toast-icon ${type}">${ICONS[type] || ICONS.info}</div>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        ${message ? `<div class="toast-message">${message}</div>` : ''}
      </div>
      <button class="toast-close">
        <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
      </button>
    `;

    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => this.removeToast(toast));

    this.toastContainer.appendChild(toast);

    if (duration > 0) {
      setTimeout(() => this.removeToast(toast), duration);
    }

    return toast;
  }

  /**
   * Remove a toast notification
   */
  removeToast(toast) {
    if (!toast || !toast.parentElement) return;

    toast.classList.add('leaving');
    setTimeout(() => {
      if (toast.parentElement) {
        toast.remove();
      }
    }, 300);
  }

  /**
   * Clear all toasts
   */
  clearToasts() {
    const toasts = this.toastContainer.querySelectorAll('.toast');
    toasts.forEach(toast => this.removeToast(toast));
  }
}

customElements.define('loading-indicator', LoadingIndicator);

/**
 * Get or create the global loading indicator
 */
export function getLoadingIndicator() {
  let indicator = document.querySelector('loading-indicator');
  if (!indicator) {
    indicator = document.createElement('loading-indicator');
    document.body.appendChild(indicator);
  }
  return indicator;
}

/**
 * Show loading state
 */
export function showLoading(message, options = {}) {
  getLoadingIndicator().show(message, options);
}

/**
 * Hide loading state
 */
export function hideLoading() {
  getLoadingIndicator().hide();
}

/**
 * Set loading progress
 */
export function setLoadingProgress(progress, status) {
  getLoadingIndicator().setProgress(progress, status);
}

/**
 * Show a toast notification
 */
export function showToast(type, title, message, duration) {
  return getLoadingIndicator().showToast(type, title, message, duration);
}
