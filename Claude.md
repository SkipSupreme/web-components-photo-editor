# Photoshop-Style Image Editor

A professional-grade image editor built with **Web Components**, **WebGL2**, and **vanilla JavaScript**. No frameworks, no build step required for development.

## Project Overview

This project implements a Photoshop-compatible image editor in the browser using modern web standards:

- **Web Components** for modular, encapsulated UI
- **WebGL2** for GPU-accelerated rendering and compositing
- **OffscreenCanvas + Web Workers** for non-blocking rendering
- **Pointer Events API** for unified mouse/touch/stylus input
- **ag-psd** for PSD file import/export
- **IndexedDB** for offline project storage

### Target Browsers

Chrome 90+, Edge 90+, Firefox 105+, Safari 16.4+

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Main Thread                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ Web Component│  │    State     │  │   Shortcut Manager       │  │
│  │      UI      │◄─┤    Store     │  │   (context-aware)        │  │
│  └──────────────┘  └──────┬───────┘  └──────────────────────────┘  │
│         │                 │                      │                  │
│         ▼                 ▼                      ▼                  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Event Bus (PubSub)                         │  │
│  └──────────────────────────────────────────────────────────────┘  │
│         │                                                           │
└─────────┼───────────────────────────────────────────────────────────┘
          │ postMessage (Transferable)
          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Render Worker                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │   WebGL2     │  │  Tile-Based  │  │   Layer Compositor       │  │
