/**
 * Image Export - Utilities for exporting to various image formats
 */

import { getEventBus, Events } from '../core/event-bus.js';
import { saveFile, ImageFileTypes } from './file-handler.js';

/**
 * Export format options
 */
export const ExportFormat = {
  PNG: 'image/png',
  JPEG: 'image/jpeg',
  WEBP: 'image/webp',
  GIF: 'image/gif',
  BMP: 'image/bmp'
};

/**
 * Default export options per format
 */
export const ExportDefaults = {
  [ExportFormat.PNG]: {
    quality: 1.0  // PNG doesn't use quality, but included for consistency
  },
  [ExportFormat.JPEG]: {
    quality: 0.92,
    backgroundColor: '#ffffff'  // JPEG doesn't support transparency
  },
  [ExportFormat.WEBP]: {
    quality: 0.92
  },
  [ExportFormat.GIF]: {
    dithering: true,
    colors: 256
  },
  [ExportFormat.BMP]: {}
};

/**
 * Export a document to a blob
 * @param {Document} document - The document to export
 * @param {string} format - The export format (MIME type)
 * @param {Object} options - Export options
 * @returns {Promise<Blob>}
 */
export async function exportToBlob(document, format = ExportFormat.PNG, options = {}) {
  const mergedOptions = { ...ExportDefaults[format], ...options };

  // Get composited canvas - include background for JPEG
  const includeBackground = format === ExportFormat.JPEG;
  const canvas = document.getCompositedCanvas(includeBackground);

  // For JPEG, fill with background color if transparent
  if (format === ExportFormat.JPEG && document.background.transparent) {
    const ctx = canvas.getContext('2d');
    const bgColor = mergedOptions.backgroundColor || '#ffffff';

    // Create a new canvas with background
    const jpegCanvas = new OffscreenCanvas(canvas.width, canvas.height);
    const jpegCtx = jpegCanvas.getContext('2d');

    jpegCtx.fillStyle = bgColor;
    jpegCtx.fillRect(0, 0, canvas.width, canvas.height);
    jpegCtx.drawImage(canvas, 0, 0);

    return await jpegCanvas.convertToBlob({
      type: format,
      quality: mergedOptions.quality
    });
  }

  return await canvas.convertToBlob({
    type: format,
    quality: mergedOptions.quality
  });
}

/**
 * Export document and prompt user to save
 * @param {Document} document - The document to export
 * @param {string} format - The export format
 * @param {Object} options - Export options
 */
export async function exportDocument(document, format = ExportFormat.PNG, options = {}) {
  const eventBus = getEventBus();

  try {
    eventBus.emit(Events.FILE_EXPORT_START, { format });

    const blob = await exportToBlob(document, format, options);

    const extension = getExtensionForFormat(format);
    const suggestedName = `${document.name}.${extension}`;

    const fileTypes = {
      [ExportFormat.PNG]: [ImageFileTypes.PNG],
      [ExportFormat.JPEG]: [ImageFileTypes.JPEG],
      [ExportFormat.WEBP]: [ImageFileTypes.WEBP]
    };

    await saveFile(blob, suggestedName, {
      types: fileTypes[format] || [ImageFileTypes.PNG]
    });

    eventBus.emit(Events.FILE_EXPORT_COMPLETE, { format, name: suggestedName });
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error('Export failed:', error);
      throw error;
    }
  }
}

/**
 * Export to data URL
 * @param {Document} document - The document to export
 * @param {string} format - The export format
 * @param {Object} options - Export options
 * @returns {Promise<string>}
 */
export async function exportToDataURL(document, format = ExportFormat.PNG, options = {}) {
  const blob = await exportToBlob(document, format, options);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Export to clipboard
 * @param {Document} document - The document to export
 */
export async function exportToClipboard(document) {
  const blob = await exportToBlob(document, ExportFormat.PNG);

  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        'image/png': blob
      })
    ]);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

/**
 * Export a specific layer to blob
 * @param {Layer} layer - The layer to export
 * @param {string} format - The export format
 * @param {Object} options - Export options
 * @returns {Promise<Blob>}
 */
export async function exportLayerToBlob(layer, format = ExportFormat.PNG, options = {}) {
  if (!layer.canvas) {
    throw new Error('Layer has no canvas data');
  }

  const mergedOptions = { ...ExportDefaults[format], ...options };

  return await layer.canvas.convertToBlob({
    type: format,
    quality: mergedOptions.quality
  });
}

/**
 * Export with resize
 * @param {Document} document - The document to export
 * @param {Object} size - Target size { width, height }
 * @param {string} format - The export format
 * @param {Object} options - Export options
 * @returns {Promise<Blob>}
 */
export async function exportResized(document, size, format = ExportFormat.PNG, options = {}) {
  const { width, height, maintainAspect = true } = size;

  const canvas = document.getCompositedCanvas(format === ExportFormat.JPEG);

  let targetWidth = width;
  let targetHeight = height;

  if (maintainAspect) {
    const aspectRatio = canvas.width / canvas.height;

    if (width && height) {
      // Fit within bounds
      if (width / height > aspectRatio) {
        targetWidth = height * aspectRatio;
      } else {
        targetHeight = width / aspectRatio;
      }
    } else if (width) {
      targetHeight = width / aspectRatio;
    } else if (height) {
      targetWidth = height * aspectRatio;
    }
  }

  targetWidth = Math.round(targetWidth);
  targetHeight = Math.round(targetHeight);

  const resizedCanvas = new OffscreenCanvas(targetWidth, targetHeight);
  const ctx = resizedCanvas.getContext('2d');

  // Use high-quality resampling
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(canvas, 0, 0, targetWidth, targetHeight);

  const mergedOptions = { ...ExportDefaults[format], ...options };

  return await resizedCanvas.convertToBlob({
    type: format,
    quality: mergedOptions.quality
  });
}

/**
 * Get file extension for format
 */
function getExtensionForFormat(format) {
  const extensions = {
    [ExportFormat.PNG]: 'png',
    [ExportFormat.JPEG]: 'jpg',
    [ExportFormat.WEBP]: 'webp',
    [ExportFormat.GIF]: 'gif',
    [ExportFormat.BMP]: 'bmp'
  };
  return extensions[format] || 'png';
}

/**
 * Calculate estimated file size
 * @param {Document} document - The document
 * @param {string} format - The export format
 * @param {Object} options - Export options
 * @returns {Promise<{size: number, formatted: string}>}
 */
export async function estimateFileSize(document, format = ExportFormat.PNG, options = {}) {
  const blob = await exportToBlob(document, format, options);
  const size = blob.size;

  let formatted;
  if (size < 1024) {
    formatted = `${size} B`;
  } else if (size < 1024 * 1024) {
    formatted = `${(size / 1024).toFixed(1)} KB`;
  } else {
    formatted = `${(size / (1024 * 1024)).toFixed(2)} MB`;
  }

  return { size, formatted };
}

/**
 * Export options builder
 */
export class ExportOptionsBuilder {
  constructor(format = ExportFormat.PNG) {
    this.format = format;
    this.options = { ...ExportDefaults[format] };
  }

  setQuality(quality) {
    this.options.quality = Math.max(0, Math.min(1, quality));
    return this;
  }

  setBackgroundColor(color) {
    this.options.backgroundColor = color;
    return this;
  }

  setSize(width, height) {
    this.options.width = width;
    this.options.height = height;
    return this;
  }

  build() {
    return {
      format: this.format,
      options: { ...this.options }
    };
  }
}
