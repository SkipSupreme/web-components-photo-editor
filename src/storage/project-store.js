/**
 * Project Store - Handles project persistence to IndexedDB
 * Saves and loads complete projects with layers and metadata
 */

import {
  Stores,
  get,
  getAll,
  getAllByIndex,
  put,
  putAll,
  remove,
  removeAll,
  generateId,
  openDatabase
} from './db.js';
import { getEventBus, Events } from '../core/event-bus.js';
import { LayerType } from '../document/layer.js';

/**
 * Project metadata structure
 */
export function createProjectMetadata(document) {
  return {
    id: document.id || generateId(),
    name: document.name,
    width: document.width,
    height: document.height,
    layerCount: document.layers.length,
    background: document.background,
    createdAt: document.createdAt || Date.now(),
    updatedAt: Date.now(),
    version: 1
  };
}

/**
 * Save a project to IndexedDB
 * @param {Document} document - The document to save
 * @returns {Promise<string>} The project ID
 */
export async function saveProject(document) {
  const eventBus = getEventBus();
  const projectId = document.id || generateId();
  document.id = projectId;

  try {
    eventBus.emit(Events.FILE_EXPORT_START, { format: 'project' });

    // Create project metadata
    const projectData = createProjectMetadata(document);

    // Save project metadata
    await put(Stores.PROJECTS, projectData);

    // Save layers
    const layerDataList = [];
    let order = 0;

    for (const layer of document.layers) {
      const layerData = await serializeLayer(layer, projectId, order++);
      layerDataList.push(layerData);

      // Handle layer children (groups)
      if (layer.children && layer.children.length > 0) {
        for (const child of layer.children) {
          const childData = await serializeLayer(child, projectId, order++, layer.id);
          layerDataList.push(childData);
        }
      }
    }

    await putAll(Stores.LAYERS, layerDataList);

    // Save thumbnail
    await saveProjectThumbnail(projectId, document);

    // Update recent documents
    await addToRecent(projectId, document.name);

    eventBus.emit(Events.FILE_EXPORT_COMPLETE, { format: 'project', id: projectId });

    return projectId;
  } catch (error) {
    console.error('Error saving project:', error);
    eventBus.emit(Events.FILE_EXPORT_ERROR, { error, format: 'project' });
    throw error;
  }
}

/**
 * Serialize a layer to storable format
 */
async function serializeLayer(layer, projectId, order, parentId = null) {
  const layerData = {
    id: `${projectId}-${layer.id}`,
    layerId: layer.id,
    projectId,
    parentId,
    order,
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

  // Serialize raster data
  if (layer.type === LayerType.RASTER && layer.canvas) {
    layerData.imageData = await canvasToBlob(layer.canvas);
  }

  // Serialize mask data
  if (layer.mask) {
    layerData.maskData = await canvasToBlob(layer.mask);
    layerData.maskEnabled = layer.maskEnabled;
  }

  // Serialize adjustment layer settings
  if (layer.type === LayerType.ADJUSTMENT && layer.adjustment) {
    layerData.adjustment = { ...layer.adjustment };
  }

  // Serialize group properties
  if (layer.type === LayerType.GROUP) {
    layerData.expanded = layer.expanded;
    layerData.childIds = layer.children.map(c => c.id);
  }

  return layerData;
}

/**
 * Convert canvas to Blob for storage
 */
async function canvasToBlob(canvas) {
  if (canvas instanceof OffscreenCanvas) {
    return await canvas.convertToBlob({ type: 'image/png' });
  } else if (canvas.toBlob) {
    return new Promise((resolve) => {
      canvas.toBlob(resolve, 'image/png');
    });
  }
  return null;
}

/**
 * Load a project from IndexedDB
 * @param {string} projectId - The project ID
 * @returns {Promise<{project: Object, layers: Object[]}>}
 */
export async function loadProject(projectId) {
  const eventBus = getEventBus();

  try {
    eventBus.emit(Events.FILE_IMPORT_START, { format: 'project' });

    // Load project metadata
    const project = await get(Stores.PROJECTS, projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    // Load layers
    const layers = await getAllByIndex(Stores.LAYERS, 'projectId', projectId);

    // Sort by order
    layers.sort((a, b) => a.order - b.order);

    // Deserialize layer data
    const deserializedLayers = await Promise.all(
      layers.map(layer => deserializeLayer(layer))
    );

    // Update recent documents
    await addToRecent(projectId, project.name);

    eventBus.emit(Events.FILE_IMPORT_COMPLETE, { format: 'project' });

    return {
      project,
      layers: deserializedLayers
    };
  } catch (error) {
    console.error('Error loading project:', error);
    eventBus.emit(Events.FILE_IMPORT_ERROR, { error, format: 'project' });
    throw error;
  }
}

/**
 * Deserialize a layer from storage format
 */
async function deserializeLayer(layerData) {
  const layer = {
    id: layerData.layerId,
    name: layerData.name,
    type: layerData.type,
    visible: layerData.visible,
    opacity: layerData.opacity,
    blendMode: layerData.blendMode,
    x: layerData.x,
    y: layerData.y,
    width: layerData.width,
    height: layerData.height,
    locked: layerData.locked,
    clipped: layerData.clipped,
    parentId: layerData.parentId
  };

  // Deserialize raster data
  if (layerData.imageData) {
    layer.imageData = await blobToImageData(layerData.imageData, layerData.width, layerData.height);
  }

  // Deserialize mask data
  if (layerData.maskData) {
    layer.maskData = await blobToImageData(layerData.maskData, layerData.width, layerData.height);
    layer.maskEnabled = layerData.maskEnabled;
  }

  // Deserialize adjustment settings
  if (layerData.adjustment) {
    layer.adjustment = { ...layerData.adjustment };
  }

  // Deserialize group properties
  if (layerData.type === LayerType.GROUP) {
    layer.expanded = layerData.expanded;
    layer.childIds = layerData.childIds;
  }

  return layer;
}

/**
 * Convert Blob to ImageData
 */
async function blobToImageData(blob, width, height) {
  const imageBitmap = await createImageBitmap(blob);

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(imageBitmap, 0, 0);

  return ctx.getImageData(0, 0, width, height);
}

/**
 * Delete a project and all its data
 * @param {string} projectId
 */
export async function deleteProject(projectId) {
  // Delete layers
  const layers = await getAllByIndex(Stores.LAYERS, 'projectId', projectId);
  const layerIds = layers.map(l => l.id);
  await removeAll(Stores.LAYERS, layerIds);

  // Delete thumbnail
  await remove(Stores.THUMBNAILS, `project-${projectId}`);

  // Delete project metadata
  await remove(Stores.PROJECTS, projectId);

  // Remove from recent
  await remove(Stores.RECENT, projectId);
}

/**
 * Get all projects
 * @returns {Promise<Object[]>}
 */
export async function getAllProjects() {
  return await getAll(Stores.PROJECTS);
}

/**
 * Get projects sorted by last updated
 * @param {number} limit - Maximum number to return
 * @returns {Promise<Object[]>}
 */
export async function getRecentProjects(limit = 10) {
  const projects = await getAll(Stores.PROJECTS);
  return projects
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit);
}

/**
 * Save project thumbnail
 */
async function saveProjectThumbnail(projectId, document) {
  try {
    const canvas = document.getCompositedCanvas(true);

    // Create thumbnail (max 200px)
    const maxSize = 200;
    const scale = Math.min(maxSize / canvas.width, maxSize / canvas.height, 1);
    const thumbWidth = Math.round(canvas.width * scale);
    const thumbHeight = Math.round(canvas.height * scale);

    const thumbCanvas = new OffscreenCanvas(thumbWidth, thumbHeight);
    const ctx = thumbCanvas.getContext('2d');
    ctx.drawImage(canvas, 0, 0, thumbWidth, thumbHeight);

    const blob = await thumbCanvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 });

    await put(Stores.THUMBNAILS, {
      id: `project-${projectId}`,
      type: 'project',
      projectId,
      blob,
      width: thumbWidth,
      height: thumbHeight,
      updatedAt: Date.now()
    });
  } catch (error) {
    console.warn('Failed to save thumbnail:', error);
  }
}

