/**
 * Recent Documents Dialog - Shows recent projects and recovery options
 */

import { getEventBus, Events } from '../../core/event-bus.js';
import { getRecentDocuments, deleteProject, getProjectThumbnail } from '../../storage/project-store.js';
import { checkForRecovery, recoverDocument, clearRecoveryState } from '../../storage/autosave.js';

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
      width: 600px;
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

    .dialog-content {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
    }

    /* Recovery Alert */
    .recovery-alert {
      background: rgba(245, 158, 11, 0.1);
      border: 1px solid rgba(245, 158, 11, 0.3);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
    }

    .recovery-alert h4 {
      font-size: 14px;
      font-weight: 600;
      color: #f59e0b;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .recovery-alert p {
      font-size: 13px;
      color: var(--text-secondary, #888);
      margin-bottom: 12px;
    }

    .recovery-actions {
      display: flex;
      gap: 8px;
    }

    .recovery-btn {
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
    }

    .recovery-btn.primary {
      background: #f59e0b;
      border: none;
      color: #000;
    }

    .recovery-btn.primary:hover {
      background: #d97706;
    }

    .recovery-btn.secondary {
      background: transparent;
      border: 1px solid var(--border-color, #444);
      color: var(--text-primary, #fff);
    }

    .recovery-btn.secondary:hover {
      background: var(--bg-hover, #333);
    }

    /* Section */
    .section-title {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-secondary, #888);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
    }

    /* Document Grid */
    .documents-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 12px;
    }

    .document-card {
      background: var(--bg-secondary, #333);
      border: 1px solid var(--border-color, #444);
      border-radius: 8px;
      overflow: hidden;
      cursor: pointer;
      transition: all 0.15s;
    }

    .document-card:hover {
      border-color: var(--accent-color, #3b82f6);
      transform: translateY(-2px);
    }

    .document-thumbnail {
      aspect-ratio: 16 / 10;
      background: var(--bg-canvas, #1a1a1a);
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }

    .document-thumbnail img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .document-thumbnail .placeholder {
      width: 48px;
      height: 48px;
      fill: var(--text-secondary, #888);
      opacity: 0.3;
    }

    .document-info {
      padding: 10px 12px;
    }

    .document-name {
      font-size: 13px;
      font-weight: 500;
      color: var(--text-primary, #fff);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 4px;
    }

    .document-meta {
      font-size: 11px;
      color: var(--text-secondary, #888);
    }

    .document-actions {
      position: absolute;
      top: 8px;
      right: 8px;
      opacity: 0;
      transition: opacity 0.15s;
    }

    .document-card:hover .document-actions {
      opacity: 1;
    }

    .delete-btn {
      width: 24px;
      height: 24px;
      border: none;
      background: rgba(0, 0, 0, 0.6);
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-secondary, #888);
      cursor: pointer;
      transition: all 0.15s;
    }

    .delete-btn:hover {
      background: #ef4444;
      color: white;
    }

    .delete-btn svg {
      width: 14px;
      height: 14px;
      fill: currentColor;
    }

    /* Empty State */
    .empty-state {
      text-align: center;
      padding: 40px 20px;
      color: var(--text-secondary, #888);
    }

    .empty-state svg {
      width: 64px;
      height: 64px;
      fill: currentColor;
      opacity: 0.3;
      margin-bottom: 16px;
    }

    .empty-state h3 {
      font-size: 16px;
      font-weight: 500;
      color: var(--text-primary, #fff);
      margin-bottom: 8px;
    }

    .empty-state p {
      font-size: 14px;
    }

    /* Actions */
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

    .storage-info {
      font-size: 12px;
      color: var(--text-secondary, #888);
    }
  </style>

  <div class="dialog-backdrop">
    <div class="dialog">
      <div class="dialog-header">
        <span class="dialog-title">Recent Documents</span>
        <button class="close-btn" id="close-btn">
          <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>
      </div>

      <div class="dialog-content" id="content">
        <!-- Content populated dynamically -->
      </div>

      <div class="dialog-footer">
        <span class="storage-info" id="storage-info"></span>
        <button class="btn btn-primary" id="new-btn">New Document</button>
      </div>
    </div>
  </div>
`;

export class RecentDocumentsDialog extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this.recentDocuments = [];
    this.recoveryData = null;
  }

  connectedCallback() {
    this.setupEventListeners();
  }

  setupEventListeners() {
    const backdrop = this.shadowRoot.querySelector('.dialog-backdrop');
    const closeBtn = this.shadowRoot.getElementById('close-btn');
    const newBtn = this.shadowRoot.getElementById('new-btn');

    closeBtn.addEventListener('click', () => this.close());
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) this.close();
    });

    newBtn.addEventListener('click', () => {
      this.close();
      getEventBus().emit('toolbar:new');
    });

    // Keyboard shortcut
    this.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    });
  }

  async open() {
    await this.loadData();
    this.render();

    const backdrop = this.shadowRoot.querySelector('.dialog-backdrop');
    backdrop.classList.add('visible');
    this.focus();

    // Update storage info
    await this.updateStorageInfo();
  }

  close() {
    const backdrop = this.shadowRoot.querySelector('.dialog-backdrop');
    backdrop.classList.remove('visible');
  }

  async loadData() {
    // Check for recovery state
    this.recoveryData = await checkForRecovery();

    // Load recent documents
    this.recentDocuments = await getRecentDocuments(12);
  }

  render() {
    const content = this.shadowRoot.getElementById('content');

    let html = '';

    // Recovery alert
    if (this.recoveryData) {
      html += this.renderRecoveryAlert();
    }

    // Recent documents
    if (this.recentDocuments.length > 0) {
      html += `
        <div class="section-title">Recent</div>
        <div class="documents-grid">
          ${this.recentDocuments.map(doc => this.renderDocumentCard(doc)).join('')}
        </div>
      `;
    } else {
      html += this.renderEmptyState();
    }

    content.innerHTML = html;

    // Attach event listeners
    this.attachCardListeners();
  }

  renderRecoveryAlert() {
    const savedAt = new Date(this.recoveryData.savedAt).toLocaleString();

    return `
      <div class="recovery-alert">
        <h4>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          Unsaved Work Recovered
        </h4>
        <p>
          We found unsaved changes for "${this.recoveryData.documentName}"
          from ${savedAt}. Would you like to recover this work?
        </p>
        <div class="recovery-actions">
          <button class="recovery-btn primary" id="recover-btn">Recover</button>
          <button class="recovery-btn secondary" id="discard-btn">Discard</button>
        </div>
      </div>
    `;
  }

  renderDocumentCard(doc) {
    const date = new Date(doc.openedAt).toLocaleDateString();

    return `
      <div class="document-card" data-id="${doc.id}">
        <div class="document-thumbnail">
          ${doc.thumbnailUrl
            ? `<img src="${doc.thumbnailUrl}" alt="${doc.name}">`
            : `<svg class="placeholder" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-5.04-6.71l-2.75 3.54-1.96-2.36L6.5 17h11l-3.54-4.71z"/></svg>`
          }
          <div class="document-actions">
            <button class="delete-btn" data-delete="${doc.id}" title="Delete">
              <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
            </button>
          </div>
        </div>
        <div class="document-info">
          <div class="document-name">${doc.name}</div>
          <div class="document-meta">${doc.project?.width}x${doc.project?.height} - ${date}</div>
        </div>
      </div>
    `;
  }

  renderEmptyState() {
    return `
      <div class="empty-state">
        <svg viewBox="0 0 24 24">
          <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/>
        </svg>
        <h3>No Recent Documents</h3>
        <p>Your recently opened projects will appear here.</p>
      </div>
    `;
  }

  attachCardListeners() {
    const content = this.shadowRoot.getElementById('content');

    // Document cards
    content.querySelectorAll('.document-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.delete-btn')) return;
        const id = card.dataset.id;
        this.openDocument(id);
      });
    });

    // Delete buttons
    content.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.delete;
        await this.deleteDocument(id);
      });
    });

    // Recovery buttons
    const recoverBtn = content.querySelector('#recover-btn');
    const discardBtn = content.querySelector('#discard-btn');

    if (recoverBtn) {
      recoverBtn.addEventListener('click', () => this.recoverWork());
    }

    if (discardBtn) {
      discardBtn.addEventListener('click', () => this.discardRecovery());
    }
  }

  async openDocument(id) {
    const eventBus = getEventBus();

    try {
      const { loadProject } = await import('../../storage/project-store.js');
      const data = await loadProject(id);

      // Emit event to load document
      eventBus.emit('project:load', data);
      this.close();
    } catch (error) {
      console.error('Failed to open document:', error);
      alert('Failed to open document: ' + error.message);
    }
  }

  async deleteDocument(id) {
    if (!confirm('Are you sure you want to delete this project? This cannot be undone.')) {
      return;
    }

    try {
      await deleteProject(id);

      // Reload and re-render
      await this.loadData();
      this.render();
    } catch (error) {
      console.error('Failed to delete document:', error);
    }
  }

  async recoverWork() {
    try {
      const documentData = await recoverDocument(this.recoveryData);

      // Emit event to restore document
      getEventBus().emit('project:recover', documentData);

      // Clear recovery state
      await clearRecoveryState();

      this.close();
    } catch (error) {
      console.error('Failed to recover work:', error);
      alert('Failed to recover work: ' + error.message);
    }
  }

  async discardRecovery() {
    if (!confirm('Are you sure? Your unsaved changes will be permanently lost.')) {
      return;
    }

    await clearRecoveryState();
    this.recoveryData = null;
    this.render();
  }

  async updateStorageInfo() {
    const storageInfo = this.shadowRoot.getElementById('storage-info');

    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      const used = (estimate.usage / (1024 * 1024)).toFixed(1);
      const quota = (estimate.quota / (1024 * 1024 * 1024)).toFixed(1);
      storageInfo.textContent = `${used} MB used of ${quota} GB`;
    }
  }
}

customElements.define('recent-documents-dialog', RecentDocumentsDialog);

/**
 * Show the recent documents dialog
 */
export function showRecentDocumentsDialog() {
  let dialog = document.querySelector('recent-documents-dialog');
  if (!dialog) {
    dialog = document.createElement('recent-documents-dialog');
    document.body.appendChild(dialog);
  }
  dialog.open();
}