│  │  Renderer    │  │   Renderer   │  │   (blend modes)          │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
/
├── index.html                    # Entry point, minimal shell
├── Claude.md                     # This file - project context
├── LICENSE
│
├── src/
│   ├── main.js                   # App initialization
│   │
│   ├── core/
│   │   ├── store.js              # Proxy-based reactive state
│   │   ├── event-bus.js          # PubSub for decoupled communication
│   │   ├── command.js            # Command pattern base class
│   │   ├── history.js            # Undo/redo with snapshots + deltas
│   │   └── shortcuts.js          # Context-aware keyboard shortcuts
│   │
│   ├── engine/
│   │   ├── renderer.js           # Main thread renderer interface
│   │   ├── render-worker.js      # OffscreenCanvas WebGL worker
│   │   ├── webgl/
│   │   │   ├── context.js        # WebGL2 context management
│   │   │   ├── shaders.js        # Shader compilation utilities
│   │   │   ├── blend-modes.glsl  # All Photoshop blend modes
│   │   │   ├── filters.glsl      # Adjustment layer shaders
│   │   │   └── texture-pool.js   # GPU texture memory management
│   │   ├── tiles/
│   │   │   ├── tile-manager.js   # Tile-based rendering system
│   │   │   └── tile-cache.js     # LRU cache for rendered tiles
│   │   └── compositor.js         # Layer compositing logic
│   │
│   ├── document/
│   │   ├── document.js           # Document model (layers, canvas size)
│   │   ├── layer.js              # Layer class (raster, adjustment, group)
│   │   ├── mask.js               # Layer masks and clipping masks
│   │   ├── selection.js          # Selection state and operations
│   │   └── transform.js          # Layer transforms (rotate, scale, etc.)
│   │
│   ├── tools/
│   │   ├── tool-manager.js       # Tool switching and state
│   │   ├── base-tool.js          # Abstract tool interface
│   │   ├── brush/
│   │   │   ├── brush-tool.js     # Brush implementation
│   │   │   ├── brush-engine.js   # Pressure, interpolation, dabs
│   │   │   └── brush-presets.js  # Brush tip configurations
│   │   ├── eraser-tool.js
│   │   ├── move-tool.js
│   │   ├── selection/
│   │   │   ├── marquee-tool.js   # Rectangular/elliptical selection
│   │   │   ├── lasso-tool.js     # Freeform selection
│   │   │   └── magic-wand.js     # Color-based selection
│   │   ├── transform-tool.js
│   │   ├── eyedropper-tool.js
│   │   ├── fill-tool.js
│   │   └── gradient-tool.js
│   │
│   ├── effects/
│   │   ├── adjustments/          # Non-destructive adjustment layers
│   │   │   ├── brightness-contrast.js
│   │   │   ├── levels.js
│   │   │   ├── curves.js
│   │   │   ├── hue-saturation.js
│   │   │   └── color-balance.js
│   │   └── filters/              # Destructive filters
│   │       ├── blur.js
│   │       ├── sharpen.js
│   │       └── noise.js
│   │
│   ├── io/
│   │   ├── file-handler.js       # File System Access API wrapper
│   │   ├── psd/
│   │   │   ├── psd-import.js     # ag-psd import in worker
│   │   │   ├── psd-export.js     # ag-psd export
│   │   │   └── psd-worker.js     # Worker for PSD parsing
│   │   ├── image-import.js       # PNG, JPG, WebP import
│   │   └── image-export.js       # Export to various formats
│   │
│   ├── storage/
│   │   ├── db.js                 # IndexedDB setup (idb wrapper)
│   │   ├── project-store.js      # Project persistence
│   │   └── autosave.js           # Automatic saving logic
│   │
│   └── components/               # Web Components
│       ├── app-shell.js          # Main application container
│       ├── canvas/
│       │   ├── editor-canvas.js  # Main editing canvas
│       │   └── canvas-overlay.js # Selection, guides, rulers
│       ├── panels/
│       │   ├── panel-container.js    # Resizable panel wrapper
│       │   ├── layers-panel.js       # Layer list and controls
│       │   ├── properties-panel.js   # Context-sensitive properties
│       │   ├── tools-panel.js        # Tool palette
│       │   ├── brushes-panel.js      # Brush presets
│       │   ├── history-panel.js      # Undo history
│       │   └── color-picker.js       # Color selection
│       ├── toolbar/
│       │   ├── main-toolbar.js       # Top menu bar
│       │   └── tool-options.js       # Tool-specific options bar
│       ├── dialogs/
│       │   ├── base-dialog.js        # Dialog base using <dialog>
│       │   ├── new-document.js       # New document dialog
│       │   ├── canvas-size.js        # Resize canvas dialog
│       │   └── export-dialog.js      # Export options
│       └── shared/
│           ├── slider.js             # Custom range slider
│           ├── color-swatch.js       # Color display/picker trigger
│           ├── dropdown.js           # Custom select
│           └── icon.js               # SVG icon component
│
├── styles/
│   ├── main.css                  # Global styles, CSS custom properties
│   ├── themes/
│   │   ├── dark.css              # Dark theme variables
│   │   └── light.css             # Light theme variables
│   └── components/               # Shared component styles (adoptedStyleSheets)
│       └── panel.css
│
├── assets/
│   ├── icons/                    # SVG icons
│   └── cursors/                  # Custom tool cursors
│
├── workers/
│   ├── render-worker.js          # Main rendering worker
│   └── psd-worker.js             # PSD import/export worker
│
├── lib/                          # Vendored dependencies
│   ├── ag-psd.min.js             # PSD parsing
│   ├── idb.min.js                # IndexedDB wrapper
│   └── gl-matrix.min.js          # Matrix operations
│
└── sw.js                         # Service worker for PWA/offline
```

---

## Implementation Phases

### Phase 1: Foundation

**Goal:** Basic application shell with canvas rendering

1. Set up project structure and dev server
2. Implement core state management (`Store` class with Proxy)
3. Create event bus for component communication
4. Build basic Web Component shell (`<app-shell>`, `<editor-canvas>`)
5. Initialize WebGL2 context with basic rendering
6. Implement OffscreenCanvas transfer to worker
7. Basic single-layer display (load and show an image)

**Deliverables:**
- Working app that displays an image on a WebGL-rendered canvas
- Resizable/pannable viewport
- Basic zoom controls

### Phase 2: Layer System

**Goal:** Multi-layer document with compositing

1. Implement `Document` and `Layer` classes
2. Create layer compositing in WebGL (bottom-to-top)
3. Implement blend mode shaders (multiply, screen, overlay, etc.)
4. Build layers panel Web Component
5. Add layer opacity and visibility controls
6. Implement layer reordering (drag-and-drop)
7. Add layer groups (folders)

**Deliverables:**
- Create/delete/duplicate layers
- Reorder layers via drag-and-drop
- All standard blend modes working
- Layer visibility and opacity controls

### Phase 3: Tools - Selection & Transform

**Goal:** Core selection and transformation tools

1. Implement Tool Manager and base tool interface
2. Build Move tool with layer selection
3. Create rectangular/elliptical marquee tools
4. Implement magic wand with flood-fill algorithm
5. Add lasso (freeform) selection tool
6. Build Transform tool (scale, rotate, skew)
7. Marching ants selection visualization
8. Selection operations (add, subtract, intersect)

**Deliverables:**
- Working selection tools with modifier keys
- Transform tool with handles
- Selection persistence across tool switches

### Phase 4: Brush Engine

**Goal:** Pressure-sensitive painting system

1. Implement Pointer Events handling with coalesced events
2. Build brush engine with:
   - Pressure sensitivity curves
   - Bezier interpolation for smooth strokes
   - Brush tip stamping
3. Create Brush tool
4. Create Eraser tool
5. Add brush presets panel
6. Implement brush size/opacity shortcuts ([ ] keys)

**Deliverables:**
- Smooth, pressure-sensitive painting
- Multiple brush presets
- Eraser with same engine

### Phase 5: History System

**Goal:** Robust undo/redo with memory efficiency

1. Implement Command pattern base class
2. Build hybrid history (commands + periodic snapshots)
3. Add delta-based storage for paint operations
4. Create history panel component
5. Implement history seeking (click to jump)
6. Add compression for history states

**Deliverables:**
- Unlimited undo/redo
- History panel with thumbnails
- Memory-efficient storage

### Phase 6: Masks

**Goal:** Layer masks and clipping masks

1. Implement layer mask data structure
2. Add mask editing mode (paint on mask)
3. Create mask visualization (overlay, disable)
4. Implement clipping masks (clip to layer below)
5. Add mask operations (invert, apply, delete)

**Deliverables:**
- Layer masks with non-destructive editing
- Clipping mask groups
- Mask visibility toggles

### Phase 7: Adjustment Layers

**Goal:** Non-destructive image adjustments

1. Implement adjustment layer framework
2. Create WebGL shaders for adjustments
3. Build adjustment UIs:
   - Brightness/Contrast
   - Levels
   - Curves
   - Hue/Saturation
   - Color Balance
4. Properties panel for adjustment editing

**Deliverables:**
- Non-destructive adjustments
- Real-time preview
- Adjustment layers in layer stack

### Phase 8: File I/O

**Goal:** Full file import/export capability

1. Implement File System Access API wrapper
2. Set up PSD worker with ag-psd
3. Build PSD import (layers, masks, blend modes)
4. Build PSD export
5. Add PNG/JPG/WebP import/export
6. Create export dialog with format options
7. Implement drag-and-drop file opening

**Deliverables:**
- Open/save PSD files
- Export to web formats
- Native file picker integration

### Phase 9: PWA & Storage

**Goal:** Offline-capable progressive web app

1. Set up IndexedDB schema for projects
2. Implement project auto-save
3. Create service worker for offline support
4. Add "recent documents" functionality
5. Implement project recovery on crash/close
6. Request persistent storage

**Deliverables:**
- Works offline
- Auto-saves work in progress
- Recovers from browser close

### Phase 10: Polish & Performance

**Goal:** Production-ready application

1. Implement tile-based rendering for large images
2. Add texture pooling and memory management
3. Optimize WebGL shader compilation
4. Add loading states and progress indicators
5. Implement keyboard shortcut customization
6. Add light/dark theme support
7. Performance profiling and optimization
8. Accessibility improvements

**Deliverables:**
- Handles 4K+ images smoothly
- Responsive UI
- Customizable shortcuts
- Theme support

---

## Technical Specifications

### State Store

```javascript
// src/core/store.js
class Store {
  constructor(initialState) {
    this.listeners = new Map(); // path -> Set<callback>
    this.state = this.createProxy(initialState, []);
  }

