/**
 * File Handler - File System Access API wrapper
 * Provides unified file operations with fallbacks
 */

import { getEventBus, Events } from '../core/event-bus.js';

/**
 * Supported file types for images
 */
export const ImageFileTypes = {
  PNG: { description: 'PNG Image', accept: { 'image/png': ['.png'] } },
  JPEG: { description: 'JPEG Image', accept: { 'image/jpeg': ['.jpg', '.jpeg'] } },
  WEBP: { description: 'WebP Image', accept: { 'image/webp': ['.webp'] } },
  GIF: { description: 'GIF Image', accept: { 'image/gif': ['.gif'] } },
  BMP: { description: 'BMP Image', accept: { 'image/bmp': ['.bmp'] } },
  ALL_IMAGES: {
    description: 'All Images',
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'] }
  }
};

/**
 * PSD file type
 */
export const PSDFileType = {
  description: 'Photoshop Document',
  accept: { 'image/vnd.adobe.photoshop': ['.psd'] }
};

/**
 * Project file type (our native format)
 */
export const ProjectFileType = {
  description: 'Photo Editor Project',
  accept: { 'application/json': ['.pep'] }
};

/**
 * Check if File System Access API is supported
 */
export function isFileSystemAccessSupported() {
  return 'showOpenFilePicker' in window && 'showSaveFilePicker' in window;
}

/**
 * Open a file using File System Access API or fallback
 * @param {Object} options - File picker options
 * @returns {Promise<{file: File, handle: FileSystemFileHandle|null}>}
 */
export async function openFile(options = {}) {
  const eventBus = getEventBus();

  const defaultOptions = {
    types: [ImageFileTypes.ALL_IMAGES, PSDFileType],
    multiple: false
  };

  const mergedOptions = { ...defaultOptions, ...options };

  try {
    eventBus.emit(Events.FILE_IMPORT_START);

    if (isFileSystemAccessSupported()) {
      const [handle] = await window.showOpenFilePicker(mergedOptions);
      const file = await handle.getFile();

      return { file, handle };
    } else {
      // Fallback to input element
      return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = getAcceptString(mergedOptions.types);
        input.multiple = mergedOptions.multiple;

        input.onchange = (e) => {
          const file = e.target.files[0];
          if (file) {
            resolve({ file, handle: null });
          } else {
            reject(new Error('No file selected'));
          }
        };

        input.oncancel = () => reject(new DOMException('User cancelled', 'AbortError'));
        input.click();
      });
    }
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error('Error opening file:', error);
      eventBus.emit(Events.FILE_IMPORT_ERROR, { error });
    }
    throw error;
  }
}

/**
 * Open multiple files
 * @param {Object} options - File picker options
 * @returns {Promise<Array<{file: File, handle: FileSystemFileHandle|null}>>}
 */
export async function openFiles(options = {}) {
  const mergedOptions = { ...options, multiple: true };

  if (isFileSystemAccessSupported()) {
    const handles = await window.showOpenFilePicker(mergedOptions);
    return Promise.all(handles.map(async handle => ({
      file: await handle.getFile(),
      handle
    })));
  } else {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = getAcceptString(mergedOptions.types || [ImageFileTypes.ALL_IMAGES]);
      input.multiple = true;

      input.onchange = (e) => {
        const files = Array.from(e.target.files).map(file => ({
          file,
          handle: null
        }));
        resolve(files);
      };

      input.oncancel = () => reject(new DOMException('User cancelled', 'AbortError'));
      input.click();
    });
  }
}

/**
 * Save a file using File System Access API or fallback
 * @param {Blob} blob - The data to save
 * @param {string} suggestedName - Suggested file name
 * @param {Object} options - Save options
 * @returns {Promise<FileSystemFileHandle|null>}
 */
export async function saveFile(blob, suggestedName, options = {}) {
  const eventBus = getEventBus();

  const defaultOptions = {
    types: [ImageFileTypes.PNG]
  };

  const mergedOptions = { ...defaultOptions, ...options };

  try {
    eventBus.emit(Events.FILE_EXPORT_START);

    if (isFileSystemAccessSupported()) {
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: mergedOptions.types
      });

      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();

      eventBus.emit(Events.FILE_EXPORT_COMPLETE, { handle, name: suggestedName });
      return handle;
    } else {
      // Fallback to download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = suggestedName;
      a.click();

      // Clean up after a delay
      setTimeout(() => URL.revokeObjectURL(url), 10000);

      eventBus.emit(Events.FILE_EXPORT_COMPLETE, { handle: null, name: suggestedName });
      return null;
    }
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error('Error saving file:', error);
    }
    throw error;
  }
}

