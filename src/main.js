/**
 * Photo Editor - Main Application Entry Point
 * Initializes all components, state, and sets up the editor
 */

// Core
import { Store, createInitialState } from './core/store.js';
import { EventBus, getEventBus, Events } from './core/event-bus.js';
import { getHistory } from './core/commands.js';
import { getShortcuts, ShortcutContext } from './core/shortcuts.js';

// Document
import { Document, createDocument, createDocumentFromImage } from './document/document.js';
import { createRasterLayer, createLayerFromImage } from './document/layer.js';

// Tools
import { getToolManager } from './tools/tool-manager.js';
import { BrushTool } from './tools/brush/brush-tool.js';
import { EraserTool } from './tools/eraser-tool.js';
import { MoveTool } from './tools/move-tool.js';
import { EyedropperTool } from './tools/eyedropper-tool.js';
import { FillTool } from './tools/fill-tool.js';
import { RectangularMarqueeTool, EllipticalMarqueeTool } from './tools/selection/marquee-tool.js';
import { LassoTool, PolygonalLassoTool } from './tools/selection/lasso-tool.js';
import { MagicWandTool } from './tools/selection/magic-wand-tool.js';
import { TransformTool } from './tools/transform-tool.js';
import { GradientTool } from './tools/gradient-tool.js';
import { CropTool } from './tools/crop-tool.js';

// Document
import { Selection } from './document/selection.js';

// Components
import './components/app-shell.js';
import './components/canvas/editor-canvas.js';
import './components/canvas/canvas-overlay.js';
import './components/panels/layers-panel.js';
import './components/panels/color-panel.js';
import './components/panels/history-panel.js';
import './components/panels/brushes-panel.js';
import './components/panels/adjustments-panel.js';

// Dialogs
import './components/dialogs/export-dialog.js';
import { showExportDialog } from './components/dialogs/export-dialog.js';

// File I/O
import { importImageAsDocument, importImageAsLayer } from './io/image-import.js';
import { importPSD } from './io/psd/psd-import.js';

/**
 * Main Photo Editor Application
 */
class PhotoEditorApp {
  constructor() {
    this.store = null;
    this.eventBus = null;
    this.history = null;
    this.shortcuts = null;
    this.toolManager = null;
    this.document = null;
    this.selection = null;
  }

  /**
   * Initialize the application
   */
  async init() {
    console.log('Initializing Photo Editor...');

    // Initialize state
    this.store = new Store(createInitialState());

    // Initialize event bus
    this.eventBus = getEventBus();

    // Initialize history
    this.history = getHistory();
    this.history.init();

    // Initialize shortcuts
    this.shortcuts = getShortcuts();
    this.shortcuts.init();
    this.registerShortcuts();

    // Initialize tool manager
    this.toolManager = getToolManager();
    this.toolManager.init();
    this.registerTools();

    // Set up event handlers
    this.setupEventHandlers();

    // Create default document
    this.newDocument({
      width: 1920,
      height: 1080,
      name: 'Untitled',
      backgroundColor: '#ffffff'
    });

    // Set default tool
    this.setTool('brush');

    console.log('Photo Editor initialized');

    // Expose to global for debugging and component access
    window.photoEditorApp = this;
  }

  /**
   * Register all tools
   */
  registerTools() {
    // Paint tools
    this.toolManager.register('brush', new BrushTool());
    this.toolManager.register('eraser', new EraserTool());
    this.toolManager.register('fill', new FillTool());
    this.toolManager.register('eyedropper', new EyedropperTool());

    // Selection tools
    this.toolManager.register('marquee', new RectangularMarqueeTool());
    this.toolManager.register('ellipticalMarquee', new EllipticalMarqueeTool());
    this.toolManager.register('lasso', new LassoTool());
    this.toolManager.register('polygonalLasso', new PolygonalLassoTool());
    this.toolManager.register('magicWand', new MagicWandTool());

    // Transform tools
    this.toolManager.register('move', new MoveTool());
    this.toolManager.register('transform', new TransformTool());
    this.toolManager.register('crop', new CropTool());

    // Gradient tool
    this.toolManager.register('gradient', new GradientTool());
  }

