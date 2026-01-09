/**
 * Tools Tests
 * Tests for tool manager, brush engine, and individual tools
 */

import { TestRunner, assert } from './test-runner.js';
import { getToolManager, ToolManager } from '../src/tools/tool-manager.js';
import { BaseTool } from '../src/tools/base-tool.js';
import { BrushTool } from '../src/tools/brush/brush-tool.js';
import { BrushEngine } from '../src/tools/brush/brush-engine.js';
import { BrushPresets, getDefaultPresets } from '../src/tools/brush/brush-presets.js';
import { EraserTool } from '../src/tools/eraser-tool.js';
import { MoveTool } from '../src/tools/move-tool.js';
import { EyedropperTool } from '../src/tools/eyedropper-tool.js';
import { FillTool } from '../src/tools/fill-tool.js';
import { GradientTool } from '../src/tools/gradient-tool.js';
import { CropTool } from '../src/tools/crop-tool.js';
import { TransformTool } from '../src/tools/transform-tool.js';
import { RectangularMarqueeTool, EllipticalMarqueeTool } from '../src/tools/selection/marquee-tool.js';
import { LassoTool, PolygonalLassoTool } from '../src/tools/selection/lasso-tool.js';
import { MagicWandTool } from '../src/tools/selection/magic-wand-tool.js';

const runner = new TestRunner();

// ============ Tool Manager Tests ============
runner.describe('ToolManager', () => {
  let toolManager;

  runner.beforeEach(() => {
    toolManager = getToolManager();
  });

  runner.it('should be singleton', () => {
    const tm1 = getToolManager();
    const tm2 = getToolManager();
    assert.equal(tm1, tm2);
  });

  runner.it('should register tools', () => {
    class TestTool extends BaseTool {
      constructor() { super('test-tool'); }
    }
    toolManager.registerTool('test', TestTool);
    assert.exists(toolManager.tools.get('test'));
  });

  runner.it('should switch tools', () => {
    toolManager.setTool('brush');
    assert.equal(toolManager.currentToolName, 'brush');
  });

  runner.it('should get current tool', () => {
    toolManager.setTool('brush');
    const tool = toolManager.getCurrentTool();
    assert.exists(tool);
  });
});

// ============ Base Tool Tests ============
runner.describe('BaseTool', () => {
  runner.it('should create with name', () => {
    const tool = new BaseTool('test');
    assert.equal(tool.name, 'test');
  });

  runner.it('should have lifecycle methods', () => {
    const tool = new BaseTool('test');
    assert.typeOf(tool.onActivate, 'function');
    assert.typeOf(tool.onDeactivate, 'function');
    assert.typeOf(tool.onPointerDown, 'function');
    assert.typeOf(tool.onPointerMove, 'function');
    assert.typeOf(tool.onPointerUp, 'function');
  });

  runner.it('should have cursor method', () => {
    const tool = new BaseTool('test');
    assert.typeOf(tool.getCursor, 'function');
  });
});

// ============ Brush Engine Tests ============
runner.describe('BrushEngine', () => {
  let engine;

  runner.beforeEach(() => {
    engine = new BrushEngine();
  });

  runner.it('should create brush engine', () => {
    assert.exists(engine);
  });

  runner.it('should have default settings', () => {
    assert.exists(engine.size);
    assert.exists(engine.opacity);
    assert.exists(engine.hardness);
  });

  runner.it('should apply pressure curve', () => {
    const result = engine.applyPressureCurve(0.5);
    assert.typeOf(result, 'number');
    assert.greaterThan(result, 0);
    assert.lessThan(result, 1);
  });

  runner.it('should interpolate between points', () => {
    const points = engine.interpolatePoints(
      { x: 0, y: 0, pressure: 0.5 },
      { x: 100, y: 100, pressure: 0.5 }
    );
    assert.greaterThan(points.length, 2);
  });
});

// ============ Brush Presets Tests ============
runner.describe('BrushPresets', () => {
  runner.it('should have default presets', () => {
    const presets = getDefaultPresets();
    assert.exists(presets);
    assert.greaterThan(presets.length, 0);
  });

  runner.it('should have preset properties', () => {
    const presets = getDefaultPresets();
    const preset = presets[0];
    assert.hasProperty(preset, 'name');
    assert.hasProperty(preset, 'size');
    assert.hasProperty(preset, 'opacity');
    assert.hasProperty(preset, 'hardness');
  });
});

// ============ Individual Tools Existence Tests ============
runner.describe('Tool Classes', () => {
  runner.it('should have BrushTool', () => {
    const tool = new BrushTool();
    assert.exists(tool);
    assert.equal(tool.name, 'brush');
  });

  runner.it('should have EraserTool', () => {
    const tool = new EraserTool();
    assert.exists(tool);
    assert.equal(tool.name, 'eraser');
  });

  runner.it('should have MoveTool', () => {
    const tool = new MoveTool();
    assert.exists(tool);
    assert.equal(tool.name, 'move');
  });

  runner.it('should have EyedropperTool', () => {
    const tool = new EyedropperTool();
    assert.exists(tool);
    assert.equal(tool.name, 'eyedropper');
  });

  runner.it('should have FillTool', () => {
    const tool = new FillTool();
    assert.exists(tool);
    assert.equal(tool.name, 'fill');
  });

  runner.it('should have GradientTool', () => {
    const tool = new GradientTool();
    assert.exists(tool);
    assert.equal(tool.name, 'gradient');
  });

  runner.it('should have CropTool', () => {
    const tool = new CropTool();
    assert.exists(tool);
    assert.equal(tool.name, 'crop');
  });

  runner.it('should have TransformTool', () => {
    const tool = new TransformTool();
    assert.exists(tool);
    assert.equal(tool.name, 'transform');
  });

  runner.it('should have RectangularMarqueeTool', () => {
    const tool = new RectangularMarqueeTool();
    assert.exists(tool);
  });

  runner.it('should have EllipticalMarqueeTool', () => {
    const tool = new EllipticalMarqueeTool();
    assert.exists(tool);
  });

  runner.it('should have LassoTool', () => {
    const tool = new LassoTool();
    assert.exists(tool);
  });

  runner.it('should have PolygonalLassoTool', () => {
    const tool = new PolygonalLassoTool();
    assert.exists(tool);
  });

  runner.it('should have MagicWandTool', () => {
    const tool = new MagicWandTool();
    assert.exists(tool);
  });
});

export { runner as toolsTests };
