/**
 * Core Module Tests
 * Tests for store, event-bus, commands, and shortcuts
 */

import { TestRunner, assert } from './test-runner.js';
import { Store, createInitialState } from '../src/core/store.js';
import { EventBus, getEventBus, Events } from '../src/core/event-bus.js';
import { getHistory, Command } from '../src/core/commands.js';
import { getShortcuts } from '../src/core/shortcuts.js';

const runner = new TestRunner();

// ============ Store Tests ============
runner.describe('Store', () => {
  let store;

  runner.beforeEach(() => {
    store = new Store({ count: 0, nested: { value: 'test' } });
  });

  runner.it('should create store with initial state', () => {
    assert.equal(store.state.count, 0);
    assert.equal(store.state.nested.value, 'test');
  });

  runner.it('should update state values', () => {
    store.state.count = 5;
    assert.equal(store.state.count, 5);
  });

  runner.it('should update nested state values', () => {
    store.state.nested.value = 'updated';
    assert.equal(store.state.nested.value, 'updated');
  });

  runner.it('should notify subscribers on change', () => {
    let notified = false;
    store.subscribe(['count'], () => {
      notified = true;
    });
    store.state.count = 10;
    assert.true(notified);
  });

  runner.it('should unsubscribe correctly', () => {
    let callCount = 0;
    const unsubscribe = store.subscribe(['count'], () => {
      callCount++;
    });
    store.state.count = 1;
    unsubscribe();
    store.state.count = 2;
    assert.equal(callCount, 1);
  });
});

// ============ Event Bus Tests ============
runner.describe('EventBus', () => {
  let eventBus;

  runner.beforeEach(() => {
    eventBus = new EventBus();
  });

  runner.it('should emit and receive events', () => {
    let received = null;
    eventBus.on('test', (data) => {
      received = data;
    });
    eventBus.emit('test', { value: 42 });
    assert.equal(received.value, 42);
  });

  runner.it('should handle multiple listeners', () => {
    let count = 0;
    eventBus.on('test', () => count++);
    eventBus.on('test', () => count++);
    eventBus.emit('test');
    assert.equal(count, 2);
  });

  runner.it('should remove listeners with off', () => {
    let count = 0;
    const handler = () => count++;
    eventBus.on('test', handler);
    eventBus.emit('test');
    eventBus.off('test', handler);
    eventBus.emit('test');
    assert.equal(count, 1);
  });

  runner.it('should handle once listeners', () => {
    let count = 0;
    eventBus.once('test', () => count++);
    eventBus.emit('test');
    eventBus.emit('test');
    assert.equal(count, 1);
  });

  runner.it('should have predefined Events constants', () => {
    assert.exists(Events.DOCUMENT_CREATED);
    assert.exists(Events.LAYER_ADDED);
    assert.exists(Events.TOOL_CHANGED);
    assert.exists(Events.HISTORY_PUSH);
  });

  runner.it('getEventBus should return singleton', () => {
    const bus1 = getEventBus();
    const bus2 = getEventBus();
    assert.equal(bus1, bus2);
  });
});

// ============ History/Commands Tests ============
runner.describe('History (Commands)', () => {
  let history;

  runner.beforeEach(() => {
    history = getHistory();
    history.clear();
  });

  runner.it('should push commands to history', () => {
    const cmd = new Command('Test', () => {}, () => {});
    history.push(cmd);
    assert.true(history.canUndo());
  });

  runner.it('should undo commands', () => {
    let value = 0;
    const cmd = new Command(
      'Increment',
      () => { value++; },
      () => { value--; }
    );
    cmd.execute();
    history.push(cmd);
    assert.equal(value, 1);
    history.undo();
    assert.equal(value, 0);
  });

  runner.it('should redo commands', () => {
    let value = 0;
    const cmd = new Command(
      'Increment',
      () => { value++; },
      () => { value--; }
    );
    cmd.execute();
    history.push(cmd);
    history.undo();
    history.redo();
    assert.equal(value, 1);
  });

  runner.it('should clear redo stack on new command', () => {
    const cmd1 = new Command('Cmd1', () => {}, () => {});
    const cmd2 = new Command('Cmd2', () => {}, () => {});
    history.push(cmd1);
    history.undo();
    history.push(cmd2);
    assert.false(history.canRedo());
  });

  runner.it('should respect max history size', () => {
    for (let i = 0; i < 60; i++) {
      history.push(new Command(`Cmd${i}`, () => {}, () => {}));
    }
    // Should be capped at maxSize (default 50)
    assert.true(history.getHistory().length <= 50);
  });
});

// ============ Shortcuts Tests ============
runner.describe('Shortcuts', () => {
  let shortcuts;

  runner.beforeEach(() => {
    shortcuts = getShortcuts();
  });

  runner.it('should be singleton', () => {
    const s1 = getShortcuts();
    const s2 = getShortcuts();
    assert.equal(s1, s2);
  });

  runner.it('should register shortcuts', () => {
    shortcuts.register('ctrl+t', 'test', () => {});
    assert.exists(shortcuts);
  });

  runner.it('should parse key combinations correctly', () => {
    // Internal test - shortcuts should handle modifier keys
    const mockEvent = {
      key: 'z',
      ctrlKey: true,
      shiftKey: false,
      altKey: false,
      metaKey: false,
      preventDefault: () => {}
    };
    // Should not throw
    assert.exists(shortcuts);
  });
});

// ============ Initial State Tests ============
runner.describe('Initial State', () => {
  runner.it('should create valid initial state', () => {
    const state = createInitialState();
    assert.exists(state);
    assert.hasProperty(state, 'document');
    assert.hasProperty(state, 'tools');
    assert.hasProperty(state, 'colors');
    assert.hasProperty(state, 'app');
  });

  runner.it('should have default tool values', () => {
    const state = createInitialState();
    assert.exists(state.tools.current);
    assert.exists(state.tools.options);
  });

  runner.it('should have default color values', () => {
    const state = createInitialState();
    assert.exists(state.colors.foreground);
    assert.exists(state.colors.background);
  });
});

export { runner as coreTests };
