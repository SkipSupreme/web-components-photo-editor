/**
 * Color Panel - Foreground/background color selection
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
      padding: 12px;
    }

    .color-swatches {
      position: relative;
      width: 64px;
      height: 64px;
      margin: 0 auto;
    }

    .color-swatch {
      position: absolute;
      width: 40px;
      height: 40px;
      border: 2px solid var(--border-light);
      border-radius: 4px;
      cursor: pointer;
      transition: transform 0.15s;
    }

    .color-swatch:hover {
      transform: scale(1.05);
    }

    .foreground {
      top: 0;
      left: 0;
      z-index: 2;
    }

    .background {
      bottom: 0;
      right: 0;
      z-index: 1;
    }

    .swap-btn {
      position: absolute;
      top: 0;
      right: 0;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      cursor: pointer;
      z-index: 3;
    }

    .swap-btn:hover {
      background: var(--bg-hover);
    }

    .swap-btn svg {
      width: 12px;
      height: 12px;
      fill: var(--text-secondary);
    }

    .reset-btn {
      position: absolute;
      bottom: 0;
      left: 0;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      cursor: pointer;
      z-index: 3;
      font-size: 10px;
      color: var(--text-secondary);
    }

    .reset-btn:hover {
      background: var(--bg-hover);
    }

    .color-picker-wrapper {
      margin-top: 12px;
    }

    .color-input-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 8px;
    }

    .color-input-row label {
      font-size: 11px;
      color: var(--text-secondary);
      width: 20px;
    }

    .color-input-row input[type="color"] {
      width: 32px;
      height: 24px;
      padding: 0;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      cursor: pointer;
    }

    .color-input-row input[type="text"] {
      flex: 1;
      padding: 4px 8px;
      font-size: 11px;
      font-family: monospace;
      background: var(--bg-input);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      color: var(--text-primary);
    }
  </style>

  <div class="color-swatches">
    <div class="color-swatch foreground" id="foreground" title="Foreground Color"></div>
    <div class="color-swatch background" id="background" title="Background Color"></div>
    <button class="swap-btn" id="swap" title="Swap Colors (X)">
      <svg viewBox="0 0 24 24"><path d="M16 17.01V10h-2v7.01h-3L15 21l4-3.99h-3zM9 3L5 6.99h3V14h2V6.99h3L9 3z"/></svg>
    </button>
    <button class="reset-btn" id="reset" title="Reset to Default (D)">D</button>
  </div>

  <div class="color-picker-wrapper">
    <div class="color-input-row">
      <label>FG:</label>
      <input type="color" id="fg-picker" value="#000000">
      <input type="text" id="fg-hex" value="#000000" maxlength="7">
    </div>
    <div class="color-input-row">
      <label>BG:</label>
      <input type="color" id="bg-picker" value="#ffffff">
      <input type="text" id="bg-hex" value="#ffffff" maxlength="7">
    </div>
  </div>
`;

export class ColorPanel extends HTMLElement {
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
    this.render();
  }

  disconnectedCallback() {
    this.unsubscribers.forEach(unsub => unsub());
  }

  setupEventListeners() {
    // Swap colors
    this.shadowRoot.getElementById('swap').addEventListener('click', () => {
      this.swapColors();
    });

    // Reset colors
    this.shadowRoot.getElementById('reset').addEventListener('click', () => {
      this.resetColors();
    });

    // Foreground picker
    const fgPicker = this.shadowRoot.getElementById('fg-picker');
    const fgHex = this.shadowRoot.getElementById('fg-hex');

    fgPicker.addEventListener('input', (e) => {
      this.setForeground(e.target.value);
    });

    fgHex.addEventListener('change', (e) => {
      const value = e.target.value;
      if (/^#[0-9a-fA-F]{6}$/.test(value)) {
        this.setForeground(value);
      }
    });

    // Background picker
    const bgPicker = this.shadowRoot.getElementById('bg-picker');
    const bgHex = this.shadowRoot.getElementById('bg-hex');

    bgPicker.addEventListener('input', (e) => {
      this.setBackground(e.target.value);
    });

    bgHex.addEventListener('change', (e) => {
      const value = e.target.value;
      if (/^#[0-9a-fA-F]{6}$/.test(value)) {
        this.setBackground(value);
      }
    });

    // Click on swatches to open picker
    this.shadowRoot.getElementById('foreground').addEventListener('click', () => {
      fgPicker.click();
    });

    this.shadowRoot.getElementById('background').addEventListener('click', () => {
      bgPicker.click();
    });
  }

  subscribeToState() {
    this.unsubscribers.push(
      this.store.subscribe('colors', () => this.render())
    );

    // Listen for color swap event from shortcuts
    this.unsubscribers.push(
      this.eventBus.on(Events.COLOR_SWAPPED, () => this.render())
    );
  }

  setForeground(color) {
    this.store.state.colors.foreground = color;
    this.eventBus.emit(Events.COLOR_FOREGROUND_CHANGED, { color });
    this.render();
  }

  setBackground(color) {
    this.store.state.colors.background = color;
    this.eventBus.emit(Events.COLOR_BACKGROUND_CHANGED, { color });
    this.render();
  }

  swapColors() {
    const fg = this.store.state.colors.foreground;
    const bg = this.store.state.colors.background;

    this.store.state.colors.foreground = bg;
    this.store.state.colors.background = fg;

    this.eventBus.emit(Events.COLOR_SWAPPED, {
      foreground: bg,
      background: fg
    });

    this.render();
  }

  resetColors() {
    this.store.state.colors.foreground = '#000000';
    this.store.state.colors.background = '#ffffff';

    this.eventBus.emit(Events.COLOR_FOREGROUND_CHANGED, { color: '#000000' });
    this.eventBus.emit(Events.COLOR_BACKGROUND_CHANGED, { color: '#ffffff' });

    this.render();
  }

  render() {
    const { foreground, background } = this.store.state.colors;

    // Update swatches
    this.shadowRoot.getElementById('foreground').style.backgroundColor = foreground;
    this.shadowRoot.getElementById('background').style.backgroundColor = background;

    // Update inputs
    this.shadowRoot.getElementById('fg-picker').value = foreground;
    this.shadowRoot.getElementById('fg-hex').value = foreground;
    this.shadowRoot.getElementById('bg-picker').value = background;
    this.shadowRoot.getElementById('bg-hex').value = background;
  }
}

customElements.define('color-panel', ColorPanel);
