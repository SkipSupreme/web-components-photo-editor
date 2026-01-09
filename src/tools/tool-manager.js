/**
 * Tool Manager - Manages tool switching and dispatches events to active tool
 */

import { getStore } from '../core/store.js';
import { getEventBus, Events } from '../core/event-bus.js';

class ToolManager {
  constructor() {
    this.tools = new Map();
    this.activeTool = null;
    this.store = null;
    this.eventBus = null;
  }

  init() {
    this.store = getStore();
    this.eventBus = getEventBus();

    // Listen for canvas events
    this.eventBus.on(Events.CANVAS_POINTER_DOWN, (e) => this.onPointerDown(e));
    this.eventBus.on(Events.CANVAS_POINTER_MOVE, (e) => this.onPointerMove(e));
    this.eventBus.on(Events.CANVAS_POINTER_UP, (e) => this.onPointerUp(e));

    // Listen for tool changes
    this.eventBus.on(Events.TOOL_CHANGED, ({ tool }) => this.setTool(tool));
    this.eventBus.on(Events.TOOL_OPTIONS_CHANGED, ({ tool, options }) => {
      const toolInstance = this.tools.get(tool);
      if (toolInstance) {
        toolInstance.updateOptions(options);
      }
    });
  }

  register(name, tool) {
    this.tools.set(name, tool);
    tool.manager = this;
  }

  setTool(name) {
    if (this.activeTool) {
      this.activeTool.onDeactivate();
    }

    this.activeTool = this.tools.get(name);

    if (this.activeTool) {
      this.activeTool.onActivate();
      this.store.state.tools.active = name;
    }
  }

  getTool(name) {
    return this.tools.get(name);
  }

  getActiveTool() {
    return this.activeTool;
  }

  onPointerDown(event) {
    if (this.activeTool) {
      this.activeTool.onPointerDown(event);
    }
  }

  onPointerMove(event) {
    if (this.activeTool) {
      this.activeTool.onPointerMove(event);
    }
  }

  onPointerUp(event) {
    if (this.activeTool) {
      this.activeTool.onPointerUp(event);
    }
  }
}

let toolManagerInstance = null;

export function getToolManager() {
  if (!toolManagerInstance) {
    toolManagerInstance = new ToolManager();
  }
  return toolManagerInstance;
}