  createProxy(obj, path) {
    return new Proxy(obj, {
      set: (target, key, value) => {
        target[key] = value;
        this.notify([...path, key]);
        return true;
      },
      get: (target, key) => {
        const value = target[key];
        if (value && typeof value === 'object') {
          return this.createProxy(value, [...path, key]);
        }
        return value;
      }
    });
  }

  subscribe(path, callback) {
    const key = path.join('.');
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key).add(callback);
    return () => this.listeners.get(key).delete(callback);
  }
}
```

### Tool Interface

```javascript
// src/tools/base-tool.js
class BaseTool {
  constructor(editor) {
    this.editor = editor;
    this.isActive = false;
  }

  // Override in subclasses
  onActivate() {}
  onDeactivate() {}
  onPointerDown(event) {}
  onPointerMove(event) {}
  onPointerUp(event) {}
  onKeyDown(event) {}
  onKeyUp(event) {}

  getCursor() { return 'default'; }
  getOptionsComponent() { return null; }
}
```

### Layer Compositing Shader

```glsl
// src/engine/webgl/blend-modes.glsl
precision highp float;

uniform sampler2D u_base;      // Layer below
uniform sampler2D u_blend;     // Current layer
uniform float u_opacity;
uniform int u_blendMode;

// Blend mode implementations
vec3 multiply(vec3 base, vec3 blend) {
  return base * blend;
}

vec3 screen(vec3 base, vec3 blend) {
  return 1.0 - (1.0 - base) * (1.0 - blend);
}

vec3 overlay(vec3 base, vec3 blend) {
  return mix(
    2.0 * base * blend,
    1.0 - 2.0 * (1.0 - base) * (1.0 - blend),
    step(0.5, base)
  );
}

// ... other blend modes