  /**
   * Register keyboard shortcuts
   */
  registerShortcuts() {
    const s = this.shortcuts;

    // File operations
    s.register('ctrl+n', () => this.showNewDocumentDialog(), {
      description: 'New Document'
    });

    s.register('ctrl+o', () => this.openFile(), {
      description: 'Open File'
    });

    s.register('ctrl+s', () => this.save(), {
      description: 'Save'
    });

    s.register('ctrl+shift+e', () => this.export(), {
      description: 'Export'
    });

    // Edit operations
    s.register('ctrl+z', () => this.undo(), {
      description: 'Undo'
    });

    s.register('ctrl+shift+z', () => this.redo(), {
      description: 'Redo'
    });

    s.register('ctrl+y', () => this.redo(), {
      description: 'Redo'
    });

    // Tools
    s.register('v', () => this.setTool('move'), {
      description: 'Move Tool'
    });

    s.register('b', () => this.setTool('brush'), {
      description: 'Brush Tool'
    });

    s.register('e', () => this.setTool('eraser'), {
      description: 'Eraser Tool'
    });

    s.register('g', () => this.setTool('fill'), {
      description: 'Fill Tool'
    });

    s.register('i', () => this.setTool('eyedropper'), {
      description: 'Eyedropper Tool'
    });

    // Brush size
    s.register('bracketleft', () => this.decreaseBrushSize(), {
      description: 'Decrease Brush Size'
    });

    s.register('bracketright', () => this.increaseBrushSize(), {
      description: 'Increase Brush Size'
    });

    // Colors
    s.register('x', () => this.swapColors(), {
      description: 'Swap Colors'
    });

    s.register('d', () => this.resetColors(), {
      description: 'Reset Colors'
    });

    // View
    s.register('ctrl+plus', () => this.zoomIn(), {
      description: 'Zoom In'
    });

    s.register('ctrl+equals', () => this.zoomIn(), {
      description: 'Zoom In'
    });

    s.register('ctrl+minus', () => this.zoomOut(), {
      description: 'Zoom Out'
    });

    s.register('ctrl+0', () => this.fitToScreen(), {
      description: 'Fit to Screen'
    });

    // Delete
    s.register('delete', () => this.deleteSelected(), {
      description: 'Delete'
    });

    s.register('backspace', () => this.deleteSelected(), {
      description: 'Delete'
    });
  }

