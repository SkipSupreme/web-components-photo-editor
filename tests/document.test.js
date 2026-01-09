/**
 * Document and Layer Tests
 * Tests for document creation, layer operations, and masks
 */

import { TestRunner, assert } from './test-runner.js';
import {
  Document,
  createDocument,
  createDocumentFromImage
} from '../src/document/document.js';
import {
  Layer,
  LayerType,
  BlendMode,
  createRasterLayer,
  createAdjustmentLayer,
  createLayerGroup,
  createLayerFromImage
} from '../src/document/layer.js';
import { Selection } from '../src/document/selection.js';

const runner = new TestRunner();

// ============ Document Tests ============
runner.describe('Document', () => {
  let doc;

  runner.beforeEach(() => {
    doc = createDocument({
      width: 800,
      height: 600,
      name: 'Test Document'
    });
  });

  runner.it('should create document with correct dimensions', () => {
    assert.equal(doc.width, 800);
    assert.equal(doc.height, 600);
    assert.equal(doc.name, 'Test Document');
  });

  runner.it('should have unique ID', () => {
    const doc2 = createDocument({ width: 100, height: 100 });
    assert.exists(doc.id);
    assert.exists(doc2.id);
    assert.true(doc.id !== doc2.id);
  });

  runner.it('should create with background layer', () => {
    assert.greaterThan(doc.layers.length, 0);
  });

  runner.it('should add layers', () => {
    const initialCount = doc.layers.length;
    const layer = createRasterLayer('New Layer', doc.width, doc.height);
    doc.addLayer(layer);
    assert.equal(doc.layers.length, initialCount + 1);
  });

  runner.it('should remove layers', () => {
    const layer = createRasterLayer('Temp', doc.width, doc.height);
    doc.addLayer(layer);
    const countBefore = doc.layers.length;
    doc.removeLayer(layer.id);
    assert.equal(doc.layers.length, countBefore - 1);
  });

  runner.it('should set active layer', () => {
    const layer = createRasterLayer('Active', doc.width, doc.height);
    doc.addLayer(layer);
    doc.setActiveLayer(layer.id);
    assert.equal(doc.activeLayerId, layer.id);
  });

  runner.it('should find layer by ID', () => {
    const layer = createRasterLayer('Find Me', doc.width, doc.height);
    doc.addLayer(layer);
    const found = doc.getLayerById(layer.id);
    assert.exists(found);
    assert.equal(found.name, 'Find Me');
  });

  runner.it('should reorder layers', () => {
    const layer1 = createRasterLayer('Layer 1', doc.width, doc.height);
    const layer2 = createRasterLayer('Layer 2', doc.width, doc.height);
    doc.addLayer(layer1);
    doc.addLayer(layer2);

    const idx2 = doc.layers.indexOf(layer2);
    doc.moveLayer(layer2.id, 0);
    assert.equal(doc.layers[0], layer2);
  });

  runner.it('should duplicate layers', () => {
    const layer = createRasterLayer('Original', doc.width, doc.height);
    doc.addLayer(layer);
    const countBefore = doc.layers.length;
    doc.duplicateLayer(layer.id);
    assert.equal(doc.layers.length, countBefore + 1);
  });
});

// ============ Layer Tests ============
runner.describe('Layer', () => {
  runner.it('should create raster layer', () => {
    const layer = createRasterLayer('Raster', 100, 100);
    assert.exists(layer);
    assert.equal(layer.type, LayerType.RASTER);
    assert.equal(layer.name, 'Raster');
    assert.equal(layer.width, 100);
    assert.equal(layer.height, 100);
  });

  runner.it('should have canvas for raster layer', () => {
    const layer = createRasterLayer('Raster', 100, 100);
    assert.exists(layer.canvas);
    assert.exists(layer.ctx);
  });

  runner.it('should create adjustment layer', () => {
    const layer = createAdjustmentLayer('brightness-contrast', 'BC Adjust');
    assert.exists(layer);
    assert.equal(layer.type, LayerType.ADJUSTMENT);
    assert.exists(layer.adjustment);
  });

  runner.it('should create layer group', () => {
    const group = createLayerGroup('Group 1');
    assert.exists(group);
    assert.equal(group.type, LayerType.GROUP);
    assert.exists(group.children);
  });

  runner.it('should have default properties', () => {
    const layer = createRasterLayer('Test', 100, 100);
    assert.equal(layer.opacity, 1);
    assert.equal(layer.visible, true);
    assert.equal(layer.blendMode, BlendMode.NORMAL);
    assert.equal(layer.locked, false);
  });

  runner.it('should update opacity', () => {
    const layer = createRasterLayer('Test', 100, 100);
    layer.opacity = 0.5;
    assert.equal(layer.opacity, 0.5);
  });

  runner.it('should update visibility', () => {
    const layer = createRasterLayer('Test', 100, 100);
    layer.visible = false;
    assert.equal(layer.visible, false);
  });

  runner.it('should update blend mode', () => {
    const layer = createRasterLayer('Test', 100, 100);
    layer.blendMode = BlendMode.MULTIPLY;
    assert.equal(layer.blendMode, BlendMode.MULTIPLY);
  });

  runner.it('should add children to group', () => {
    const group = createLayerGroup('Group');
    const child = createRasterLayer('Child', 100, 100);
    group.addChild(child);
    assert.equal(group.children.length, 1);
    assert.equal(group.children[0], child);
  });
});

// ============ Layer Type Constants ============
runner.describe('Layer Types and Blend Modes', () => {
  runner.it('should have all layer types defined', () => {
    assert.exists(LayerType.RASTER);
    assert.exists(LayerType.ADJUSTMENT);
    assert.exists(LayerType.GROUP);
  });

  runner.it('should have all blend modes defined', () => {
    assert.exists(BlendMode.NORMAL);
    assert.exists(BlendMode.MULTIPLY);
    assert.exists(BlendMode.SCREEN);
    assert.exists(BlendMode.OVERLAY);
    assert.exists(BlendMode.DARKEN);
    assert.exists(BlendMode.LIGHTEN);
  });
});

// ============ Selection Tests ============
runner.describe('Selection', () => {
  let selection;

  runner.beforeEach(() => {
    selection = new Selection(800, 600);
  });

  runner.it('should create selection with dimensions', () => {
    assert.exists(selection);
    assert.equal(selection.width, 800);
    assert.equal(selection.height, 600);
  });

  runner.it('should create rectangular selection', () => {
    selection.selectRect(100, 100, 200, 150);
    assert.true(selection.hasSelection());
  });

  runner.it('should create elliptical selection', () => {
    selection.selectEllipse(400, 300, 100, 75);
    assert.true(selection.hasSelection());
  });

  runner.it('should clear selection', () => {
    selection.selectRect(100, 100, 200, 150);
    selection.clear();
    assert.false(selection.hasSelection());
  });

  runner.it('should invert selection', () => {
    selection.selectRect(100, 100, 200, 150);
    selection.invert();
    assert.true(selection.hasSelection());
  });

  runner.it('should check if point is in selection', () => {
    selection.selectRect(100, 100, 200, 150);
    assert.true(selection.containsPoint(150, 150));
    assert.false(selection.containsPoint(50, 50));
  });

  runner.it('should select all', () => {
    selection.selectAll();
    assert.true(selection.hasSelection());
    assert.true(selection.containsPoint(0, 0));
    assert.true(selection.containsPoint(799, 599));
  });
});

export { runner as documentTests };