void main() {
  vec4 baseColor = texture2D(u_base, v_texCoord);
  vec4 blendColor = texture2D(u_blend, v_texCoord);

  vec3 result;
  if (u_blendMode == 0) result = blendColor.rgb; // Normal
  else if (u_blendMode == 1) result = multiply(baseColor.rgb, blendColor.rgb);
  else if (u_blendMode == 2) result = screen(baseColor.rgb, blendColor.rgb);
  // ... etc

  float alpha = blendColor.a * u_opacity;
  gl_FragColor = vec4(mix(baseColor.rgb, result, alpha),
                      baseColor.a + alpha * (1.0 - baseColor.a));
}
```

### Web Component Pattern

```javascript
// src/components/panels/layers-panel.js
class LayersPanel extends HTMLElement {
  static styles = new CSSStyleSheet();

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.adoptedStyleSheets = [LayersPanel.styles];
  }

  connectedCallback() {
    this.render();
    this.unsubscribe = store.subscribe(['document', 'layers'], () => {
      this.render();
    });
  }

  disconnectedCallback() {
    this.unsubscribe?.();
  }

  render() {
    const layers = store.state.document.layers;
    this.shadowRoot.innerHTML = `
      <div class="layers-panel">
        ${layers.map(layer => `
          <layer-item
            data-id="${layer.id}"
            data-name="${layer.name}"
            data-visible="${layer.visible}">
          </layer-item>
        `).join('')}
      </div>
    `;
  }
}

customElements.define('layers-panel', LayersPanel);
```

### Pressure Curve Implementation

```javascript
// src/tools/brush/brush-engine.js
class BrushEngine {
  constructor() {
    this.pressureGamma = 1.0; // 1.0 = linear, <1 = soft, >1 = firm
  }

  applyPressureCurve(pressure) {
    return Math.pow(pressure, this.pressureGamma);
  }

  processPointerEvent(event) {
    const points = event.getCoalescedEvents?.() || [event];

    return points.map(e => ({
      x: e.clientX,
      y: e.clientY,
      pressure: this.applyPressureCurve(e.pressure || 0.5),
      tiltX: e.tiltX || 0,
      tiltY: e.tiltY || 0,
      timestamp: e.timeStamp
    }));
  }
}
```

---

## Key Libraries

| Library | Purpose | Size |
|---------|---------|------|
| ag-psd | PSD read/write | ~200KB |
| idb | IndexedDB wrapper | ~1.2KB |
| gl-matrix | Matrix math for transforms | ~30KB |

All libraries should be vendored in `/lib` to avoid build steps.

---

## Development Guidelines

### No Build Required

The project runs directly in the browser during development. Use a simple static file server:

```bash
npx serve .
# or
python -m http.server 8000
```

### Module Loading

Use native ES modules with import maps for dependencies:

```html
<script type="importmap">
{
  "imports": {
    "ag-psd": "./lib/ag-psd.min.js",
    "idb": "./lib/idb.min.js"
  }
}
</script>
```

### Testing

Run tests with a browser-native test runner or simple test harness. Focus on:
- Unit tests for core logic (store, history, commands)
- Integration tests for layer compositing
- Visual regression tests for blend modes

### Performance Targets

- 60fps panning/zooming on 4K images
- < 16ms brush stroke latency
- < 100ms layer operation response
- < 2s PSD file open (10 layers)

---

## Keyboard Shortcuts (Default)

| Action | Shortcut |
|--------|----------|
| Undo | Ctrl+Z |
| Redo | Ctrl+Shift+Z |
| New Document | Ctrl+N |
| Open | Ctrl+O |
| Save | Ctrl+S |
| Export | Ctrl+Shift+E |
| Brush | B |
| Eraser | E |
| Move | V |
| Marquee | M |
| Lasso | L |
| Magic Wand | W |
| Eyedropper | I |
| Fill | G |
| Transform | Ctrl+T |
| Deselect | Ctrl+D |
| Invert Selection | Ctrl+Shift+I |
| Zoom In | Ctrl++ |
| Zoom Out | Ctrl+- |
| Fit to Screen | Ctrl+0 |
| Brush Size + | ] |
| Brush Size - | [ |

---

## Notes for Claude

When implementing features:

1. **Always use Pointer Events** over mouse events for stylus support
2. **Use `getCoalescedEvents()`** for smooth brush strokes
3. **Never block main thread** - heavy work goes to workers
4. **Prefer `canvas.toBlob()`** over `toDataURL()` for large images
5. **Test blend modes** against Photoshop reference images
6. **Use `transferControlToOffscreen()`** for the main canvas
7. **Implement commands** with both `execute()` and `undo()` methods
8. **Clean up resources** - set canvas dimensions to 0 when disposing
