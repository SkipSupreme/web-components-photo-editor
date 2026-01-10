/**
 * PSD Export - Export documents to Photoshop PSD format
 * Uses a Web Worker for non-blocking export
 */

import { getEventBus, Events } from '../../core/event-bus.js';
import { saveFile, PSDFileType } from '../file-handler.js';
import { LayerType } from '../../document/layer.js';

let psdWorker = null;
let messageId = 0;
const pendingMessages = new Map();

/**
 * Get or create the PSD worker
 */
function getWorker() {
  if (!psdWorker) {
    psdWorker = new Worker(new URL('../../../workers/psd-worker.js', import.meta.url));

    psdWorker.onmessage = (e) => {
      const { id, success, result, error } = e.data;
      const pending = pendingMessages.get(id);

      if (pending) {
        pendingMessages.delete(id);
        if (success) {
          pending.resolve(result);
        } else {
          pending.reject(new Error(error));
        }
      }
    };

    psdWorker.onerror = (e) => {
      console.error('PSD Worker error:', e);
    };
  }

  return psdWorker;
}

/**
 * Send a message to the worker and wait for response
 */
function sendToWorker(type, data, transferables = []) {
  return new Promise((resolve, reject) => {
    const id = ++messageId;
    pendingMessages.set(id, { resolve, reject });

    const worker = getWorker();
    worker.postMessage({ type, id, data }, transferables);
  });
}

/**
 * Export a document to PSD format
 * @param {Document} document - The document to export
 * @param {Object} options - Export options
 * @returns {Promise<ArrayBuffer>} The PSD file data
 */
export async function exportToPSD(document, options = {}) {
  const eventBus = getEventBus();

  try {
    eventBus.emit(Events.FILE_EXPORT_START, { format: 'psd' });

    // Prepare document data for the worker
    const documentData = await prepareDocumentForExport(document, options);

    // Export in worker
    const psdBuffer = await sendToWorker('export', documentData);

    eventBus.emit(Events.FILE_EXPORT_COMPLETE, { format: 'psd' });

    return psdBuffer;
  } catch (error) {
    console.error('PSD export error:', error);
    throw error;
  }
}

/**
 * Export document and prompt user to save
 * @param {Document} document - The document to export
 * @param {Object} options - Export options
 */
export async function exportAndSavePSD(document, options = {}) {
  const eventBus = getEventBus();

  try {
    const psdBuffer = await exportToPSD(document, options);

    const blob = new Blob([psdBuffer], { type: 'image/vnd.adobe.photoshop' });
    const suggestedName = `${document.name}.psd`;

    await saveFile(blob, suggestedName, {
      types: [PSDFileType]
    });
  } catch (error) {
    if (error.name !== 'AbortError') {
      eventBus.emit(Events.FILE_EXPORT_ERROR, { error, format: 'psd' });
      throw error;
    }
  }
}

/**
 * Prepare document data for export
 */
async function prepareDocumentForExport(document, options = {}) {
  const {
    includeHiddenLayers = true,
    flattenGroups = false
  } = options;

  const layers = [];

  for (const layer of document.layers) {
    if (!includeHiddenLayers && !layer.visible) continue;

    const layerData = await prepareLayerForExport(layer, document);
    if (layerData) {
      layers.push(layerData);
    }
  }

  return {
    width: document.width,
    height: document.height,
    layers,
    background: document.background
  };
}

/**
 * Prepare a single layer for export
 */
