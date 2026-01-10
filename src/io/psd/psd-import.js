/**
 * PSD Import - Import Photoshop PSD files
 * Uses a Web Worker for non-blocking parsing
 */

import { getEventBus, Events } from '../../core/event-bus.js';
import { Document } from '../../document/document.js';
import { Layer, createRasterLayer, createAdjustmentLayer, LayerGroup, LayerType } from '../../document/layer.js';
import { LayerMask } from '../../document/mask.js';
import { FileReader } from '../file-handler.js';

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
function sendToWorker(type, data) {
  return new Promise((resolve, reject) => {
    const id = ++messageId;
    pendingMessages.set(id, { resolve, reject });

    const worker = getWorker();
    worker.postMessage({ type, id, data });
  });
}

/**
 * Import a PSD file and create a document
 * @param {File} file - The PSD file to import
 * @returns {Promise<Document>} The created document
 */
export async function importPSD(file) {
  const eventBus = getEventBus();

  try {
    eventBus.emit(Events.FILE_IMPORT_START, { file, type: 'psd' });
    eventBus.emit(Events.FILE_IMPORT_PROGRESS, { progress: 0.1, stage: 'reading' });

    // Read file as ArrayBuffer
    const buffer = await FileReader.asArrayBuffer(file);

    eventBus.emit(Events.FILE_IMPORT_PROGRESS, { progress: 0.3, stage: 'parsing' });

    // Parse PSD in worker
    const psdData = await sendToWorker('parse', { buffer });

    eventBus.emit(Events.FILE_IMPORT_PROGRESS, { progress: 0.6, stage: 'creating layers' });

    // Create document from parsed data
    const document = await createDocumentFromPSD(psdData, file.name);

    eventBus.emit(Events.FILE_IMPORT_PROGRESS, { progress: 1.0, stage: 'complete' });
    eventBus.emit(Events.FILE_IMPORT_COMPLETE, { document, file });

    return document;
  } catch (error) {
    eventBus.emit(Events.FILE_IMPORT_ERROR, { error, file });
    throw error;
  }
}

/**
 * Create a Document from parsed PSD data
 */
async function createDocumentFromPSD(psdData, filename) {
  const docName = filename.replace(/\.psd$/i, '');

  const document = new Document({
    name: docName,
    width: psdData.width,
    height: psdData.height,
    transparentBackground: true
  });

  // Process layers (in reverse order since PSD stores top-to-bottom)
  const layers = psdData.layers.slice().reverse();

  for (const layerData of layers) {
    const layer = await createLayerFromPSDData(layerData, psdData.width, psdData.height);
    if (layer) {
      document.addLayer(layer);
    }
  }

  // Set first layer as active
  if (document.layers.length > 0) {
    document.setActiveLayer(document.layers[0].id);
  }

  return document;
}

/**
 * Create a Layer from PSD layer data
 */
async function createLayerFromPSDData(layerData, docWidth, docHeight) {
  // Handle groups
  if (layerData.type === 'group') {
    const group = new LayerGroup({
      name: layerData.name,
      visible: layerData.visible,
      opacity: layerData.opacity,
      blendMode: layerData.blendMode,
      expanded: !layerData.expanded
    });

    // Process child layers
    if (layerData.children) {
      for (const childData of layerData.children.slice().reverse()) {
        const childLayer = await createLayerFromPSDData(childData, docWidth, docHeight);
        if (childLayer) {
          group.addChild(childLayer);
        }
      }
    }

    return group;
  }

  // Handle adjustment layers
  if (layerData.adjustment) {
    return createAdjustmentLayerFromPSD(layerData);
  }

  // Handle raster layers
  const layer = new Layer({
    name: layerData.name,
    type: LayerType.RASTER,
    visible: layerData.visible,
    opacity: layerData.opacity,
    blendMode: layerData.blendMode,
    x: layerData.left,
    y: layerData.top,
    clipped: layerData.clippingMask
  });

  // Initialize canvas
  layer.initCanvas(docWidth, docHeight);

  // Draw layer image data
  if (layerData.imageData) {
    const imageData = new ImageData(
      new Uint8ClampedArray(layerData.imageData.data),
      layerData.imageData.width,
      layerData.imageData.height
    );
    layer.ctx.putImageData(imageData, layerData.left, layerData.top);
    layer.updateThumbnail();
  }

  // Add mask if present
  if (layerData.mask && layerData.mask.imageData) {
    layer.mask = new LayerMask(docWidth, docHeight);

    const maskData = new ImageData(
      new Uint8ClampedArray(layerData.mask.imageData.data),
      layerData.mask.imageData.width,
      layerData.mask.imageData.height
    );

    layer.mask.ctx.putImageData(maskData, layerData.mask.left, layerData.mask.top);
    layer.mask.updateThumbnail();
    layer.maskEnabled = !layerData.mask.disabled;
  }

  return layer;
}

/**
 * Create an adjustment layer from PSD data
 */
function createAdjustmentLayerFromPSD(layerData) {
  const adjustmentType = mapPSDAdjustmentType(layerData.adjustment);

  if (!adjustmentType) {
    // Unsupported adjustment type, skip
    console.warn(`Unsupported PSD adjustment type: ${layerData.adjustment.type}`);
    return null;
  }

  return createAdjustmentLayer(adjustmentType, layerData.adjustment.params || {});
}

/**
 * Map PSD adjustment type to our adjustment types
 */
function mapPSDAdjustmentType(adjustment) {
  if (!adjustment) return null;

  const typeMap = {
    'brightnessContrast': 'brightness-contrast',
    'levels': 'levels',
    'curves': 'curves',
    'hueSaturation': 'hue-saturation',
    'colorBalance': 'color-balance',
    'blackAndWhite': 'black-white',
    'photoFilter': 'photo-filter',
    'vibrance': 'vibrance',
    'invert': 'invert',
    'posterize': 'posterize',
    'threshold': 'threshold'
  };

  return typeMap[adjustment.type] || null;
}

/**
 * Get PSD file info without fully parsing
 * @param {File} file - The PSD file
 * @returns {Promise<Object>} Basic PSD info
 */
export async function getPSDInfo(file) {
  const buffer = await FileReader.asArrayBuffer(file);
  const psdData = await sendToWorker('parse', { buffer });

  return {
    name: file.name,
    width: psdData.width,
    height: psdData.height,
    colorMode: psdData.colorMode,
    bitsPerChannel: psdData.bitsPerChannel,
    layerCount: countLayers(psdData.layers),
    hasComposite: !!psdData.compositeImage,
    hasThumbnail: !!psdData.thumbnail,
    fileSize: file.size
  };
}

/**
 * Count total layers including nested ones
 */
function countLayers(layers) {
  let count = 0;
  for (const layer of layers) {
    count++;
    if (layer.children) {
      count += countLayers(layer.children);
    }
  }
  return count;
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