/**
 * Get project thumbnail
 * @param {string} projectId
 * @returns {Promise<string|null>} Data URL or null
 */
export async function getProjectThumbnail(projectId) {
  try {
    const thumbnail = await get(Stores.THUMBNAILS, `project-${projectId}`);
    if (thumbnail && thumbnail.blob) {
      return URL.createObjectURL(thumbnail.blob);
    }
  } catch (error) {
    console.warn('Failed to get thumbnail:', error);
  }
  return null;
}

// ============ Recent Documents ============

/**
 * Add a project to recent documents
 */
async function addToRecent(projectId, name) {
  await put(Stores.RECENT, {
    id: projectId,
    name,
    openedAt: Date.now()
  });

  // Keep only last 20 recent documents
  const recent = await getAll(Stores.RECENT);
  if (recent.length > 20) {
    const toRemove = recent
      .sort((a, b) => b.openedAt - a.openedAt)
      .slice(20)
      .map(r => r.id);
    await removeAll(Stores.RECENT, toRemove);
  }
}

/**
 * Get recent documents
 * @param {number} limit
 * @returns {Promise<Object[]>}
 */
export async function getRecentDocuments(limit = 10) {
  const recent = await getAll(Stores.RECENT);
  const sorted = recent.sort((a, b) => b.openedAt - a.openedAt).slice(0, limit);

  // Enrich with project data and thumbnails
  const enriched = await Promise.all(
    sorted.map(async (item) => {
      const project = await get(Stores.PROJECTS, item.id);
      const thumbnailUrl = await getProjectThumbnail(item.id);

      return {
        ...item,
        project,
        thumbnailUrl,
        exists: !!project
      };
    })
  );

  return enriched.filter(item => item.exists);
}

/**
 * Clear recent documents
 */
export async function clearRecentDocuments() {
  const { clear } = await import('./db.js');
  await clear(Stores.RECENT);
}

// ============ Settings ============

/**
 * Save a setting
 * @param {string} key
 * @param {any} value
 */
export async function saveSetting(key, value) {
  await put(Stores.SETTINGS, { key, value, updatedAt: Date.now() });
}

/**
 * Get a setting
 * @param {string} key
 * @param {any} defaultValue
 * @returns {Promise<any>}
 */
export async function getSetting(key, defaultValue = null) {
  const setting = await get(Stores.SETTINGS, key);
  return setting ? setting.value : defaultValue;
}

/**
 * Get all settings
 * @returns {Promise<Object>}
 */
export async function getAllSettings() {
  const settings = await getAll(Stores.SETTINGS);
  const result = {};
  for (const setting of settings) {
    result[setting.key] = setting.value;
  }
  return result;
}
