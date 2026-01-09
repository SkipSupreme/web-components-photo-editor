/**
 * PSD Worker - Handles PSD file parsing and export in a separate thread
 * Uses ag-psd library for PSD file operations
 */

// Import ag-psd when available
// Note: ag-psd needs to be added to lib/ag-psd.min.js
let agPsd = null;

try {
  // Dynamic import for the ag-psd library
  importScripts('../lib/ag-psd.min.js');
  agPsd = self.agPsd || self.Psd;
} catch (e) {
  console.warn('ag-psd library not found. PSD support will be limited.');
}

/**
 * Message handler for worker communication
 */
self.onmessage = async function(e) {
  const { type, id, data } = e.data;

  try {
    let result;

    switch (type) {
      case 'parse':
        result = await parsePSD(data.buffer);
        break;

      case 'export':
        result = await exportPSD(data);
        break;

      case 'getLayerImage':
        result = await getLayerImageData(data.psdData, data.layerIndex);
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }

    self.postMessage({ id, success: true, result });
  } catch (error) {
    self.postMessage({ id, success: false, error: error.message });
  }
};

/**
 * Parse a PSD file from an ArrayBuffer
 * @param {ArrayBuffer} buffer - The PSD file data
 * @returns {Object} Parsed PSD data
 */
async function parsePSD(buffer) {
  if (!agPsd) {
    throw new Error('ag-psd library is not loaded. Please add ag-psd.min.js to the lib folder.');
  }

  const psd = agPsd.readPsd(buffer, {
    skipLayerImageData: false,
    skipCompositeImageData: false,
    skipThumbnail: false
  });

  // Convert to a transferable structure
  return {
    width: psd.width,
    height: psd.height,
    colorMode: psd.colorMode,
    bitsPerChannel: psd.bitsPerChannel,
    channels: psd.channels,
    layers: extractLayers(psd.children || []),
    compositeImage: psd.composite ? getImageDataFromCanvas(psd.composite) : null,
    thumbnail: psd.thumbnail ? getImageDataFromCanvas(psd.thumbnail) : null
  };
}

/**
 * Extract layer data from PSD layers
 * @param {Array} layers - PSD layer array
 * @param {number} depth - Nesting depth
 * @returns {Array} Extracted layer data
 */
function extractLayers(layers, depth = 0) {
  const result = [];

  for (const layer of layers) {
    const layerData = {
      name: layer.name || 'Layer',
      type: layer.children ? 'group' : 'raster',
      visible: !layer.hidden,
      opacity: (layer.opacity ?? 255) / 255,
      blendMode: mapBlendMode(layer.blendMode),
      left: layer.left || 0,
      top: layer.top || 0,
      right: layer.right || 0,
      bottom: layer.bottom || 0,
      width: (layer.right || 0) - (layer.left || 0),
      height: (layer.bottom || 0) - (layer.top || 0),
      clippingMask: layer.clipping || false,
      depth
    };

    // Extract layer image data
    if (layer.canvas) {
      layerData.imageData = getImageDataFromCanvas(layer.canvas);
    }

    // Extract mask data
    if (layer.mask && layer.mask.canvas) {
      layerData.mask = {
        left: layer.mask.left || 0,
        top: layer.mask.top || 0,
        right: layer.mask.right || 0,
        bottom: layer.mask.bottom || 0,
        defaultColor: layer.mask.defaultColor,
        disabled: layer.mask.disabled,
        imageData: getImageDataFromCanvas(layer.mask.canvas)
      };
    }

    // Extract adjustment layer info
    if (layer.adjustment) {
      layerData.adjustment = layer.adjustment;
    }

    // Handle group children
    if (layer.children) {
      layerData.children = extractLayers(layer.children, depth + 1);
      layerData.expanded = !layer.folderOpen;
    }

    result.push(layerData);
  }

  return result;
}

/**
 * Map PSD blend mode to CSS blend mode
 */
