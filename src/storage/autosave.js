/**
 * Autosave - Automatic project saving and crash recovery
 * Periodically saves work-in-progress to IndexedDB
 */

import { getEventBus, Events } from '../core/event-bus.js';
import { saveProject, loadProject, getSetting, saveSetting } from './project-store.js';
import { Stores, get, put, remove, getAll } from './db.js';

const AUTOSAVE_INTERVAL = 60000; // 1 minute
const RECOVERY_KEY = 'recovery-state';

let autosaveTimer = null;
let lastSaveTime = 0;
let isDirty = false;
let currentDocument = null;
let isEnabled = true;

/**
 * Initialize autosave system
 * @param {Document} document - The document to track
 * @param {Object} options - Configuration options
 */
export function initAutosave(document, options = {}) {
  const {
    interval = AUTOSAVE_INTERVAL,
    enabled = true
  } = options;

  currentDocument = document;
  isEnabled = enabled;

  if (!enabled) return;

  // Set up event listeners
  const eventBus = getEventBus();

  // Track document modifications
  eventBus.on(Events.DOCUMENT_MODIFIED, () => {
    isDirty = true;
  });

  eventBus.on(Events.LAYER_UPDATED, () => {
    isDirty = true;
  });

  eventBus.on(Events.LAYER_ADDED, () => {
    isDirty = true;
  });

  eventBus.on(Events.LAYER_REMOVED, () => {
    isDirty = true;
  });

  eventBus.on(Events.HISTORY_PUSH, () => {
    isDirty = true;
  });

  // Manual save clears dirty flag
  eventBus.on(Events.DOCUMENT_SAVED, () => {
    isDirty = false;
    lastSaveTime = Date.now();
  });

  // Start autosave timer
  startAutosaveTimer(interval);

  // Set up beforeunload handler for crash recovery
  setupBeforeUnload();

  // Set up visibility change handler
  setupVisibilityHandler();

  console.log('Autosave initialized with interval:', interval);
}

/**
 * Start the autosave timer
 */
function startAutosaveTimer(interval) {
  stopAutosaveTimer();

  autosaveTimer = setInterval(async () => {
    if (isDirty && currentDocument && isEnabled) {
      await performAutosave();
    }
  }, interval);
}

/**
 * Stop the autosave timer
 */
function stopAutosaveTimer() {
  if (autosaveTimer) {
    clearInterval(autosaveTimer);
    autosaveTimer = null;
  }
}

/**
 * Perform an autosave
 */
async function performAutosave() {
  if (!currentDocument) return;

  try {
    const startTime = performance.now();

    // Save recovery state
    await saveRecoveryState(currentDocument);

    isDirty = false;
    lastSaveTime = Date.now();

    const duration = Math.round(performance.now() - startTime);
    console.log(`Autosave completed in ${duration}ms`);

    getEventBus().emit('autosave:complete', {
      timestamp: lastSaveTime,
      duration
    });
  } catch (error) {
    console.error('Autosave failed:', error);
    getEventBus().emit('autosave:error', { error });
  }
}

/**
 * Save recovery state
 */
async function saveRecoveryState(document) {
  const recoveryData = {
    id: RECOVERY_KEY,
    documentId: document.id,
    documentName: document.name,
    width: document.width,
    height: document.height,
    savedAt: Date.now(),
    layers: []
  };

  // Serialize minimal layer data for recovery
  for (const layer of document.layers) {
    const layerData = await serializeLayerForRecovery(layer);
    recoveryData.layers.push(layerData);

    // Handle group children
    if (layer.children) {
      for (const child of layer.children) {
        const childData = await serializeLayerForRecovery(child, layer.id);
        recoveryData.layers.push(childData);
      }
    }
  }

  await put(Stores.SETTINGS, {
    key: RECOVERY_KEY,
    value: recoveryData,
    updatedAt: Date.now()
  });
}

/**
 * Serialize a layer for recovery
 */
async function serializeLayerForRecovery(layer, parentId = null) {
  const data = {
    id: layer.id,
    parentId,
    name: layer.name,
    type: layer.type,
    visible: layer.visible,
    opacity: layer.opacity,
    blendMode: layer.blendMode,
    x: layer.x,
    y: layer.y,
    width: layer.width,
    height: layer.height,
    locked: layer.locked,
    clipped: layer.clipped
  };

  // Store canvas data as blob
  if (layer.canvas) {
    try {
      if (layer.canvas instanceof OffscreenCanvas) {
        data.imageBlob = await layer.canvas.convertToBlob({ type: 'image/png' });
      } else if (layer.canvas.toBlob) {
        data.imageBlob = await new Promise(resolve => {
          layer.canvas.toBlob(resolve, 'image/png');
        });
      }
    } catch (e) {
      console.warn('Failed to serialize layer canvas:', e);
    }
  }

  // Store mask data
  if (layer.mask) {
    try {
      if (layer.mask instanceof OffscreenCanvas) {
        data.maskBlob = await layer.mask.convertToBlob({ type: 'image/png' });
      } else if (layer.mask.toBlob) {
        data.maskBlob = await new Promise(resolve => {
          layer.mask.toBlob(resolve, 'image/png');
        });
      }
      data.maskEnabled = layer.maskEnabled;
    } catch (e) {
      console.warn('Failed to serialize layer mask:', e);
    }
  }

  // Adjustment layer data
  if (layer.adjustment) {
    data.adjustment = { ...layer.adjustment };
  }

  // Group data
  if (layer.expanded !== undefined) {
    data.expanded = layer.expanded;
  }

  return data;
}

