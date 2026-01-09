/**
 * Base Tool - Abstract base class for all tools
 */

export class BaseTool {
  constructor(name) {
    this.name = name;
    this.manager = null;
    this.isActive = false;
    this.options = {};
  }

  /**
   * Called when tool becomes active
   */
  onActivate() {
    this.isActive = true;
  }

  /**
   * Called when tool is deactivated
   */
  onDeactivate() {
    this.isActive = false;
  }

  /**
   * Handle pointer down
   */
  onPointerDown(event) {
    // Override in subclass
  }

  /**
   * Handle pointer move
   */
  onPointerMove(event) {
    // Override in subclass
  }

  /**
   * Handle pointer up
   */
  onPointerUp(event) {
    // Override in subclass
  }

  /**
   * Handle key down
   */
  onKeyDown(event) {
    // Override in subclass
  }

  /**
   * Handle key up
   */
  onKeyUp(event) {
    // Override in subclass
  }

  /**
   * Update tool options
   */
  updateOptions(options) {
    this.options = { ...this.options, ...options };
  }

  /**
   * Get cursor style for this tool
   */
  getCursor() {
    return 'default';
  }
}
