/**
 * Storage Tests
 * Tests for IndexedDB, project store, and autosave
 */

import { TestRunner, assert } from './test-runner.js';
import {
  openDatabase,
  closeDatabase,
  Stores,
  get,
  put,
  remove,
  getAll,
  generateId,
  getStorageEstimate
} from '../src/storage/db.js';
import {
  saveProject,
  loadProject,
  deleteProject,
  getAllProjects,
  getRecentDocuments,
  saveSetting,
  getSetting
} from '../src/storage/project-store.js';
import {
  checkForRecovery,
  clearRecoveryState,
  getAutosaveStatus
} from '../src/storage/autosave.js';
import { createDocument } from '../src/document/document.js';

const runner = new TestRunner();

// ============ IndexedDB Tests ============
runner.describe('IndexedDB', () => {
  runner.it('should open database', async () => {
    const db = await openDatabase();
    assert.exists(db);
  });

  runner.it('should generate unique IDs', () => {
    const id1 = generateId();
    const id2 = generateId();
    assert.exists(id1);
    assert.exists(id2);
    assert.true(id1 !== id2);
  });

  runner.it('should have all required stores', async () => {
    const db = await openDatabase();
    assert.true(db.objectStoreNames.contains(Stores.PROJECTS));
    assert.true(db.objectStoreNames.contains(Stores.LAYERS));
    assert.true(db.objectStoreNames.contains(Stores.THUMBNAILS));
    assert.true(db.objectStoreNames.contains(Stores.SETTINGS));
    assert.true(db.objectStoreNames.contains(Stores.RECENT));
  });

  runner.it('should put and get data', async () => {
    const testData = { key: 'test-key', value: 'test-value' };
    await put(Stores.SETTINGS, testData);
    const result = await get(Stores.SETTINGS, 'test-key');
    assert.exists(result);
    assert.equal(result.value, 'test-value');
    await remove(Stores.SETTINGS, 'test-key');
  });

  runner.it('should delete data', async () => {
    const testData = { key: 'delete-test', value: 'to-be-deleted' };
    await put(Stores.SETTINGS, testData);
    await remove(Stores.SETTINGS, 'delete-test');
    const result = await get(Stores.SETTINGS, 'delete-test');
    assert.notExists(result);
  });

  runner.it('should get storage estimate', async () => {
    const estimate = await getStorageEstimate();
    assert.exists(estimate);
    assert.hasProperty(estimate, 'usage');
    assert.hasProperty(estimate, 'quota');
  });
});

// ============ Settings Tests ============
runner.describe('Settings Store', () => {
  runner.it('should save and load settings', async () => {
    await saveSetting('test-setting', { foo: 'bar' });
    const result = await getSetting('test-setting');
    assert.exists(result);
    assert.equal(result.foo, 'bar');
    await remove(Stores.SETTINGS, 'test-setting');
  });

  runner.it('should return default for missing setting', async () => {
    const result = await getSetting('nonexistent-setting', 'default-value');
    assert.equal(result, 'default-value');
  });
});

// ============ Autosave Tests ============
runner.describe('Autosave', () => {
  runner.it('should get autosave status', () => {
    const status = getAutosaveStatus();
    assert.exists(status);
    assert.hasProperty(status, 'enabled');
    assert.hasProperty(status, 'isDirty');
  });

  runner.it('should check for recovery state', async () => {
    const recovery = await checkForRecovery();
    // May or may not exist, but shouldn't throw
    assert.true(recovery === null || typeof recovery === 'object');
  });

  runner.it('should clear recovery state', async () => {
    await clearRecoveryState();
    const recovery = await checkForRecovery();
    assert.notExists(recovery);
  });
});

// ============ Recent Documents Tests ============
runner.describe('Recent Documents', () => {
  runner.it('should get recent documents without error', async () => {
    const recent = await getRecentDocuments(5);
    assert.exists(recent);
    assert.true(Array.isArray(recent));
  });
});

export { runner as storageTests };