function mapBlendMode(psdBlendMode) {
  const blendModeMap = {
    'normal': 'normal',
    'dissolve': 'normal',
    'darken': 'darken',
    'multiply': 'multiply',
    'color burn': 'color-burn',
    'linear burn': 'color-burn',
    'darker color': 'darken',
    'lighten': 'lighten',
    'screen': 'screen',
    'color dodge': 'color-dodge',
    'linear dodge': 'color-dodge',
    'lighter color': 'lighten',
    'overlay': 'overlay',
    'soft light': 'soft-light',
    'hard light': 'hard-light',
    'vivid light': 'hard-light',
    'linear light': 'hard-light',
    'pin light': 'hard-light',
    'hard mix': 'hard-light',
    'difference': 'difference',
    'exclusion': 'exclusion',
    'subtract': 'difference',
    'divide': 'difference',
    'hue': 'hue',
    'saturation': 'saturation',
    'color': 'color',
    'luminosity': 'luminosity'
  };

  return blendModeMap[psdBlendMode?.toLowerCase()] || 'normal';
}

/**
 * Get ImageData from a canvas
 */
function getImageDataFromCanvas(canvas) {
  if (!canvas) return null;

  const ctx = canvas.getContext('2d');
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * Export document data to PSD format
 * @param {Object} data - Document data to export
 * @returns {ArrayBuffer} PSD file data
 */
async function exportPSD(data) {
  if (!agPsd) {
    throw new Error('ag-psd library is not loaded. Please add ag-psd.min.js to the lib folder.');
  }

  const psdData = {
    width: data.width,
    height: data.height,
    children: []
  };

  // Convert layers to PSD format
  for (const layer of data.layers) {
    const psdLayer = {
      name: layer.name,
      hidden: !layer.visible,
      opacity: Math.round(layer.opacity * 255),
      blendMode: reverseMapBlendMode(layer.blendMode),
      left: layer.x || 0,
      top: layer.y || 0,
      right: (layer.x || 0) + layer.width,
      bottom: (layer.y || 0) + layer.height,
      clipping: layer.clipped || false
    };

    // Add image data if available
    if (layer.imageData) {
      // Create canvas from ImageData
      const canvas = new OffscreenCanvas(layer.width, layer.height);
      const ctx = canvas.getContext('2d');
      ctx.putImageData(layer.imageData, 0, 0);
      psdLayer.canvas = canvas;
    }

    // Add mask if available
    if (layer.mask) {
      const maskCanvas = new OffscreenCanvas(layer.mask.width, layer.mask.height);
      const maskCtx = maskCanvas.getContext('2d');
      maskCtx.putImageData(layer.mask.imageData, 0, 0);

      psdLayer.mask = {
        left: layer.mask.left || layer.x || 0,
        top: layer.mask.top || layer.y || 0,
        right: (layer.mask.left || layer.x || 0) + layer.mask.width,
        bottom: (layer.mask.top || layer.y || 0) + layer.mask.height,
        canvas: maskCanvas
      };
    }

    psdData.children.push(psdLayer);
  }

  // Write PSD
  const buffer = agPsd.writePsd(psdData, {
    generateThumbnail: true,
    trimImageData: false
  });

  return buffer;
}

/**
 * Reverse map CSS blend mode to PSD blend mode
 */
function reverseMapBlendMode(cssBlendMode) {
  const reverseMap = {
    'normal': 'normal',
    'darken': 'darken',
    'multiply': 'multiply',
    'color-burn': 'color burn',
    'lighten': 'lighten',
    'screen': 'screen',
    'color-dodge': 'color dodge',
    'overlay': 'overlay',
    'soft-light': 'soft light',
    'hard-light': 'hard light',
    'difference': 'difference',
    'exclusion': 'exclusion',
    'hue': 'hue',
    'saturation': 'saturation',
    'color': 'color',
    'luminosity': 'luminosity'
  };

  return reverseMap[cssBlendMode] || 'normal';
}

/**
 * Get image data for a specific layer
 */
async function getLayerImageData(psdData, layerIndex) {
  if (!psdData.layers || !psdData.layers[layerIndex]) {
    throw new Error('Layer not found');
  }

  return psdData.layers[layerIndex].imageData;
}