async function prepareLayerForExport(layer, document) {
  // Skip adjustment layers for now (complex to export)
  if (layer.type === LayerType.ADJUSTMENT) {
    return prepareAdjustmentLayerForExport(layer);
  }

  // Handle groups
  if (layer.type === LayerType.GROUP) {
    return prepareGroupForExport(layer, document);
  }

  // Prepare raster layer
  const layerData = {
    name: layer.name,
    type: 'raster',
    visible: layer.visible,
    opacity: layer.opacity,
    blendMode: layer.blendMode,
    x: layer.x,
    y: layer.y,
    width: layer.width,
    height: layer.height,
    clipped: layer.clipped
  };

  // Get layer image data
  if (layer.canvas) {
    layerData.imageData = layer.ctx.getImageData(0, 0, layer.width, layer.height);
  }

  // Get mask data
  if (layer.mask && layer.maskEnabled) {
    layerData.mask = {
      left: 0,
      top: 0,
      width: layer.mask.width,
      height: layer.mask.height,
      imageData: layer.mask.ctx.getImageData(0, 0, layer.mask.width, layer.mask.height),
      disabled: !layer.maskEnabled
    };
  }

  return layerData;
}

/**
 * Prepare a layer group for export
 */
async function prepareGroupForExport(group, document) {
  const children = [];

  for (const child of group.children) {
    const childData = await prepareLayerForExport(child, document);
    if (childData) {
      children.push(childData);
    }
  }

  return {
    name: group.name,
    type: 'group',
    visible: group.visible,
    opacity: group.opacity,
    blendMode: group.blendMode,
    expanded: group.expanded,
    children
  };
}

/**
 * Prepare an adjustment layer for export
 * Note: Full adjustment layer export requires more complex handling
 */
function prepareAdjustmentLayerForExport(layer) {
  return {
    name: layer.name,
    type: 'adjustment',
    visible: layer.visible,
    opacity: layer.opacity,
    blendMode: layer.blendMode,
    adjustment: layer.adjustment
  };
}

/**
 * Estimate PSD file size
 * @param {Document} document - The document
 * @returns {Object} Size estimate
 */
export function estimatePSDSize(document) {
  let totalPixels = 0;

  for (const layer of document.layers) {
    if (layer.type === LayerType.RASTER && layer.canvas) {
      totalPixels += layer.width * layer.height;
    }
    if (layer.mask) {
      totalPixels += layer.mask.width * layer.mask.height;
    }
  }

  // Estimate: 4 bytes per pixel (RGBA) + overhead
  const rawSize = totalPixels * 4;
  const estimatedSize = Math.round(rawSize * 0.3); // Compression estimate

  return {
    rawBytes: rawSize,
    estimatedBytes: estimatedSize,
    formatted: formatBytes(estimatedSize)
  };
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Check if a document can be exported to PSD
 * @param {Document} document - The document to check
 * @returns {{canExport: boolean, warnings: string[]}}
 */
export function validateForPSDExport(document) {
  const warnings = [];

  // Check dimensions
  if (document.width > 30000 || document.height > 30000) {
    warnings.push('Document dimensions exceed PSD maximum (30,000 pixels)');
  }

  // Check layer count
  let layerCount = 0;
  const countLayers = (layers) => {
    for (const layer of layers) {
      layerCount++;
      if (layer.children) {
        countLayers(layer.children);
      }
    }
  };
  countLayers(document.layers);

  if (layerCount > 8000) {
    warnings.push('Layer count may exceed PSD limits');
  }

  // Check for unsupported features
  for (const layer of document.layers) {
    if (layer.type === LayerType.ADJUSTMENT) {
      // Check if adjustment type is supported
      const supportedTypes = [
        'brightness-contrast', 'levels', 'curves',
        'hue-saturation', 'color-balance', 'invert',
        'posterize', 'threshold'
      ];

      if (layer.adjustment && !supportedTypes.includes(layer.adjustment.type)) {
        warnings.push(`Adjustment type '${layer.adjustment.type}' may not export correctly`);
      }
    }
  }

  return {
    canExport: true, // We'll try even with warnings
    warnings
  };
}

/**
 * Terminate the worker when no longer needed
 */
export function terminatePSDWorker() {
  if (psdWorker) {
    psdWorker.terminate();
    psdWorker = null;
    pendingMessages.clear();
  }
}