/**
 * Save to an existing file handle
 * @param {FileSystemFileHandle} handle - The file handle
 * @param {Blob} blob - The data to save
 */
export async function saveToHandle(handle, blob) {
  if (!handle) {
    throw new Error('No file handle provided');
  }

  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
}

/**
 * Read file as various formats
 */
export const FileReader = {
  /**
   * Read file as ArrayBuffer
   */
  async asArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new window.FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  },

  /**
   * Read file as Data URL
   */
  async asDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new window.FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  },

  /**
   * Read file as text
   */
  async asText(file) {
    return new Promise((resolve, reject) => {
      const reader = new window.FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  },

  /**
   * Read file as Image
   */
  async asImage(file) {
    const dataUrl = await this.asDataURL(file);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = dataUrl;
    });
  }
};

/**
 * Get MIME type from file extension
 */
export function getMimeType(filename) {
  const ext = filename.toLowerCase().split('.').pop();
  const mimeTypes = {
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'webp': 'image/webp',
    'gif': 'image/gif',
    'bmp': 'image/bmp',
    'psd': 'image/vnd.adobe.photoshop',
    'pep': 'application/json'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Get file extension from MIME type
 */
export function getExtension(mimeType) {
  const extensions = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/bmp': 'bmp',
    'image/vnd.adobe.photoshop': 'psd',
    'application/json': 'json'
  };
  return extensions[mimeType] || 'bin';
}

/**
 * Check if a file is an image
 */
export function isImageFile(file) {
  return file.type.startsWith('image/') ||
         /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name);
}

/**
 * Check if a file is a PSD
 */
export function isPSDFile(file) {
  return file.type === 'image/vnd.adobe.photoshop' ||
         file.name.toLowerCase().endsWith('.psd');
}

/**
 * Helper to convert file types array to accept string
 */
function getAcceptString(types) {
  const accepts = [];
  for (const type of types) {
    if (type.accept) {
      for (const [mime, exts] of Object.entries(type.accept)) {
        accepts.push(mime);
        accepts.push(...exts);
      }
    }
  }
  return [...new Set(accepts)].join(',');
}

/**
 * Drag and drop file handling
 */
export class DropZone {
  constructor(element, options = {}) {
    this.element = element;
    this.options = {
      onDrop: () => {},
      onDragEnter: () => {},
      onDragLeave: () => {},
      acceptTypes: ['image/*'],
      ...options
    };

    this.boundHandlers = {
      dragenter: this.handleDragEnter.bind(this),
      dragover: this.handleDragOver.bind(this),
      dragleave: this.handleDragLeave.bind(this),
      drop: this.handleDrop.bind(this)
    };

    this.dragCounter = 0;
  }

  enable() {
    for (const [event, handler] of Object.entries(this.boundHandlers)) {
      this.element.addEventListener(event, handler);
    }
  }

  disable() {
    for (const [event, handler] of Object.entries(this.boundHandlers)) {
      this.element.removeEventListener(event, handler);
    }
  }

  handleDragEnter(e) {
    e.preventDefault();
    this.dragCounter++;

    if (this.dragCounter === 1) {
      this.options.onDragEnter(e);
    }
  }

  handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }

  handleDragLeave(e) {
    e.preventDefault();
    this.dragCounter--;

    if (this.dragCounter === 0) {
      this.options.onDragLeave(e);
    }
  }

  handleDrop(e) {
    e.preventDefault();
    this.dragCounter = 0;
    this.options.onDragLeave(e);

    const files = Array.from(e.dataTransfer.files);
    const validFiles = files.filter(file => this.isAcceptedType(file));

    if (validFiles.length > 0) {
      this.options.onDrop(validFiles, e);
    }
  }

  isAcceptedType(file) {
    for (const type of this.options.acceptTypes) {
      if (type.includes('*')) {
        const [category] = type.split('/');
        if (file.type.startsWith(category + '/')) return true;
      } else if (file.type === type) {
        return true;
      } else if (type.startsWith('.') && file.name.toLowerCase().endsWith(type)) {
        return true;
      }
    }
    return false;
  }
}