/**
 * Check for recovery state
 * @returns {Promise<Object|null>}
 */
export async function checkForRecovery() {
  try {
    const setting = await get(Stores.SETTINGS, RECOVERY_KEY);
    if (setting && setting.value) {
      return setting.value;
    }
  } catch (error) {
    console.error('Error checking recovery state:', error);
  }
  return null;
}

/**
 * Recover document from autosave
 * @param {Object} recoveryData
 * @returns {Promise<Object>} Recovered document data
 */
export async function recoverDocument(recoveryData) {
  const documentData = {
    id: recoveryData.documentId,
    name: recoveryData.documentName,
    width: recoveryData.width,
    height: recoveryData.height,
    layers: []
  };

  // Reconstruct layers
  for (const layerData of recoveryData.layers) {
    const layer = await deserializeRecoveryLayer(layerData);
    documentData.layers.push(layer);
  }

  return documentData;
}

/**
 * Deserialize a layer from recovery data
 */
async function deserializeRecoveryLayer(data) {
  const layer = {
    id: data.id,
    parentId: data.parentId,
    name: data.name,
    type: data.type,
    visible: data.visible,
    opacity: data.opacity,
    blendMode: data.blendMode,
    x: data.x,
    y: data.y,
    width: data.width,
    height: data.height,
    locked: data.locked,
    clipped: data.clipped
  };

  // Restore canvas data
  if (data.imageBlob) {
    layer.imageData = await blobToImageData(data.imageBlob, data.width, data.height);
  }

  // Restore mask data
  if (data.maskBlob) {
    layer.maskData = await blobToImageData(data.maskBlob, data.width, data.height);
    layer.maskEnabled = data.maskEnabled;
  }

  // Adjustment data
  if (data.adjustment) {
    layer.adjustment = { ...data.adjustment };
  }

  // Group data
  if (data.expanded !== undefined) {
    layer.expanded = data.expanded;
  }

  return layer;
}

/**
 * Convert blob to ImageData
 */
async function blobToImageData(blob, width, height) {
  const imageBitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(imageBitmap, 0, 0);
  return ctx.getImageData(0, 0, width, height);
}

/**
 * Clear recovery state
 */
export async function clearRecoveryState() {
  try {
    await remove(Stores.SETTINGS, RECOVERY_KEY);
  } catch (error) {
    console.error('Error clearing recovery state:', error);
  }
}

/**
 * Set up beforeunload handler
 */
function setupBeforeUnload() {
  window.addEventListener('beforeunload', (e) => {
    if (isDirty && currentDocument) {
      // Try to do a quick save
      saveRecoveryState(currentDocument).catch(console.error);

      // Show browser's native prompt
      e.preventDefault();
      e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
    }
  });
}

/**
 * Set up visibility change handler
 * Saves when tab becomes hidden
 */
function setupVisibilityHandler() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && isDirty && currentDocument) {
      performAutosave();
    }
  });
}

/**
 * Force an immediate autosave
 */
export async function forceAutosave() {
  if (currentDocument) {
    isDirty = true;
    await performAutosave();
  }
}

/**
 * Update the document being tracked
 * @param {Document} document
 */
export function setAutosaveDocument(document) {
  currentDocument = document;
  isDirty = true;
}

/**
 * Enable or disable autosave
 * @param {boolean} enabled
 */
export function setAutosaveEnabled(enabled) {
  isEnabled = enabled;
  if (enabled) {
    startAutosaveTimer(AUTOSAVE_INTERVAL);
  } else {
    stopAutosaveTimer();
  }
}

/**
 * Get autosave status
 */
export function getAutosaveStatus() {
  return {
    enabled: isEnabled,
    isDirty,
    lastSaveTime,
    hasDocument: !!currentDocument
  };
}

/**
 * Mark document as dirty (needs save)
 */
export function markDirty() {
  isDirty = true;
}

/**
 * Mark document as clean (saved)
 */
export function markClean() {
  isDirty = false;
  lastSaveTime = Date.now();
}

/**
 * Cleanup autosave system
 */
export function destroyAutosave() {
  stopAutosaveTimer();
  currentDocument = null;
  isDirty = false;
}
