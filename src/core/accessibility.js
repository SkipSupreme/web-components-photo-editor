/**
 * Accessibility - Accessibility utilities and ARIA support
 * Provides screen reader support, focus management, and keyboard navigation
 */

import { getEventBus, Events } from './event-bus.js';

/**
 * Live region for screen reader announcements
 */
class LiveRegion {
  constructor() {
    this.element = null;
    this.init();
  }

  init() {
    this.element = document.createElement('div');
    this.element.setAttribute('role', 'status');
    this.element.setAttribute('aria-live', 'polite');
    this.element.setAttribute('aria-atomic', 'true');
    this.element.className = 'sr-only';
    this.element.style.cssText = `
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    `;
    document.body.appendChild(this.element);
  }

  /**
   * Announce a message to screen readers
   */
  announce(message, priority = 'polite') {
    this.element.setAttribute('aria-live', priority);
    this.element.textContent = '';

    // Force re-announcement
    requestAnimationFrame(() => {
      this.element.textContent = message;
    });
  }

  /**
   * Announce with assertive priority (immediate)
   */
  announceImmediate(message) {
    this.announce(message, 'assertive');
  }
}

// Singleton live region
let liveRegion = null;

/**
 * Get or create live region
 */
function getLiveRegion() {
  if (!liveRegion) {
    liveRegion = new LiveRegion();
  }
  return liveRegion;
}

/**
 * Announce message to screen readers
 */
export function announce(message, priority = 'polite') {
  getLiveRegion().announce(message, priority);
}

/**
 * Announce immediate/assertive message
 */
export function announceImmediate(message) {
  getLiveRegion().announceImmediate(message);
}

/**
 * Focus trap - keeps focus within a container
 */
export class FocusTrap {
  constructor(container) {
    this.container = container;
    this.firstFocusable = null;
    this.lastFocusable = null;
    this.active = false;
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  /**
   * Get all focusable elements in container
   */
  getFocusableElements() {
    const selector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]'
    ].join(', ');

    return Array.from(this.container.querySelectorAll(selector))
      .filter(el => el.offsetParent !== null); // Visible elements only
  }

  /**
   * Activate focus trap
   */
  activate() {
    if (this.active) return;

    const focusable = this.getFocusableElements();
    if (focusable.length === 0) return;

    this.firstFocusable = focusable[0];
    this.lastFocusable = focusable[focusable.length - 1];
    this.active = true;

    document.addEventListener('keydown', this.handleKeyDown);

    // Focus first element
    this.firstFocusable.focus();
  }

  /**
   * Deactivate focus trap
   */
  deactivate() {
    if (!this.active) return;

    this.active = false;
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  handleKeyDown(e) {
    if (e.key !== 'Tab') return;

    const focusable = this.getFocusableElements();
    this.firstFocusable = focusable[0];
    this.lastFocusable = focusable[focusable.length - 1];

    if (e.shiftKey) {
      // Shift+Tab
      if (document.activeElement === this.firstFocusable) {
        e.preventDefault();
        this.lastFocusable.focus();
      }
    } else {
      // Tab
      if (document.activeElement === this.lastFocusable) {
        e.preventDefault();
        this.firstFocusable.focus();
      }
    }
  }
}

/**
 * Manage focus restoration
 */
export class FocusManager {
  constructor() {
    this.previousFocus = null;
  }

  /**
   * Save current focus
   */
  saveFocus() {
    this.previousFocus = document.activeElement;
  }

  /**
   * Restore previous focus
   */
  restoreFocus() {
    if (this.previousFocus && this.previousFocus.focus) {
      this.previousFocus.focus();
    }
    this.previousFocus = null;
  }
}

/**
 * Add roving tabindex to a group of elements
 */
export function addRovingTabindex(container, selector, options = {}) {
  const { orientation = 'horizontal', wrap = true } = options;
  const items = container.querySelectorAll(selector);

  if (items.length === 0) return;

  // Set initial tabindex
  items.forEach((item, index) => {
    item.setAttribute('tabindex', index === 0 ? '0' : '-1');
  });

  // Handle keyboard navigation
  container.addEventListener('keydown', (e) => {
    const currentIndex = Array.from(items).indexOf(document.activeElement);
    if (currentIndex === -1) return;

    let nextIndex = -1;
    const isHorizontal = orientation === 'horizontal';

    switch (e.key) {
      case isHorizontal ? 'ArrowRight' : 'ArrowDown':
        nextIndex = currentIndex + 1;
        if (wrap && nextIndex >= items.length) nextIndex = 0;
        break;
      case isHorizontal ? 'ArrowLeft' : 'ArrowUp':
        nextIndex = currentIndex - 1;
        if (wrap && nextIndex < 0) nextIndex = items.length - 1;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = items.length - 1;
        break;
    }

    if (nextIndex >= 0 && nextIndex < items.length) {
      e.preventDefault();
      items[currentIndex].setAttribute('tabindex', '-1');
      items[nextIndex].setAttribute('tabindex', '0');
      items[nextIndex].focus();
    }
  });
}

