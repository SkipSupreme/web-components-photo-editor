/**
 * History Panel - Displays undo/redo history
 */

import { getStore } from '../../core/store.js';
import { getEventBus, Events } from '../../core/event-bus.js';
import { getHistory } from '../../core/commands.js';

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

    .action-btn:hover:not(:disabled) {
      background: var(--bg-hover);
      color: var(--text-primary);
    }

    .action-btn:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }

    .action-btn svg {
      width: 16px;
      height: 16px;
      fill: currentColor;
    }

    .history-list {
      max-height: 150px;
      overflow-y: auto;
    }

    .history-item {
      display: flex;
      align-items: center;
      padding: 6px 12px;
      gap: 8px;
      cursor: pointer;
      font-size: 12px;
      border-bottom: 1px solid var(--border-color);
      transition: background-color 0.15s;
    }

    .history-item:hover {
      background: var(--layer-hover);
    }

    .history-item.current {
      background: var(--layer-selected);
    }

    .history-item.future {
      opacity: 0.5;
    }

    .history-icon {
      width: 16px;
      height: 16px;
      fill: var(--text-secondary);
    }

    .history-name {
      flex: 1;
    }

    .history-time {
      font-size: 10px;
      color: var(--text-secondary);
    }

    .empty-state {
      padding: 20px;
      text-align: center;
      color: var(--text-secondary);
      font-size: 12px;
    }

    .initial-state {
      display: flex;
      align-items: center;
      padding: 6px 12px;
      gap: 8px;
      font-size: 12px;
      border-bottom: 1px solid var(--border-color);
      color: var(--text-secondary);
      cursor: pointer;
    }

    .initial-state:hover {
      background: var(--layer-hover);
    }

    .initial-state.current {
      background: var(--layer-selected);
      color: var(--text-primary);
    }
  </style>

  <div class="panel-header">
    <span class="panel-title">History</span>
    <div class="panel-actions">
      <button class="action-btn" id="undo-btn" title="Undo (Ctrl+Z)">
        <svg viewBox="0 0 24 24"><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/></svg>
      </button>
      <button class="action-btn" id="redo-btn" title="Redo (Ctrl+Shift+Z)">
        <svg viewBox="0 0 24 24"><path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22l2.37.78c1.05-3.19 4.06-5.5 7.59-5.5 1.96 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"/></svg>
      </button>
    </div>
  </div>

  <div class="history-list" id="history-list">
    <div class="initial-state current" data-index="-1">
      <svg class="history-icon" viewBox="0 0 24 24"><path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>
      <span>Initial State</span>
    </div>
  </div>
`;

export class HistoryPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this.store = null;
    this.eventBus = null;
    this.history = null;
    this.unsubscribers = [];
  }

  connectedCallback() {
    this.store = getStore();
    this.eventBus = getEventBus();
    this.history = getHistory();

    this.setupEventListeners();
    this.subscribeToState();
    this.render();
  }

  disconnectedCallback() {
    this.unsubscribers.forEach(unsub => unsub());
  }

  setupEventListeners() {
    // Undo/Redo buttons
    this.shadowRoot.getElementById('undo-btn').addEventListener('click', () => {
      this.history.undo();
    });

    this.shadowRoot.getElementById('redo-btn').addEventListener('click', () => {
      this.history.redo();
    });

    // History item clicks
    this.shadowRoot.getElementById('history-list').addEventListener('click', (e) => {
      const item = e.target.closest('[data-index]');
      if (item) {
        const index = parseInt(item.dataset.index);
        this.goToState(index);
      }
    });
  }

  subscribeToState() {
    this.unsubscribers.push(
      this.eventBus.on(Events.HISTORY_PUSH, () => this.render()),
      this.eventBus.on(Events.HISTORY_UNDO, () => this.render()),
      this.eventBus.on(Events.HISTORY_REDO, () => this.render())
    );
  }

  goToState(index) {
    if (index === -1) {
      // Go to initial state - undo everything
      while (this.history.canUndo()) {
        this.history.undo();
      }
    } else {
      this.history.goTo(index);
    }
  }

  render() {
    const undoStack = this.history.getUndoStack();
    const currentIndex = this.history.undoStack.length - 1;

    // Update button states
    this.shadowRoot.getElementById('undo-btn').disabled = !this.history.canUndo();
    this.shadowRoot.getElementById('redo-btn').disabled = !this.history.canRedo();

    const listEl = this.shadowRoot.getElementById('history-list');

    // Initial state
    let html = `
      <div class="initial-state ${currentIndex === -1 ? 'current' : ''}" data-index="-1">
        <svg class="history-icon" viewBox="0 0 24 24"><path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>
        <span>Initial State</span>
      </div>
    `;

    // History items
    undoStack.forEach((item, index) => {
      const isCurrent = index === currentIndex;
      const time = new Date(item.timestamp).toLocaleTimeString();

      html += `
        <div class="history-item ${isCurrent ? 'current' : ''}" data-index="${index}">
          <svg class="history-icon" viewBox="0 0 24 24"><path d="M17 3H7c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H7V5h10v14z"/></svg>
          <span class="history-name">${item.name}</span>
          <span class="history-time">${time}</span>
        </div>
      `;
    });

    listEl.innerHTML = html;

    // Scroll current into view
    const currentEl = listEl.querySelector('.current');
    if (currentEl) {
      currentEl.scrollIntoView({ block: 'nearest' });
    }
  }
}

customElements.define('history-panel', HistoryPanel);
