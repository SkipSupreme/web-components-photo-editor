/**
 * Eyedropper Tool - Pick colors from the canvas
 */

import { BaseTool } from './base-tool.js';
import { getStore } from '../core/store.js';
import { getEventBus, Events } from '../core/event-bus.js';

export class EyedropperTool extends BaseTool {
  constructor() {
    super('eyedropper');

    this.store = null;
    this.eventBus = null;
    this.isPicking = false;
  }

  onActivate() {
    super.onActivate();
    this.store = getStore();
    this.eventBus = getEventBus();
  }

  onPointerDown(event) {
    this.isPicking = true;
    this.pickColor(event);
  }

  onPointerMove(event) {
    if (this.isPicking) {
      this.pickColor(event);
    }
  }

  onPointerUp(event) {
    this.isPicking = false;
  }

  pickColor(event) {
    const app = window.photoEditorApp;
    if (!app || !app.document) return;

    // Sample from all visible layers (composite)
    const x = Math.floor(event.x);
    const y = Math.floor(event.y);

    // Find the topmost visible layer with a pixel at this position
    const layers = [...app.document.layers].reverse();

    for (const layer of layers) {
      if (!layer.visible || !layer.ctx) continue;

      // Check if point is within layer bounds
      const localX = x - layer.x;
      const localY = y - layer.y;

      if (localX < 0 || localX >= layer.width ||
          localY < 0 || localY >= layer.height) {
        continue;
      }

      const imageData = layer.ctx.getImageData(localX, localY, 1, 1);
      const [r, g, b, a] = imageData.data;

      // Skip transparent pixels
      if (a < 10) continue;

      const hex = this.rgbToHex(r, g, b);
      this.store.state.colors.foreground = hex;
      this.eventBus.emit(Events.COLOR_FOREGROUND_CHANGED, { color: hex });
      return;
    }
  }

  rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }

  getCursor() {
    return 'crosshair';
  }
}
