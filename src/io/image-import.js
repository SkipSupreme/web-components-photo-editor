/**
 * Image Import - Utilities for importing various image formats
 */

import { getEventBus, Events } from '../core/event-bus.js';
import { FileReader, isImageFile, isPSDFile } from './file-handler.js';
import { createDocumentFromImage } from '../document/document.js';
import { createLayerFromImage } from '../document/layer.js';

/**
 * Import an image file and create a new document
 * @param {File} file - The image file to import
 * @returns {Promise<Document>} The created document
 */
export async function importImageAsDocument(file) {
  const eventBus = getEventBus();

  try {
    eventBus.emit(Events.FILE_IMPORT_START, { file });

    if (!isImageFile(file)) {
      throw new Error(`Unsupported file type: ${file.type}`);
    }

    eventBus.emit(Events.FILE_IMPORT_PROGRESS, { progress: 0.3, stage: 'reading' });

    const image = await FileReader.asImage(file);

    eventBus.emit(Events.FILE_IMPORT_PROGRESS, { progress: 0.7, stage: 'creating' });

    const document = await createDocumentFromImage(image, file.name.replace(/\.[^.]+$/, ''));

    eventBus.emit(Events.FILE_IMPORT_PROGRESS, { progress: 1.0, stage: 'complete' });
    eventBus.emit(Events.FILE_IMPORT_COMPLETE, { document, file });

    return document;
  } catch (error) {
    eventBus.emit(Events.FILE_IMPORT_ERROR, { error, file });
    throw error;
  }
}

/**
 * Import an image file as a new layer in an existing document
 * @param {File} file - The image file to import
 * @param {Document} document - The target document
 * @returns {Promise<Layer>} The created layer
 */
export async function importImageAsLayer(file, document) {
  const eventBus = getEventBus();

  try {
    if (!isImageFile(file)) {
      throw new Error(`Unsupported file type: ${file.type}`);
    }

    const image = await FileReader.asImage(file);
    const layerName = file.name.replace(/\.[^.]+$/, '');
    const layer = await createLayerFromImage(image, layerName);

    // Add layer above active layer
    const activeIndex = document.layers.indexOf(document.getActiveLayer());
    document.addLayer(layer, activeIndex + 1);
    document.setActiveLayer(layer.id);

    eventBus.emit(Events.RENDER_REQUEST);

    return layer;
  } catch (error) {
    eventBus.emit(Events.FILE_IMPORT_ERROR, { error, file });
    throw error;
  }
}

/**
 * Import from a data URL
 * @param {string} dataUrl - The data URL
 * @param {string} name - Name for the document/layer
 * @returns {Promise<{image: HTMLImageElement, width: number, height: number}>}
 */
export async function importFromDataURL(dataUrl, name = 'Imported') {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        image: img,
        width: img.width,
        height: img.height
      });
    };
    img.onerror = () => reject(new Error('Failed to load image from data URL'));
    img.src = dataUrl;
  });
}

/**
 * Import from clipboard
 * @returns {Promise<{image: HTMLImageElement, width: number, height: number}|null>}
 */
export async function importFromClipboard() {
  try {
    const clipboardItems = await navigator.clipboard.read();

    for (const item of clipboardItems) {
      for (const type of item.types) {
        if (type.startsWith('image/')) {
          const blob = await item.getType(type);
          const dataUrl = await new Promise((resolve, reject) => {
            const reader = new window.FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          return importFromDataURL(dataUrl, 'Pasted Image');
        }
      }
    }

    return null;
  } catch (error) {
    console.error('Failed to read clipboard:', error);
    return null;
  }
}

/**
 * Import from URL (fetch and load)
 * @param {string} url - The image URL
 * @param {string} name - Name for the image
 * @returns {Promise<{image: HTMLImageElement, width: number, height: number}>}
 */
export async function importFromURL(url, name = 'Imported') {
  const eventBus = getEventBus();

  try {
    eventBus.emit(Events.FILE_IMPORT_START, { url });

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }

    const blob = await response.blob();
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new window.FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const result = await importFromDataURL(dataUrl, name);

    eventBus.emit(Events.FILE_IMPORT_COMPLETE, { url });

    return result;
  } catch (error) {
    eventBus.emit(Events.FILE_IMPORT_ERROR, { error, url });
    throw error;
  }
}

/**
 * Validate image dimensions
 * @param {HTMLImageElement} image - The image to validate
 * @param {Object} limits - Dimension limits
 * @returns {{valid: boolean, message?: string}}
 */
export function validateImageDimensions(image, limits = {}) {
  const {
    maxWidth = 16384,
    maxHeight = 16384,
    maxPixels = 268435456 // 256 megapixels
  } = limits;

  const pixels = image.width * image.height;

  if (image.width > maxWidth) {
    return { valid: false, message: `Image width (${image.width}px) exceeds maximum (${maxWidth}px)` };
  }

  if (image.height > maxHeight) {
    return { valid: false, message: `Image height (${image.height}px) exceeds maximum (${maxHeight}px)` };
  }

  if (pixels > maxPixels) {
    return { valid: false, message: `Image size (${pixels} pixels) exceeds maximum (${maxPixels} pixels)` };
  }

  return { valid: true };
}

/**
 * Get image metadata
 * @param {File} file - The image file
 * @returns {Promise<Object>} Image metadata
 */
export async function getImageMetadata(file) {
  const image = await FileReader.asImage(file);

  return {
    name: file.name,
    size: file.size,
    type: file.type,
    width: image.width,
    height: image.height,
    aspectRatio: image.width / image.height,
    megapixels: (image.width * image.height / 1000000).toFixed(2),
    lastModified: new Date(file.lastModified)
  };
}