/**
 * Create accessible label for element
 */
export function setAccessibleLabel(element, label) {
  element.setAttribute('aria-label', label);
}

/**
 * Set element as described by another element
 */
export function setDescribedBy(element, descriptionId) {
  element.setAttribute('aria-describedby', descriptionId);
}

/**
 * Mark element as expanded/collapsed
 */
export function setExpanded(element, expanded) {
  element.setAttribute('aria-expanded', String(expanded));
}

/**
 * Mark element as pressed (toggle button)
 */
export function setPressed(element, pressed) {
  element.setAttribute('aria-pressed', String(pressed));
}

/**
 * Mark element as selected
 */
export function setSelected(element, selected) {
  element.setAttribute('aria-selected', String(selected));
}

/**
 * Mark element as busy/loading
 */
export function setBusy(element, busy) {
  element.setAttribute('aria-busy', String(busy));
}

/**
 * Set value for range elements (sliders, progress)
 */
export function setValueNow(element, value, min = 0, max = 100) {
  element.setAttribute('role', 'slider');
  element.setAttribute('aria-valuenow', String(value));
  element.setAttribute('aria-valuemin', String(min));
  element.setAttribute('aria-valuemax', String(max));
}

/**
 * Set up accessible keyboard event handlers
 */
export function setupAccessibleEventHandlers() {
  const eventBus = getEventBus();

  // Announce tool changes
  eventBus.on(Events.TOOL_CHANGED, ({ tool }) => {
    announce(`${tool} tool selected`);
  });

  // Announce layer selection
  eventBus.on(Events.LAYER_SELECTED, ({ layer }) => {
    if (layer) {
      announce(`Layer "${layer.name}" selected`);
    }
  });

  // Announce undo/redo
  eventBus.on(Events.HISTORY_UNDO, ({ action }) => {
    announce(`Undid: ${action?.description || 'action'}`);
  });

  eventBus.on(Events.HISTORY_REDO, ({ action }) => {
    announce(`Redid: ${action?.description || 'action'}`);
  });

  // Announce document events
  eventBus.on(Events.DOCUMENT_CREATED, () => {
    announce('New document created');
  });

  eventBus.on(Events.DOCUMENT_OPENED, ({ document }) => {
    announce(`Opened ${document?.name || 'document'}`);
  });

  eventBus.on(Events.DOCUMENT_SAVED, () => {
    announce('Document saved');
  });

  // Announce file operations
  eventBus.on(Events.FILE_IMPORT_START, () => {
    announce('Opening file...');
  });

  eventBus.on(Events.FILE_IMPORT_COMPLETE, () => {
    announce('File opened successfully');
  });

  eventBus.on(Events.FILE_IMPORT_ERROR, () => {
    announceImmediate('Failed to open file');
  });
}

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Check if user prefers high contrast
 */
export function prefersHighContrast() {
  return window.matchMedia('(prefers-contrast: more)').matches;
}

/**
 * Initialize accessibility features
 */
export function initAccessibility() {
  // Create live region
  getLiveRegion();

  // Set up event handlers
  setupAccessibleEventHandlers();

  // Add skip link
  const skipLink = document.createElement('a');
  skipLink.href = '#main-canvas';
  skipLink.className = 'skip-link';
  skipLink.textContent = 'Skip to canvas';
  skipLink.style.cssText = `
    position: absolute;
    top: -40px;
    left: 0;
    background: var(--accent-color, #3b82f6);
    color: white;
    padding: 8px 16px;
    z-index: 100000;
    transition: top 0.2s;
  `;
  skipLink.addEventListener('focus', () => {
    skipLink.style.top = '0';
  });
  skipLink.addEventListener('blur', () => {
    skipLink.style.top = '-40px';
  });
  document.body.insertBefore(skipLink, document.body.firstChild);

  console.log('Accessibility features initialized');
}