  /**
   * Set up event handlers
   */
  setupEventHandlers() {
    // Toolbar actions
    this.eventBus.on('toolbar:new', () => this.showNewDocumentDialog());
    this.eventBus.on('toolbar:open', () => this.openFile());
    this.eventBus.on('toolbar:save', () => this.save());
    this.eventBus.on('toolbar:undo', () => this.undo());
    this.eventBus.on('toolbar:redo', () => this.redo());

    // Handle file drops
    document.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });

    document.addEventListener('drop', (e) => {
      e.preventDefault();
      this.handleFileDrop(e.dataTransfer.files);
    });
  }

  // ========== Document Operations ==========

  /**
   * Create a new document
   */
  newDocument(options = {}) {
    this.document = createDocument({
      width: options.width || 1920,
      height: options.height || 1080,
      name: options.name || 'Untitled',
      backgroundColor: options.backgroundColor || '#ffffff',
      transparentBackground: options.transparentBackground || false
    });

    // Sync to store
    this.document.syncToStore();

    // Clear history
    this.history.clear();

    this.eventBus.emit(Events.DOCUMENT_CREATED, { document: this.document });

    return this.document;
  }

  showNewDocumentDialog() {
    // For now, just create a default document
    // TODO: Show actual dialog
    this.newDocument();
  }

  /**
   * Open a file
   */
  async openFile() {
    try {
      // Use File System Access API if available
      if ('showOpenFilePicker' in window) {
        const [handle] = await window.showOpenFilePicker({
          types: [
            {
              description: 'Images',
              accept: {
                'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp']
              }
            },
            {
              description: 'Photoshop Files',
              accept: {
                'image/vnd.adobe.photoshop': ['.psd']
              }
            }
          ]
        });

        const file = await handle.getFile();
        await this.loadFile(file);
      } else {
        // Fallback to input element
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*,.psd';

        input.onchange = async (e) => {
          const file = e.target.files[0];
          if (file) {
            await this.loadFile(file);
          }
        };

        input.click();
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error opening file:', error);
      }
    }
  }

  /**
   * Load a file (image or PSD)
   */
  async loadFile(file) {
    const extension = file.name.split('.').pop().toLowerCase();

    if (extension === 'psd') {
      await this.loadPSDFile(file);
    } else {
      await this.loadImageFile(file);
    }
  }

  /**
   * Load a PSD file
   */
  async loadPSDFile(file) {
    try {
      this.eventBus.emit(Events.FILE_IMPORT_START, { format: 'psd' });

      this.document = await importPSD(file);
      this.document.syncToStore();
      this.history.clear();

      this.eventBus.emit(Events.FILE_IMPORT_COMPLETE, { format: 'psd' });
      this.eventBus.emit(Events.DOCUMENT_OPENED, { document: this.document });
      this.eventBus.emit(Events.RENDER_REQUEST);

      return this.document;
    } catch (error) {
      console.error('Error loading PSD:', error);
      this.eventBus.emit(Events.FILE_IMPORT_ERROR, { error, format: 'psd' });
      throw error;
    }
  }

  /**
   * Load an image file
   */
  async loadImageFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (e) => {
        const img = new Image();

        img.onload = async () => {
          // Create document from image
          this.document = await createDocumentFromImage(img, file.name);
          this.document.syncToStore();
          this.history.clear();

          this.eventBus.emit(Events.DOCUMENT_OPENED, { document: this.document });
          this.eventBus.emit(Events.RENDER_REQUEST);

          resolve(this.document);
        };

        img.onerror = reject;
        img.src = e.target.result;
      };

      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Handle dropped files
   */
  async handleFileDrop(files) {
    if (files.length === 0) return;

    const file = files[0];
    const extension = file.name.split('.').pop().toLowerCase();

    if (extension === 'psd' || file.type.startsWith('image/')) {
      await this.loadFile(file);
    }
  }

  /**
   * Save the document
   */
  async save() {
    // Quick export as PNG
    await this.quickExport();
  }

  /**
   * Export the document - shows the export dialog
   */
  async export() {
    if (!this.document) return;
    showExportDialog(this.document);
  }

  /**
   * Quick export as PNG (for Ctrl+S)
   */
  async quickExport(format = 'image/png') {
    if (!this.document) return;

    try {
      const blob = await this.document.toBlob(format);

      if ('showSaveFilePicker' in window) {
        const handle = await window.showSaveFilePicker({
          suggestedName: `${this.document.name}.png`,
          types: [
            {
              description: 'PNG Image',
              accept: { 'image/png': ['.png'] }
            }
          ]
        });

        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
      } else {
        // Fallback
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.document.name}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }

      this.store.state.app.isDirty = false;
      this.eventBus.emit(Events.DOCUMENT_SAVED, { document: this.document });
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error exporting:', error);
      }
    }
  }

  // ========== Layer Operations ==========

  /**
   * Add a new layer
   */
  addLayer() {
    if (!this.document) return;

    const layer = createRasterLayer(
      `Layer ${this.document.layers.length}`,
      this.document.width,
      this.document.height
    );

    this.document.addLayer(layer);
    this.document.setActiveLayer(layer.id);

    return layer;
  }

  /**
   * Duplicate the active layer
   */
  duplicateLayer() {
    if (!this.document) return;

    const activeId = this.document.activeLayerId;
    if (activeId) {
      return this.document.duplicateLayer(activeId);
    }
  }

  /**
   * Delete the active layer
   */
  deleteLayer() {
    if (!this.document) return;
    if (this.document.layers.length <= 1) return; // Keep at least one layer

    const activeId = this.document.activeLayerId;
    if (activeId) {
      this.document.removeLayer(activeId);
    }
  }

  // ========== Tool Operations ==========

  /**
   * Set the active tool
   */
  setTool(toolName) {
    this.toolManager.setTool(toolName);
    this.eventBus.emit(Events.TOOL_CHANGED, { tool: toolName });
  }

  /**
   * Increase brush size
   */
  increaseBrushSize() {
    const size = this.store.state.tools.options.brush.size;
    const newSize = Math.min(500, size + (size < 10 ? 1 : size < 50 ? 5 : 10));
    this.store.state.tools.options.brush.size = newSize;
    this.eventBus.emit(Events.TOOL_OPTIONS_CHANGED, {
      tool: 'brush',
      options: this.store.state.tools.options.brush
    });
  }

  /**
   * Decrease brush size
   */
  decreaseBrushSize() {
    const size = this.store.state.tools.options.brush.size;
    const newSize = Math.max(1, size - (size <= 10 ? 1 : size <= 50 ? 5 : 10));
    this.store.state.tools.options.brush.size = newSize;
    this.eventBus.emit(Events.TOOL_OPTIONS_CHANGED, {
      tool: 'brush',
      options: this.store.state.tools.options.brush
    });
  }

  // ========== History Operations ==========

  undo() {
    this.history.undo();
  }

  redo() {
    this.history.redo();
  }

  // ========== Color Operations ==========

  swapColors() {
    const fg = this.store.state.colors.foreground;
    const bg = this.store.state.colors.background;
    this.store.state.colors.foreground = bg;
    this.store.state.colors.background = fg;
    this.eventBus.emit(Events.COLOR_SWAPPED);
  }

  resetColors() {
    this.store.state.colors.foreground = '#000000';
    this.store.state.colors.background = '#ffffff';
    this.eventBus.emit(Events.COLOR_FOREGROUND_CHANGED, { color: '#000000' });
    this.eventBus.emit(Events.COLOR_BACKGROUND_CHANGED, { color: '#ffffff' });
  }

  // ========== View Operations ==========

  zoomIn() {
    this.eventBus.emit('toolbar:zoom-in');
  }

  zoomOut() {
    this.eventBus.emit('toolbar:zoom-out');
  }

  fitToScreen() {
    this.eventBus.emit('toolbar:fit');
  }

  // ========== Selection Operations ==========

  selectAll() {
    // TODO: Implement selection
  }

  deselect() {
    this.store.state.document.selection = null;
    this.eventBus.emit(Events.SELECTION_CLEARED);
  }

  invertSelection() {
    // TODO: Implement
  }

  deleteSelected() {
    // TODO: Delete selection or active layer content
  }

  cancelOperation() {
    this.deselect();
  }

  startTransform() {
    // TODO: Implement transform tool
  }
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const app = new PhotoEditorApp();
    app.init();
  });
} else {
  const app = new PhotoEditorApp();
  app.init();
}

export { PhotoEditorApp };
